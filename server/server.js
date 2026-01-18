const express = require('express');
require('dotenv').config();
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const socketHandler = require('./socketHandler');
const fs = require('fs');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');

const app = express();

// --- SUPABASE LOGGING SETUP ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- LOGGING SETUP ---
const logFile = fs.createWriteStream(path.join(__dirname, 'logfile.txt'), { flags: 'a' });

function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

async function remoteLog(msg) {
    if (supabase) {
        try {
            const { error } = await supabase.from('logs').insert([{ log: msg }]);
            if (error) originalError.apply(console, [`Supabase Log Error: ${error.message}`]);
        } catch (e) {
            // Silently fail or use originalError if we really want to know
        }
    }
}

const originalLog = console.log;
const originalError = console.error;

function formatArgs(args) {
    return args.map(arg => {
        if (arg instanceof Error) {
            return `${arg.message}\n${arg.stack}`;
        }
        return typeof arg === 'object' ? JSON.stringify(arg) : arg;
    }).join(' ');
}

console.log = function (...args) {
    const msg = formatArgs(args);
    const logLine = `[${getTimestamp()}] ${msg}`;
    logFile.write(logLine + '\n');
    remoteLog(logLine);
    originalLog.apply(console, args);
};

console.error = function (...args) {
    const msg = formatArgs(args);
    const logLine = `[${getTimestamp()}] [ERROR] ${msg}`;
    logFile.write(logLine + '\n');
    remoteLog(logLine);
    originalError.apply(console, args);
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

// In-memory data store (hydrated from Supabase on startup)
const data = {
    leagues: new Map(),
};

async function hydrateFromDB() {
    if (supabase) {
        console.log("--- HYDRATING FROM SUPABASE ---");
        try {
            const { data: dbLeagues, error } = await supabase.from('leagues').select('*');
            if (error) {
                console.error("Hydration failed:", error.message);
                return;
            }
            if (dbLeagues) {
                dbLeagues.forEach(row => {
                    data.leagues.set(row.code, row.data);
                });
                console.log(`Successfully hydrated ${dbLeagues.length} leagues.`);
            }
        } catch (e) {
            console.error("Hydration error:", e);
        }
    } else {
        console.log("Supabase not configured. Starting with empty memory.");
    }
}

io.on('connection', (socket) => {
    socketHandler(io, socket, data, supabase);
});

const PORT = process.env.PORT || 3000;

// --- SERVE FRONTEND ---
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    // Catch-all to serve index.html for client-side routing
    app.get(/^(?!\/socket\.io).*/, (req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

server.listen(PORT, async () => {
    await hydrateFromDB();
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
