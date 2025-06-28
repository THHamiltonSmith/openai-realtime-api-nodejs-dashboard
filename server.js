// server.js

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
dotenv.config();

import { RealtimeClient } from '@openai/realtime-api-beta';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';

// Express setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Set up view engine and static files
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('public'));
app.use(express.json());

const conversationsDir = path.join(process.cwd(), 'conversations');
if (!fs.existsSync(conversationsDir)) {
    fs.mkdirSync(conversationsDir);
}

// Main Route
app.get('/', (req, res) => {
    res.render('index');
  });

// Socket.io setup
io.on('connection', (socket) => {
    const client = new RealtimeClient({ apiKey: process.env.OPENAI_API_KEY });
    let activeConversation = null;

    // Ensure an active conversation exists
    async function ensureActiveConversation() {
        if (!activeConversation) {
            const id = Date.now().toString();
            activeConversation = { id, title: 'New Chat', messages: [] };
            await fsp.writeFile(
                path.join(conversationsDir, `${id}.json`),
                JSON.stringify(activeConversation, null, 2)
            );
            socket.emit('conversationCreated', { id });
        }
    }

    client.updateSession({
        instructions: 'You are a helpful, english speaking assistant. Speak quickly and concisely, dont slow down speed between sentences and prompts.',
        voice: 'alloy',
        voice_speed: 1.5,
        turn_detection: { type: 'server_vad', threshold: 0.3 },
        output_audio: { model: 'audio-davinci', format: 'pcm' },
        input_audio_transcription: { model: 'whisper-1' },
        conversation: { enable: true },
    });

    client.connect().catch((error) => {
        console.error('Failed to connect:', error);
        socket.emit('error', 'Failed to connect to OpenAI API.');
    });

    client.on('error', (error) => {
        console.error('Realtime API error:', error);
    });

    // Handle conversation updates for transcription and audio
    client.on('conversation.updated', async (event) => {
        const { item, delta } = event;

        if (item.role === 'user' && item.status === 'completed') {
            await ensureActiveConversation();
        }

        // Handle user input (partial or complete transcription)
        if (item.role === 'user' && item.formatted.transcript) {
            socket.emit('displayUserMessage', {
                text: item.formatted.transcript,
                isFinal: item.status === 'completed',
            });

            if (activeConversation && item.status === 'completed') {
                if (activeConversation.title === 'New Chat') {
                    activeConversation.title = item.formatted.transcript.slice(0, 40);
                }
                activeConversation.messages.push({ role: 'user', content: item.formatted.transcript });
                await fsp.writeFile(
                    path.join(conversationsDir, `${activeConversation.id}.json`),
                    JSON.stringify(activeConversation, null, 2)
                );
            }

            // If the user message has audio but no transcript, indicate that
        } else if (item.role === 'user' && item.formatted.audio?.length && !item.formatted.transcript) {
            socket.emit('displayUserMessage', {
                text: "(awaiting transcript)",
                isFinal: false,
            });

            // If the active conversation exists, add a placeholder message
        } else if (item.role === 'user' && !item.formatted.transcript) {
            socket.emit('displayUserMessage', {
                text: "(item sent)",
                isFinal: true,
            });
            
            if (activeConversation && item.status === 'completed') {
                activeConversation.messages.push({ role: 'user', content: '(unable to transcribe)' });
                await fsp.writeFile(
                    path.join(conversationsDir, `${activeConversation.id}.json`),
                    JSON.stringify(activeConversation, null, 2)
                );
            }
        }

        // Handle assistant responses (partial or complete)
        if (item.role !== 'user' && item.formatted.transcript) {
            socket.emit('conversationUpdate', {
                text: item.formatted.transcript,
                isFinal: item.status === 'completed',
            });
            if (activeConversation && item.status === 'completed') {
                activeConversation.messages.push({ role: 'assistant', content: item.formatted.transcript });
                await fsp.writeFile(
                    path.join(conversationsDir, `${activeConversation.id}.json`),
                    JSON.stringify(activeConversation, null, 2)
                );
            }
        }

        // Handle audio responses
        if (delta?.audio) {
            const audioData = delta.audio.buffer || delta.audio;
            socket.emit('audioStream', audioData, item.id);
        }
    });

    // Handle incoming audio data from the client
    socket.on('audioInput', async (data) => {
        if (data) {
            try {
                const buffer = new Uint8Array(data).buffer;
                const int16Array = new Int16Array(buffer);
                await client.appendInputAudio(int16Array);
            } catch (error) {
                console.error('Error processing audio data:', error);
            }
        }
    });

    // Handle conversation interruption
    client.on('conversation.interrupted', async () => {
        socket.emit('conversationInterrupted');
    });

    // Handle setting the active conversation
    socket.on('setConversation', async (id) => {
        try {
            const data = await fsp.readFile(path.join(conversationsDir, `${id}.json`), 'utf8');
            activeConversation = JSON.parse(data);
            client.conversation.clear();
        } catch (err) {
            console.error('Failed to load conversation', err);
        }
    });

    // Handle cancel response requests from the client
    socket.on('cancelResponse', async ({ trackId, offset }) => {
        if (trackId) {
            try {
                await client.cancelResponse(trackId, offset);
            } catch (error) {
                console.error('Error canceling response:', error);
            }
        }
    });

    // Handle text messages from the user
   socket.on('userMessage', async (message) => {
        await ensureActiveConversation();
        client.sendUserMessageContent([{ type: 'input_text', text: message }]);
    });

    socket.on('disconnect', () => {
        client.disconnect();
    });
});

// REST Endpoints for conversations
app.get('/conversations', async (req, res) => {
    const files = await fsp.readdir(conversationsDir);
    const convos = [];
    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const data = await fsp.readFile(path.join(conversationsDir, file), 'utf8');
        const { id, title } = JSON.parse(data);
        convos.push({ id, title });
    }
    res.json(convos);
});

// Get a specific conversation by ID
app.get('/conversations/:id', async (req, res) => {
    try {
        const data = await fsp.readFile(path.join(conversationsDir, `${req.params.id}.json`), 'utf8');
        res.json(JSON.parse(data));
    } catch {
        res.status(404).json({ error: 'Conversation not found' });
    }
});

// Create a new conversation
app.post('/conversations', async (req, res) => {
    const id = Date.now().toString();
    const convo = { id, title: 'New Chat', messages: [] };
    await fsp.writeFile(path.join(conversationsDir, `${id}.json`), JSON.stringify(convo, null, 2));
    res.json(convo);
});

// Delete an existing conversation
app.delete('/conversations/:id', async (req, res) => {
    try {
        await fsp.unlink(path.join(conversationsDir, `${req.params.id}.json`));
        res.json({ success: true });
    } catch {
        res.status(404).json({ error: 'Conversation not found' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT);
