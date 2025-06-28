// dashboard.js

import { WavRecorder, WavStreamPlayer } from '/wavtools/index.js';
const socket = io();

// DOM Elements
const conversation = document.getElementById('conversation');
const userInput = document.getElementById('userInput');
const submitButton = document.getElementById('submitMessage');
const toggleButton = document.getElementById('toggle-button');
const chatHistory = document.getElementById('chatHistory');
const newChatButton = document.getElementById('newChat');

// Variables
let conversationMode = false;
let currentBotMessage = null;
let currentUserMessage = null;

let activeConversationId = null;

let sentUserMessage = null;
let sentUserMessageContent = null;

// Audio Tools
const wavRecorder = new WavRecorder({ sampleRate: 24000 });
const wavStreamPlayer = new WavStreamPlayer({ sampleRate: 24000 });

// Initialize audio player
(async () => {
    await wavStreamPlayer.connect();
})();

// Event Listeners
submitButton.addEventListener('click', sendMessage);
toggleButton.addEventListener('click', toggleConversationMode);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});
newChatButton.addEventListener('click', createNewChat);

document.addEventListener('DOMContentLoaded', loadChatHistory);


// Send message to server
function sendMessage() {
    const message = userInput.value.trim();
    if (message) {
        sentUserMessage = true;
        sentUserMessageContent = message;
        socket.emit('userMessage', message);
        userInput.value = '';
    }
}

// Display user message (typed or transcribed)
function displayUserMessage(message, isFinal = false) {
    if (!currentUserMessage) {

        // Create new message element if one doesn't exist.
        currentUserMessage = document.createElement('div');
        currentUserMessage.textContent = `You: ${message}`;
        currentUserMessage.classList.add('message', 'user-message');
        conversation.appendChild(currentUserMessage);
    } else {
        currentUserMessage.textContent = `You: ${message}`;
    }

    // Handle typed messages
    if (sentUserMessage && message === '(item sent)') {
        sentUserMessage = false;
        currentUserMessage.textContent = `You: ${sentUserMessageContent}`;
        sentUserMessageContent = null;
    }

    scrollToBottom();

    if (isFinal) {
        currentUserMessage = null;
    }
}

// Update bot message by modifying the previous message
function updateBotMessage(newText, isFinal = false) {
    if (!currentBotMessage) {
        currentBotMessage = document.createElement('div');
        currentBotMessage.classList.add('message', 'bot-message');
        conversation.appendChild(currentBotMessage);
    }
    currentBotMessage.textContent = `Assistant: ${newText}`;
    scrollToBottom();

    if (isFinal) {
        currentBotMessage = null;
    }
}

// Scroll to bottom when new message is added
function scrollToBottom() {
    conversation.scrollTop = conversation.scrollHeight;
}

// Enable and disable conversation mode
function toggleConversationMode() {
    conversationMode = !conversationMode;
    toggleButton.classList.toggle('active', conversationMode);

    if (conversationMode) {
        startRecording();
    } else {
        stopRecording();
    }
}

// Start recording mic input
async function startRecording() {
    await wavRecorder.begin();
    await wavRecorder.record((data) => {
        socket.emit('audioInput', data.mono);
    });
}

// Stop recording mic input
async function stopRecording() {
    await wavRecorder.pause();
    await wavRecorder.end();
    socket.emit('stopRecording');
}

// Socket Events

// Handle display of user messages (transcriptions)
socket.on('displayUserMessage', ({ text, isFinal }) => {
    displayUserMessage(text, isFinal);
});

// Handle updates to bot messages
socket.on('conversationUpdate', ({ text, isFinal }) => {
    updateBotMessage(text, isFinal);
});

// Receive audio response from server
socket.on('audioStream', (arrayBuffer, id) => {
    if (arrayBuffer && arrayBuffer.byteLength > 0) {
        const int16Array = new Int16Array(arrayBuffer);
        wavStreamPlayer.add16BitPCM(int16Array, id);
    } else {
        console.warn("Received empty or invalid audio data.");
    }
});

// Handle conversation interruption (e.g., when user starts speaking)
socket.on('conversationInterrupted', async () => {
    const trackSampleOffset = await wavStreamPlayer.interrupt();

    if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        socket.emit('cancelResponse', { trackId, offset });
    }
});

// Select conversation when server creates a new one automatically
socket.on('conversationCreated', async ({ id }) => {
    await selectConversation(id);
});

// Chat History

// Load chat history from server
async function loadChatHistory() {
    const res = await fetch('/conversations');
    const chats = await res.json();
    chatHistory.innerHTML = '';
    chats.forEach((chat) => {
        const li = document.createElement('li');
        li.textContent = chat.title;
        li.dataset.id = chat.id;
        li.addEventListener('click', () => selectConversation(chat.id));
        const del = document.createElement('button');
        del.textContent = '✕';
        del.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteConversation(chat.id);
        });
        li.appendChild(del);
        if (chat.id === activeConversationId) li.classList.add('active');
        chatHistory.appendChild(li);
    });
}

// Select a conversation from the history
async function selectConversation(id) {
    activeConversationId = id;
    socket.emit('setConversation', id);
    const res = await fetch(`/conversations/${id}`);
    const convo = await res.json();
    conversation.innerHTML = '';
    convo.messages.forEach((msg) => {
        if (msg.role === 'user') {
            displayUserMessage(msg.content, true);
        } else {
            updateBotMessage(msg.content, true);
        }
    });
    loadChatHistory();
}

// Create a new chat conversation
async function createNewChat() {
    const res = await fetch('/conversations', { method: 'POST' });
    const convo = await res.json();
    await selectConversation(convo.id);
}

// Delete a conversation
async function deleteConversation(id) {
    await fetch(`/conversations/${id}`, { method: 'DELETE' });
    if (id === activeConversationId) {
        conversation.innerHTML = '';
        activeConversationId = null;
    }
    loadChatHistory();
}