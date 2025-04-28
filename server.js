const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');
const cors = require('cors');
const fs = require('fs');

// Set environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;

console.log(`Server running in ${NODE_ENV} mode`);

const server = http.createServer(app);

// Setup Socket.IO with appropriate CORS for development and production
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    // Add these settings to improve connection reliability
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000
});

// Use CORS middleware for Express
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
}));

// API routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mode: NODE_ENV });
});

// Serve static files from the React app build folder
if (NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, 'build'))) {
    console.log('Serving static files from build directory');
    app.use(express.static(path.join(__dirname, 'build')));
    
    // Handle any requests that don't match the API routes
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        res.sendFile(path.join(__dirname, 'build', 'index.html'));
    });
} else {
    console.log('No build folder found - in development mode, proxy requests to React dev server');
    // In development without build folder, you'll need to run the React dev server separately
    // or build the React app first
    app.get('/', (req, res) => {
        res.send('Backend server is running. Please build the React app or use the combined development setup.');
    });
}

// Log startup info
console.log(`Starting server in ${NODE_ENV} mode on port ${PORT}`);

// Socket.io connection handling
const userSocketMap = {};
function getAllConnectedClients(roomId) {
    // Map
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        console.log(`User ${username} (${socket.id}) joining room ${roomId}`);
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        console.log(`Clients in room ${roomId}:`, clients);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        console.log(`Code changed in room ${roomId}`);
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        console.log(`Syncing code to ${socketId}`);
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.LANGUAGE_CHANGE, ({ roomId, language }) => {
        console.log(`Language changed in room ${roomId} to ${language}`);
        socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, { language });
    });

    socket.on(ACTIONS.SYNC_LANGUAGE, ({ socketId, language }) => {
        console.log(`Syncing language to ${socketId}: ${language}`);
        io.to(socketId).emit(ACTIONS.LANGUAGE_CHANGE, { language });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        console.log(`User ${userSocketMap[socket.id]} (${socket.id}) disconnecting from rooms:`, rooms);
        delete userSocketMap[socket.id];
        socket.leave();
    });
    
    socket.on('disconnect', (reason) => {
        console.log(`Socket ${socket.id} disconnected due to ${reason}`);
    });
    
    socket.on('error', (error) => {
        console.error(`Socket ${socket.id} error:`, error);
    });
});

// Add error handling for the server
server.on('error', (error) => {
    console.error('Server error:', error);
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
