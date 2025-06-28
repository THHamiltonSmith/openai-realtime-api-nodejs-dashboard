# OpenAI Realtime API Node.js Dashboard

The documentation provided by OpenAI was pretty average in providing an easy way to test out the new realtime api with a working frontend, so I thought I would take a crack at making one.

The app works as a chatbot utilising the new realtime websocket system to have as minimal delay as possible. You can either type messages to the chatbot, or enable 'Conversation Mode' to simulate a realtime conversation. Utilises socket.io websockets to handle server-to-client communication.

## Feature Overview

-   Real-Time Conversation: Chat with an AI assistant in real-time. Customise to your liking
-   Audio Transcription: Transcribe user input via voice.
-   Audio Playback: The assistant speaks responses using the integrated audio streaming.
-   Responsive User Interface: A simple, user-friendly chat interface.
-   Toggle Voice Mode: Enable/disable conversation mode to switch between text and voice input.

## Demo

Include a screenshot showing the app interface

## Technologies Used

-   Node.js: Backend server for handling API calls and Socket.io connections.
-   Express.js: Web framework for serving static files and handling HTTP requests.
-   Socket.io: Real-time, bidirectional communication between the client and server.
-   OpenAI Realtime API: Provides AI capabilities for real-time conversation and speech synthesis.
-   JavaScript: Used for both server and client-side logic.
-   HTML/CSS: Frontend structure and styling (with EJS).

## Getting Started

### Prerequisites

-   Node.js (v14.x or later)
-   npm or yarn
-   An OpenAI API key (with access to the Realtime API)

### Installation

1. Clone the Repository

```bash
git clone https://github.com/THHamiltonSmith/openai-realtime-api-nodejs-dashboard.git
cd openai-realtime-api-nodejs-dashboard
```

2. Install Dependencies

```bash
npm install
```

3. Set Up Environment Variables
   Create a .env file in the root directory and add your OpenAI API key:

```bash
OPENAI_API_KEY=your_openai_api_key
```

4. Run the Application (Defaults on port 3000)

```bash
npm start
```

Or for development with live reloading, use nodemon:

```bash
npm run dev
```

5. Access the Application
   Open your browser and navigate to http://localhost:3000.

## File Structure

```bash
openai-realtime-api-nodejs-dashboard/
|
|-- public/ # Frontend files
| |-- /wavtools # Assets for speech recognition/synthesis.
| |-- dashboard.js # Client-side JavaScript
| `-- style.css # Styling for the application
|
|-- views/ # Frontend HTML files
|  -- index.ejs 
|
|-- .env # Environment variables (not included in version control)
|-- server.js # Main server file
|-- package.json # Project metadata and dependencies
`-- README.md # Project documentation
```

## Usage

-   Chat Interaction: Type a message in the input field and press "Send" or use the microphone button
    to enable/disable voice conversation mode.
-   Audio Playback: The assistant will speak responses if voice output is enabled (may need to check Chrome settings).
-   Responsive Display: The conversation log updates in real-time, displaying both user input and
    assistant responses.

## Customisation

-   Update Instructions: Modify server.js to customise the instructions given to the AI. Update any other settings to your preference.  
```js
client.updateSession({
        instructions: 'You are a helpful, english speaking assistant.',
        voice: 'alloy',
        turn_detection: { type: 'server_vad', threshold: 0.3 },
        output_audio: { model: 'audio-davinci', format: 'pcm' },
        input_audio_transcription: { model: 'whisper-1' },
    });
```
-   Styling: Change the style.css file to update the appearance of the chat interface.

## Troubleshooting

-   Server Errors: Ensure the OpenAI API key is valid and that your environment variables are
    correctly set.
-   Audio Issues: Verify your browser supports audio playback on localhost.

## Contributing

Contributions are welcome! If you'd like to improve the code or add new features, please submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.