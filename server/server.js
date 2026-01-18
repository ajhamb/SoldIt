const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const socketHandler = require('./socketHandler');
const fs = require('fs');
const path = require('path');

const app = express();
// --- LOGGING SETUP ---
const logFile = fs.createWriteStream(path.join(__dirname, 'logfile.txt'), { flags: 'a' });
const originalLog = console.log;
const originalError = console.error;

function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

console.log = function (...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    const logLine = `[${getTimestamp()}] ${msg}`;
    logFile.write(logLine + '\n');
    // originalLog.apply(console, args); // DISABLED: Log only to file
};

console.error = function (...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    const logLine = `[${getTimestamp()}] [ERROR] ${msg}`;
    logFile.write(logLine + '\n');
    // originalError.apply(console, args); // DISABLED: Log only to file
};

console.log("--- SERVER STARTUP ---");

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

// --- SERVE FRONTEND ---
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    // Catch-all to serve index.html for client-side routing
    // Express 5 requires named parameters for wildcards
    app.get('/:path*', (req, res) => {
        if (!req.path.startsWith('/socket.io')) {
            res.sendFile(path.join(clientDistPath, 'index.html'));
        }
    });
}

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
