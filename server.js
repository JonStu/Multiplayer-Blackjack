const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Load configuration based on environment
const config = require(process.env.NODE_ENV === 'production' 
    ? './config.production.js' 
    : './config.development.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, config.socketIoSettings);

// Middleware
app.use(cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());
app.use(config.baseUrl, express.static('public'));

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Ensure users.json exists
async function ensureUsersFile() {
    try {
        await fs.access(USERS_FILE);
    } catch {
        await fs.writeFile(USERS_FILE, '[]');
    }
}

// Read users from file
async function readUsers() {
    await ensureUsersFile();
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
}

// Write users to file
async function writeUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// Find user by username
async function findUser(username) {
    const users = await readUsers();
    return users.find(user => user.username === username);
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// Register endpoint
app.post(`${config.baseUrl}/register`, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Check if user exists
        const existingUser = await findUser(username);
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const users = await readUsers();
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword,
            chips: 1000 // Starting chips
        };
        
        users.push(newUser);
        await writeUsers(users);

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

// Login endpoint
app.post(`${config.baseUrl}/login`, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user
        const user = await findUser(username);
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Create token
        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
        res.json({ token, username: user.username, chips: user.chips });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// Update chips endpoint
app.post(`${config.baseUrl}/update-chips`, authenticateToken, async (req, res) => {
    try {
        const { username, chips } = req.body;
        const users = await readUsers();
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found' });
        }

        users[userIndex].chips = chips;
        await writeUsers(users);
        res.json({ message: 'Chips updated successfully' });
    } catch (error) {
        console.error('Update chips error:', error);
        res.status(500).json({ message: 'Error updating chips' });
    }
});

// Socket.IO game logic
const games = new Map();
const playerStates = new Map();

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('joinGame', (username) => {
        playerStates.set(socket.id, { username, ready: false });
        socket.join('game-room');
        io.to('game-room').emit('playerJoined', username);
    });

    socket.on('ready', (data) => {
        const player = playerStates.get(socket.id);
        if (player) {
            player.ready = true;
            io.to('game-room').emit('playerReady', player.username);
        }
    });

    socket.on('placeBet', (data) => {
        io.to('game-room').emit('betPlaced', {
            username: data.username,
            amount: data.amount
        });
    });

    socket.on('action', (data) => {
        io.to('game-room').emit('playerAction', {
            username: data.username,
            action: data.action
        });
    });

    socket.on('disconnect', () => {
        const player = playerStates.get(socket.id);
        if (player) {
            io.to('game-room').emit('playerLeft', player.username);
            playerStates.delete(socket.id);
        }
    });
});

const PORT = config.port;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
