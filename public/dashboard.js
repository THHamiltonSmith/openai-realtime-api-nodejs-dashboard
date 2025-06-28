// dashboard.js

import { WavRecorder, WavStreamPlayer } from '/wavtools/index.js';
const socket = io();

// DOM Elements
const conversation = document.getElementById('conversation');
const userInput = document.getElementById('userInput');
const submitButton = document.getElementById('submitMessage');
const toggleButton = document.getElementById('toggle-button');

// Variables
let conversationMode = false;
let currentBotMessage = null;
let currentUserMessage = null;

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
