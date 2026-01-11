const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const socketHandler = require('./socketHandler');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for MVP
        methods: ["GET", "POST"]
    }
});

// In-memory data store
const data = {
    leagues: new Map(),
};

io.on('connection', (socket) => {
    socketHandler(io, socket, data);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log("Stopping server...");
    server.close(() => {
        console.log("Server stopped. Port 3000 released.");
        process.exit(0);
    });
});
