/**
 * Multiplayer Blackjack Server
 * Handles authentication, game state, and real-time communication
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Server setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Constants
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const PORT = process.env.PORT || 3000;

/**
 * File System Operations
 */
const FileOps = {
    async readUsers() {
        try {
            await fs.access(USERS_FILE);
        } catch {
            await fs.writeFile(USERS_FILE, '[]');
        }
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    },

    async writeUsers(users) {
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    },

    async findUser(username) {
        const users = await this.readUsers();
        return users.find(user => user.username === username);
    }
};

/**
 * Authentication Middleware
 */
const auth = {
    verifyToken(req, res, next) {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch {
            res.status(403).json({ message: 'Invalid token' });
        }
    },

    generateToken(user) {
        return jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
    }
};

/**
 * Authentication Routes
 */
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }

        const existingUser = await FileOps.findUser(username);
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const users = await FileOps.readUsers();
        const newUser = {
            id: Date.now().toString(),
            username,
            password: await bcrypt.hash(password, 10),
            chips: 1000
        };
        
        await FileOps.writeUsers([...users, newUser]);
        res.status(201).json({ message: 'Account created successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }

        const user = await FileOps.findUser(username);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        res.json({
            token: auth.generateToken(user),
            username: user.username,
            chips: user.chips,
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/update-chips', auth.verifyToken, async (req, res) => {
    try {
        const { username, chips } = req.body;
        const users = await FileOps.readUsers();
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found' });
        }

        users[userIndex].chips = chips;
        await FileOps.writeUsers(users);
        res.json({ message: 'Chips updated' });
    } catch (error) {
        console.error('Update chips error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Game State Management
 */
class BlackjackTable {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.deck = new Deck();
        this.dealer = {
            cards: [],
            score: 0
        };
        this.state = 'betting';
        this.currentTurn = null;
        this.dealerTimer = null;
        this.dealerDelay = 3; // seconds between dealer cards
        this.maxPlayers = 5;
    }

    addPlayer(username, socketId) {
        if (this.players.length >= this.maxPlayers) return false;
        
        const position = this.players.length;
        this.players.push({
            username,
            socketId,
            position,
            cards: [],
            bet: 0,
            chips: 1000,
            status: 'active',
            insurance: 0,
            lastBet: 0
        });
        return true;
    }

    removePlayer(socketId) {
        const index = this.players.findIndex(p => p.socketId === socketId);
        if (index !== -1) {
            this.players.splice(index, 1);
            // Reassign positions
            this.players.forEach((p, i) => p.position = i);
            return true;
        }
        return false;
    }

    findPlayer(username) {
        return this.players.find(p => p.username === username);
    }

    getPlayerBySocketId(socketId) {
        return this.players.find(p => p.socketId === socketId);
    }

    startDealerTimer() {
        if (this.dealerTimer) {
            clearTimeout(this.dealerTimer);
        }
        
        // Send initial timer state
        this.broadcastGameState();

        this.dealerTimer = setTimeout(() => {
            this.dealerPlay();
        }, this.dealerDelay * 1000);
    }

    dealerPlay() {
        if (this.state !== 'dealer') return;

        const dealerScore = this.calculateScore(this.dealer.cards);
        if (dealerScore < 17) {
            this.dealer.cards.push(this.deck.drawCard());
            this.dealer.score = this.calculateScore(this.dealer.cards);
            
            // Broadcast state with next timer
            this.broadcastGameState();
            
            // Continue dealer play after delay
            this.startDealerTimer();
        } else {
            this.endRound();
        }
    }

    startNewRound() {
        this.state = 'betting';
        this.currentTurn = null;
        this.dealer = {
            cards: [],
            score: 0
        };
        
        // Reset player states but keep their chips
        this.players.forEach(player => {
            player.cards = [];
            player.score = 0;
            player.bet = 0;
            player.insurance = 0;
            player.status = 'betting';
        });
    }

    dealInitialCards() {
        this.state = 'playing';
        
        // Deal two cards to each player who bet
        for (let i = 0; i < 2; i++) {
            for (const player of this.players) {
                if (player.bet > 0) {
                    const card = this.deck.drawCard();
                    player.cards.push(card);
                }
            }
            // Deal to dealer
            const card = this.deck.drawCard();
            this.dealer.cards.push(card);
        }

        // Set scores
        for (const player of this.players) {
            player.score = this.calculateScore(player.cards);
        }
        this.dealer.score = this.calculateScore(this.dealer.cards);

        // Find first player who placed a bet
        const firstPlayer = this.players.find(p => p.bet > 0);
        if (firstPlayer) {
            this.currentTurn = firstPlayer.username;
        }
    }

    placeBet(socketId, amount) {
        const player = this.getPlayerBySocketId(socketId);
        if (!player) return false;

        // Can't bet if cards are already dealt
        if (this.dealer.cards.length > 0) {
            return false;
        }

        // Can't bet if player already has a bet
        if (player.bet > 0) {
            return false;
        }

        // Validate bet amount
        if (amount <= 0 || amount > player.chips) {
            return false;
        }

        player.bet = amount;
        player.chips -= amount;
        player.lastBet = amount;
        return true;
    }

    handleAction(username, action) {
        const player = this.findPlayer(username);
        if (!player || this.state !== 'playing' || this.currentTurn !== username) {
            return false;
        }

        switch (action) {
            case 'hit':
                const card = this.deck.drawCard();
                player.cards.push(card);
                player.score = this.calculateScore(player.cards);
                if (player.score > 21) {
                    player.status = 'bust';
                    this.nextTurn(player);
                }
                break;
            case 'stand':
                player.status = 'stand';
                this.nextTurn(player);
                break;
            default:
                return false;
        }
        return true;
    }

    nextTurn(currentPlayer) {
        const activePlayers = this.players.filter(p => p.bet > 0);
        const currentPlayerIndex = activePlayers.findIndex(p => p.username === currentPlayer.username);
        
        if (currentPlayerIndex === activePlayers.length - 1 || !activePlayers.some(p => p.status === 'active')) {
            this.startDealerTurn();
        } else {
            const nextPlayer = activePlayers.find(p => 
                p.status === 'active' && 
                activePlayers.indexOf(p) > currentPlayerIndex
            );
            if (nextPlayer) {
                this.currentTurn = nextPlayer.username;
            } else {
                this.startDealerTurn();
            }
        }
    }

    startDealerTurn() {
        this.state = 'dealer';
        this.currentTurn = null;
        this.startDealerTimer();
    }

    endRound() {
        this.state = 'roundEnd';
        const dealerScore = this.calculateScore(this.dealer.cards);
        const dealerBust = dealerScore > 21;

        for (const player of this.players) {
            if (player.bet === 0) continue;

            // Handle insurance bets
            if (player.insurance > 0) {
                if (dealerScore === 21 && this.dealer.cards.length === 2) {
                    player.chips += player.insurance * 3;
                }
            }

            // Handle main bets
            if (player.status === 'bust') {
                // Player loses
                continue;
            } else if (dealerBust || player.score > dealerScore) {
                // Player wins
                player.chips += player.bet * 2;
            } else if (player.score === dealerScore) {
                // Push
                player.chips += player.bet;
            }
            // Otherwise player loses

            player.bet = 0;
            player.insurance = 0;
        }

        this.broadcastGameState();
    }

    calculateScore(cards) {
        let score = 0;
        let aces = 0;

        for (const card of cards) {
            if (card.value === 'A') {
                aces++;
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                score += 10;
            } else {
                score += parseInt(card.value);
            }
        }

        for (let i = 0; i < aces; i++) {
            if (score + 11 <= 21) {
                score += 11;
            } else {
                score += 1;
            }
        }

        return score;
    }

    getGameState() {
        const state = {
            tableId: this.id,
            players: this.players.map(p => ({
                username: p.username,
                position: p.position,
                cards: p.cards,
                score: this.calculateScore(p.cards),
                bet: p.bet,
                chips: p.chips,
                status: p.status
            })),
            dealer: {
                cards: this.dealer.cards,
                score: this.calculateScore(this.dealer.cards)
            },
            state: this.state,
            currentTurn: this.currentTurn
        };

        if (this.state === 'dealer') {
            state.nextCardTimer = this.dealerDelay;
        }

        return state;
    }

    broadcastGameState() {
        io.to(this.id).emit('gameStateUpdate', this.getGameState());
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.suits = ['♠', '♥', '♣', '♦'];
        this.values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        for (const suit of this.suits) {
            for (const value of this.values) {
                this.cards.push({ suit, value });
            }
        }

        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    drawCard() {
        return this.cards.pop();
    }
}

const GameState = {
    tables: new Map(), // Multiple game tables
    players: new Map(), // Player socket mappings
    
    createTable(tableId) {
        this.tables.set(tableId, new BlackjackTable(tableId));
        return this.tables.get(tableId);
    },

    findTableBySocket(socketId) {
        for (const table of this.tables.values()) {
            const player = table.players.find(p => p.socketId === socketId);
            if (player) return table;
        }
        return null;
    }
};

/**
 * Socket.IO Event Handlers
 */
io.on('connection', (socket) => {
    socket.on('joinGame', ({ username, tableId }) => {
        let table = GameState.tables.get(tableId);
        if (!table) {
            table = GameState.createTable(tableId);
        }

        if (table.addPlayer(username, socket.id)) {
            socket.join(tableId);
            io.to(tableId).emit('playerJoined', {
                joiner: username,
                players: table.players
            });
            socket.emit('gameStateUpdate', table.getGameState());
        }
    });

    socket.on('disconnect', () => {
        const table = GameState.findTableBySocket(socket.id);
        if (table) {
            const player = table.players.find(p => p.socketId === socket.id);
            if (player && table.removePlayer(socket.id)) {
                io.to(table.id).emit('playerLeft', {
                    username: player.username,
                    players: table.players
                });
                table.broadcastGameState();
            }
        }
    });

    socket.on('placeBet', ({ amount }) => {
        const table = GameState.findTableBySocket(socket.id);
        if (table && table.placeBet(socket.id, amount)) {
            const player = table.players.find(p => p.socketId === socket.id);
            io.to(table.id).emit('betPlaced', {
                username: player.username,
                amount,
                tableState: table.getGameState()
            });

            // Check if all players have bet
            const allBet = table.players.every(p => p.bet > 0 || p.chips === 0);
            if (allBet) {
                table.dealInitialCards();
                table.broadcastGameState();
            }
        }
    });

    socket.on('playerAction', ({ action }) => {
        const table = GameState.findTableBySocket(socket.id);
        const player = table?.players.find(p => p.socketId === socket.id);
        if (table && player && table.handleAction(player.username, action)) {
            table.broadcastGameState();
        }
    });

    socket.on('startGame', async (data) => {
        const { tableId } = data;
        const table = GameState.tables.get(tableId);
        if (!table) return;

        // Only start if we have at least one player with a bet
        const playersWithBets = table.players.filter(p => p.bet > 0);
        if (playersWithBets.length >= 1) {
            table.dealInitialCards();
            table.broadcastGameState();
        }
    });

    socket.on('startNewGame', async (data) => {
        const { tableId } = data;
        const table = GameState.tables.get(tableId);
        if (!table) return;

        // Reset the table state
        table.startNewRound();
        
        // Broadcast the updated state
        io.to(tableId).emit('gameStateUpdate', table.getGameState());
    });
});

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
