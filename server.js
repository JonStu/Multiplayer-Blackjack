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
const crypto = require('crypto');
require('dotenv').config();

// Server setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["https://blackjack.jonstu.dev", "http://blackjack.jonstu.dev"],
        methods: ["GET", "POST"],
        credentials: true
    },
    path: '/socket.io/',
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Middleware
app.use(cors({
    origin: ["https://blackjack.jonstu.dev", "http://blackjack.jonstu.dev"],
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Constants
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const PORT = process.env.PORT || 3000;

/**
 * Provably Fair System
 */
const ProvablyFair = {
    generateServerSeed() {
        return crypto.randomBytes(32).toString('hex');
    },

    generateHash(serverSeed, clientSeed) {
        return crypto.createHmac('sha256', serverSeed)
            .update(clientSeed)
            .digest('hex');
    },

    provablyFairShuffle(array, hash) {
        const result = [...array];
        let hashIndex = 0;
        
        for (let i = result.length - 1; i > 0; i--) {
            // Use 4 characters from hash for more randomness
            const hexSlice = hash.slice(hashIndex, hashIndex + 4);
            const randomValue = parseInt(hexSlice, 16);
            const j = randomValue % (i + 1);
            
            [result[i], result[j]] = [result[j], result[i]];
            
            // Move hash index by 4 and wrap around
            hashIndex = (hashIndex + 4) % (hash.length - 3);
        }
        
        return result;
    }
};

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
        this.deck = null;
        this.dealer = {
            cards: [],
            score: 0
        };
        this.state = 'betting';
        this.currentTurn = null;
        this.dealerTimer = null;
        this.dealerDelay = 3;
        this.maxPlayers = 5;
        this.io = io;
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
            lastBet: 0,
            canDoubleDown: false,
            finished: false
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
            const card = this.deck.drawCard();
            this.dealer.cards.push(card);
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
        // Check if any players have placed bets
        const playersWithBets = this.players.filter(player => player.bet > 0);
        if (playersWithBets.length === 0) {
            console.log('[Server] Cannot start round: no players have placed bets');
            return false;
        }

        // Reset game state
        this.state = 'betting';
        this.currentTurn = null;
        this.dealer = {
            cards: [],
            score: 0
        };
        
        // Reset player states for those who haven't bet
        this.players.forEach(player => {
            if (player.bet === 0) {
                player.cards = [];
                player.score = 0;
                player.finished = false;
                player.insuranceBet = 0;
                player.result = null;
            }
        });

        // Create new deck with fresh seeds
        const clientSeed = crypto.randomBytes(32).toString('hex');
        const serverSeed = crypto.randomBytes(32).toString('hex');
        this.deck = new Deck(serverSeed, clientSeed);
        
        // Broadcast verification data to all players
        this.io.to(this.id).emit('verificationData', this.deck.getVerificationData());
        
        // Only deal cards if we have players with bets
        if (playersWithBets.length > 0) {
            this.dealInitialCards();
            this.state = 'playing';
            this.broadcastGameState();
            return true;
        }
        return false;
    }

    dealInitialCards() {
        // Verify we have players with bets before dealing
        const activePlayers = this.players.filter(player => player.bet > 0);
        if (activePlayers.length === 0) {
            console.log('[Server] No players with bets to deal cards to');
            return false;
        }

        // Deal two cards to each player who has placed a bet
        for (let i = 0; i < 2; i++) {
            activePlayers.forEach(player => {
                const card = this.deck.drawCard();
                player.cards.push(card);
                player.score = this.calculateScore(player.cards);
            });

            // Deal to dealer
            const dealerCard = this.deck.drawCard();
            this.dealer.cards.push(dealerCard);
            this.dealer.score = this.calculateScore(this.dealer.cards);
        }

        // Set the first active player's turn
        const playersInOrder = this.getPlayersInTurnOrder();
        if (playersInOrder.length > 0) {
            this.currentTurn = playersInOrder[0].username;
        } else {
            console.log('[Server] No active players to set turn');
            return false;
        }

        return true;
    }

    getPlayersInTurnOrder() {
        // Only include players who have placed bets
        return this.players.filter(player => player.bet > 0);
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

    handlePlayerAction(socket, action) {
        const player = this.players.find(p => p.socketId === socket.id);
        if (!player) return false;
        
        // Verify it's the player's turn
        if (this.currentTurn !== player.username) {
            socket.emit('gameMessage', {
                type: 'error',
                message: '❌ Not your turn!'
            });
            return false;
        }

        switch (action) {
            case 'hit':
                const card = this.deck.drawCard();
                player.cards.push(card);
                player.score = this.calculateScore(player.cards);
                
                this.io.to(this.id).emit('gameMessage', {
                    type: 'info',
                    message: `🎯 ${player.username} hits and draws ${this.getCardDescription(card)}`
                });

                if (player.score > 21) {
                    player.finished = true;
                    this.io.to(this.id).emit('gameMessage', {
                        type: 'error',
                        message: `💥 ${player.username} busts with ${player.score}!`
                    });
                    this.nextTurn();
                }
                break;

            case 'stand':
                player.finished = true;
                this.io.to(this.id).emit('gameMessage', {
                    type: 'info',
                    message: `✋ ${player.username} stands with ${player.score}`
                });
                this.nextTurn();
                break;

            case 'doubleDown':
                if (player.chips >= player.bet && player.cards.length === 2) {
                    const additionalBet = player.bet;
                    player.chips -= additionalBet;
                    player.bet += additionalBet;
                    
                    const card = this.deck.drawCard();
                    player.cards.push(card);
                    player.score = this.calculateScore(player.cards);
                    player.finished = true;

                    this.io.to(this.id).emit('gameMessage', {
                        type: 'info',
                        message: `💰 ${player.username} doubles down! Draws ${this.getCardDescription(card)}`
                    });

                    if (player.score > 21) {
                        this.io.to(this.id).emit('gameMessage', {
                            type: 'error',
                            message: `💥 ${player.username} busts with ${player.score}!`
                        });
                    }
                    this.nextTurn();
                }
                break;
        }

        this.broadcastGameState();
        return true;
    }

    nextTurn() {
        // Find all active players with bets
        const activePlayers = this.players.filter(p => p.bet > 0 && !p.finished);
        if (activePlayers.length === 0) {
            console.log('[Server] No active players left, moving to dealer turn');
            this.startDealerTurn();
            return;
        }

        // Find current player index
        const currentPlayerIndex = activePlayers.findIndex(p => p.username === this.currentTurn);
        
        // Find next unfinished player
        let nextPlayerIndex = currentPlayerIndex === -1 ? 0 : (currentPlayerIndex + 1) % activePlayers.length;
        let nextPlayer = null;
        let checkedCount = 0;

        while (checkedCount < activePlayers.length) {
            const candidatePlayer = activePlayers[nextPlayerIndex];
            const score = this.calculateScore(candidatePlayer.cards);
            
            if (score <= 21 && !candidatePlayer.finished) {
                nextPlayer = candidatePlayer;
                break;
            }
            
            nextPlayerIndex = (nextPlayerIndex + 1) % activePlayers.length;
            checkedCount++;
        }

        // If we found a valid next player, update turn
        if (nextPlayer) {
            this.currentTurn = nextPlayer.username;
            console.log('[Server] Next turn:', nextPlayer.username);
            
            // Notify all players about whose turn it is
            this.io.to(this.id).emit('playerTurn', {
                currentPlayer: nextPlayer.username,
                isYourTurn: nextPlayer.socketId === this.currentTurn
            });
            
            // Enable double down if eligible
            if (nextPlayer.cards.length === 2 && nextPlayer.chips >= nextPlayer.bet) {
                nextPlayer.canDoubleDown = true;
            }
        } else {
            // If no valid players found, move to dealer turn
            console.log('[Server] No valid players left, moving to dealer turn');
            this.startDealerTurn();
        }

        // Broadcast updated game state
        this.broadcastGameState();
    }

    startDealerTurn() {
        this.state = 'dealer';
        this.currentTurn = null;
        
        // Notify all players that dealer turn is starting
        this.io.to(this.id).emit('gameMessage', {
            type: 'dealer',
            message: '🎲 Dealer\'s turn beginning...'
        });
        
        // Start dealer turn after a short delay
        setTimeout(() => this.handleDealerTurn(), 1000);
    }

    handleDealerTurn() {
        if (this.state !== 'dealer') return;

        // Reveal dealer's hole card
        this.io.to(this.id).emit('gameMessage', {
            type: 'dealer',
            message: `🎲 Dealer reveals hidden card: ${this.getCardDescription(this.dealer.cards[1])}`
        });

        // Start the dealer's play sequence
        this.startDealerTimer();
    }

    playDealerTurn() {
        console.log('[Dealer] Starting turn with cards:', this.dealer.cards);
        
        // Reset dealer state
        this.state = 'dealer';
        const initialScore = this.calculateScore(this.dealer.cards);
        console.log('[Dealer] Initial score:', initialScore);
        
        // Emit initial dealer turn event to reveal cards
        this.io.to(this.id).emit('dealerTurn', {
            dealerHand: this.dealer.cards,
            dealerScore: initialScore,
            debug: `Starting dealer turn with score ${initialScore}`
        });

        // Start dealer's play sequence after 1 second
        setTimeout(() => this.dealerPlaySequence(), 1000);
    }

    dealerPlaySequence() {
        const dealerScore = this.calculateScore(this.dealer.cards);
        console.log('[Dealer] Current score:', dealerScore);

        // Emit initial dealer score
        this.io.to(this.id).emit('dealerTurn', {
            dealerHand: this.dealer.cards,
            message: `Dealer reveals their hand... Current score: ${dealerScore}`,
            debug: `Starting dealer sequence with score ${dealerScore}`
        });

        // If dealer has blackjack, end immediately
        if (dealerScore === 21 && this.dealer.cards.length === 2) {
            setTimeout(() => {
                this.io.to(this.id).emit('dealerStand', {
                    message: "Dealer has Blackjack!",
                    debug: "Dealer has natural blackjack"
                });
                this.endRound();
            }, this.dealerDelay * 1000);
            return;
        }

        // Schedule next dealer action
        setTimeout(() => this.dealerDrawOrStand(), this.dealerDelay * 1000);
    }

    dealerDrawOrStand() {
        const dealerScore = this.calculateScore(this.dealer.cards);
        
        // Dealer must draw on 16 or less, stand on 17 or more
        if (dealerScore < 17) {
            const newCard = this.deck.drawCard();
            this.dealer.cards.push(newCard);
            const newScore = this.calculateScore(this.dealer.cards);
            const willDrawAgain = newScore < 17;
            
            // Determine appropriate message based on the new card and score
            let message;
            if (newScore > 21) {
                message = `Dealer draws ${this.getCardDescription(newCard)}... Bust with ${newScore}!`;
            } else if (willDrawAgain) {
                message = `Dealer draws ${this.getCardDescription(newCard)}... Must draw again at ${newScore}.`;
            } else {
                message = `Dealer draws ${this.getCardDescription(newCard)}... Stands at ${newScore}.`;
            }

            this.io.to(this.id).emit('dealerCard', {
                card: newCard,
                dealerHand: this.dealer.cards,
                willDrawAgain,
                message,
                debug: `Drew card, new score: ${newScore}`
            });

            if (newScore > 21) {
                // Dealer busts
                setTimeout(() => {
                    this.io.to(this.id).emit('dealerStand', {
                        message: "Dealer busts! All remaining players win.",
                        debug: "Dealer busted"
                    });
                    this.endRound();
                }, this.dealerDelay * 1000);
            } else if (willDrawAgain) {
                // Schedule next draw
                setTimeout(() => this.dealerDrawOrStand(), this.dealerDelay * 1000);
            } else {
                // Dealer stands
                setTimeout(() => {
                    this.io.to(this.id).emit('dealerStand', {
                        message: `Dealer stands at ${newScore}.`,
                        debug: "Dealer stands"
                    });
                    this.endRound();
                }, this.dealerDelay * 1000);
            }
        } else {
            // Dealer stands
            this.io.to(this.id).emit('dealerStand', {
                message: `Dealer stands at ${dealerScore}.`,
                debug: "Dealer stands"
            });
            this.endRound();
        }
    }

    getCardDescription(card) {
        const valueNames = {
            'A': 'Ace',
            'K': 'King',
            'Q': 'Queen',
            'J': 'Jack',
            '10': 'Ten',
            '9': 'Nine',
            '8': 'Eight',
            '7': 'Seven',
            '6': 'Six',
            '5': 'Five',
            '4': 'Four',
            '3': 'Three',
            '2': 'Two'
        };
        
        const suitNames = {
            '♠': 'Spades',
            '♥': 'Hearts',
            '♣': 'Clubs',
            '♦': 'Diamonds'
        };

        return `${valueNames[card.value] || card.value} of ${suitNames[card.suit]}`;
    }

    endRound() {
        console.log('[Dealer] Ending round');
        
        // Calculate results and update chips
        const dealerScore = this.calculateScore(this.dealer.cards);
        const dealerBust = dealerScore > 21;
        
        this.players.forEach(player => {
            if (player.bet > 0) {
                const playerScore = this.calculateScore(player.cards);
                const playerBust = playerScore > 21;
                
                // Determine winner
                let result;
                let message;
                
                if (playerBust) {
                    result = 'lose';
                    message = `💥 ${player.username} loses with bust (${playerScore})`;
                } else if (dealerBust) {
                    result = 'win';
                    message = `🎉 ${player.username} wins! Dealer bust with ${dealerScore}`;
                    player.chips += player.bet * 2; // Return bet + winnings
                } else if (playerScore > dealerScore) {
                    result = 'win';
                    message = `🎉 ${player.username} wins with ${playerScore} vs dealer's ${dealerScore}`;
                    player.chips += player.bet * 2; // Return bet + winnings
                } else if (playerScore < dealerScore) {
                    result = 'lose';
                    message = `😢 ${player.username} loses with ${playerScore} vs dealer's ${dealerScore}`;
                } else {
                    result = 'push';
                    message = `🤝 ${player.username} pushes with ${playerScore}`;
                    player.chips += player.bet; // Return bet on push
                }
                
                // Send result message
                this.io.to(this.id).emit('gameMessage', {
                    type: result === 'win' ? 'success' : result === 'push' ? 'info' : 'error',
                    message: message
                });
                
                // Store result for UI
                player.result = result;
            }
        });

        // Broadcast final state
        this.broadcastGameState();

        // Wait a moment before resetting for next round
        setTimeout(() => {
            // Reset game state for next round
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
                player.finished = false;
                player.insuranceBet = 0;
                player.result = null;
                player.canDoubleDown = false;
            });

            // Clear any pending dealer timer
            if (this.dealerTimer) {
                clearTimeout(this.dealerTimer);
                this.dealerTimer = null;
            }

            // Broadcast the reset state
            this.broadcastGameState();
            
            // Prompt for new bets
            this.io.to(this.id).emit('gameMessage', {
                type: 'info',
                message: '🎲 New round! Place your bets!'
            });
        }, 3000); // Wait 3 seconds before starting new round
    }

    dealerPlay() {
        if (this.state !== 'dealer') return;

        const dealerScore = this.calculateScore(this.dealer.cards);
        if (dealerScore < 17) {
            const card = this.deck.drawCard();
            this.dealer.cards.push(card);
            this.dealer.score = this.calculateScore(this.dealer.cards);
            
            // Broadcast new state
            this.broadcastGameState();
            
            // Send dealer action message
            this.io.to(this.id).emit('gameMessage', {
                type: 'dealer',
                message: `🎲 Dealer draws ${this.getCardDescription(card)}`
            });
            
            // Continue dealer play after delay
            this.startDealerTimer();
        } else {
            // Send dealer final score message
            const finalScore = this.calculateScore(this.dealer.cards);
            if (finalScore > 21) {
                this.io.to(this.id).emit('gameMessage', {
                    type: 'dealer',
                    message: `💥 Dealer busts with ${finalScore}!`
                });
            } else {
                this.io.to(this.id).emit('gameMessage', {
                    type: 'dealer',
                    message: `✋ Dealer stands with ${finalScore}`
                });
            }
            
            // End the round after a short delay
            setTimeout(() => this.endRound(), 1000);
        }
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
        return {
            state: this.state,
            dealer: {
                cards: this.dealer.cards,
                score: this.calculateScore(this.dealer.cards)
            },
            players: this.players.map(player => ({
                username: player.username,
                cards: player.cards,
                score: this.calculateScore(player.cards),
                bet: player.bet,
                chips: player.chips,
                status: player.status,
                canDoubleDown: player.canDoubleDown,
                position: player.position
            })),
            currentTurn: this.currentTurn
        };
    }

    startRound() {
        if (this.state !== 'betting') return false;
        
        // Reset table state
        this.deck = new Deck();
        this.dealer.cards = [];
        this.dealer.score = 0;
        
        // Deal initial cards
        for (let i = 0; i < 2; i++) {
            for (const player of this.players) {
                if (player.bet > 0) {
                    player.cards.push(this.deck.drawCard());
                }
            }
            this.dealer.cards.push(this.deck.drawCard());
        }
        
        // Calculate scores and set initial states
        for (const player of this.players) {
            if (player.bet > 0) {
                player.score = this.calculateScore(player.cards);
                player.status = 'playing';
                player.canDoubleDown = player.chips >= player.bet && player.cards.length === 2;
            }
        }
        
        this.dealer.score = this.calculateScore(this.dealer.cards);
        this.state = 'playing';
        
        // Set initial player turn
        const activePlayers = this.players.filter(p => p.bet > 0);
        if (activePlayers.length > 0) {
            this.currentTurn = activePlayers[0].username;
        }
        
        return true;
    }

    broadcastGameState() {
        this.io.to(this.id).emit('gameStateUpdate', this.getGameState());
    }

    determineWinners() {
        const dealerScore = this.calculateScore(this.dealer.cards);
        const dealerHasBlackjack = this.hasBlackjack(this.dealer.cards);
        
        for (const player of this.players) {
            if (!player.cards || player.cards.length === 0) continue;
            
            const playerScore = this.calculateScore(player.cards);
            const playerHasBlackjack = this.hasBlackjack(player.cards);
            let message = '';
            
            // Determine outcome
            if (playerScore > 21) {
                player.chips -= player.bet;
                message = `💥 ${player.username} busts with ${playerScore}! Lost ${player.bet} chips.`;
            } else if (dealerScore > 21) {
                player.chips += player.bet;
                message = `🎉 ${player.username} wins with ${playerScore}! Dealer busted at ${dealerScore}. Won ${player.bet} chips.`;
            } else if (playerHasBlackjack && !dealerHasBlackjack) {
                const blackjackPayout = Math.floor(player.bet * 1.5);
                player.chips += blackjackPayout;
                message = `🎰 Blackjack! ${player.username} wins ${blackjackPayout} chips.`;
            } else if (!playerHasBlackjack && dealerHasBlackjack) {
                player.chips -= player.bet;
                message = `❌ Dealer Blackjack! ${player.username} loses ${player.bet} chips.`;
            } else if (playerScore > dealerScore) {
                player.chips += player.bet;
                message = `🎉 ${player.username} wins with ${playerScore} vs dealer's ${dealerScore}! Won ${player.bet} chips.`;
            } else if (playerScore < dealerScore) {
                player.chips -= player.bet;
                message = `❌ ${player.username} loses with ${playerScore} vs dealer's ${dealerScore}. Lost ${player.bet} chips.`;
            } else {
                message = `🤝 Push! ${player.username} ties with ${playerScore}.`;
            }
            
            // Handle insurance payout if applicable
            if (player.insuranceBet > 0) {
                if (dealerHasBlackjack) {
                    const insurancePayout = player.insuranceBet * 2;
                    player.chips += insurancePayout;
                    message += `\n💰 Insurance pays ${insurancePayout} chips!`;
                } else {
                    message += `\n📉 Insurance lost: ${player.insuranceBet} chips`;
                }
            }
            
            // Emit the result
            this.io.to(this.id).emit('gameMessage', {
                type: playerScore > dealerScore ? 'success' : playerScore < dealerScore ? 'error' : 'info',
                message: message
            });
            
            // Reset bets
            player.bet = 0;
            player.insuranceBet = 0;
            
            // Update player's chips
            this.io.to(player.socketId).emit('updateChips', player.chips);
        }
    }

    hasBlackjack(hand) {
        return this.calculateScore(hand) === 21 && hand.length === 2;
    }

    resetRound() {
        // Reset game state
        this.state = 'betting';
        this.currentTurn = null;
        this.dealer.cards = [];
        
        // Reset all players
        this.players.forEach(player => {
            player.cards = [];
            player.bet = 0;
            player.insuranceBet = 0;
        });

        // Notify clients to reset for new round
        this.io.to(this.id).emit('gameMessage', {
            type: 'info',
            message: '🎲 Ready for new round! Place your bets.'
        });

        // Broadcast the reset state
        this.broadcastGameState();
    }

    async determineWinners() {
        const dealerScore = this.calculateScore(this.dealer.cards);
        const dealerHasBlackjack = this.hasBlackjack(this.dealer.cards);
        
        // Add a small delay before showing results
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        for (const player of this.players) {
            if (!player.cards || player.cards.length === 0) continue;
            
            const playerScore = this.calculateScore(player.cards);
            const playerHasBlackjack = this.hasBlackjack(player.cards);
            let message = '';
            let type = 'info';
            
            // Determine outcome
            if (playerScore > 21) {
                player.chips -= player.bet;
                message = `💥 ${player.username} busts with ${playerScore}! Lost ${player.bet} chips`;
                type = 'error';
            } else if (dealerScore > 21) {
                player.chips += player.bet;
                message = `🎉 ${player.username} wins ${player.bet} chips! (${playerScore} vs Dealer bust)`;
                type = 'success';
            } else if (playerHasBlackjack && !dealerHasBlackjack) {
                const blackjackPayout = Math.floor(player.bet * 1.5);
                player.chips += blackjackPayout;
                message = `🎰 Blackjack! ${player.username} wins ${blackjackPayout} chips!`;
                type = 'success';
            } else if (!playerHasBlackjack && dealerHasBlackjack) {
                player.chips -= player.bet;
                message = `❌ Dealer Blackjack! ${player.username} loses ${player.bet} chips`;
                type = 'error';
            } else if (playerScore > dealerScore) {
                player.chips += player.bet;
                message = `🎉 ${player.username} wins ${player.bet} chips! (${playerScore} vs ${dealerScore})`;
                type = 'success';
            } else if (playerScore < dealerScore) {
                player.chips -= player.bet;
                message = `❌ ${player.username} loses ${player.bet} chips (${playerScore} vs ${dealerScore})`;
                type = 'error';
            } else {
                message = `🤝 Push! ${player.username} ties with ${playerScore}`;
                type = 'info';
            }
            
            // Handle insurance payout if applicable
            if (player.insuranceBet > 0) {
                if (dealerHasBlackjack) {
                    const insurancePayout = player.insuranceBet * 2;
                    player.chips += insurancePayout;
                    message += `\n💰 Insurance pays ${insurancePayout} chips!`;
                } else {
                    message += `\n📉 Insurance lost: ${player.insuranceBet} chips`;
                }
            }
            
            // Emit the result with a delay between each player
            await new Promise(resolve => setTimeout(resolve, 800));
            this.io.to(this.id).emit('gameMessage', { type, message });
            
            // Update player's chips
            this.io.to(player.socketId).emit('updateChips', player.chips);
        }
    }
}

class Deck {
    constructor(serverSeed = null, clientSeed = null) {
        this.cards = [];
        this.suits = ['♠', '♥', '♣', '♦'];
        this.values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        // Always generate new seeds if not provided
        this.serverSeed = serverSeed || ProvablyFair.generateServerSeed();
        this.clientSeed = clientSeed || crypto.randomBytes(32).toString('hex');
        this.nonce = 0;
        this.verificationHash = null;

        // Initialize deck
        for (const suit of this.suits) {
            for (const value of this.values) {
                this.cards.push({ suit, value });
            }
        }

        // Always shuffle on creation
        this.shuffle();
        console.log('\x1b[32m%s\x1b[0m', `[PROVABLY FAIR] Server Seed: ${this.serverSeed}`);
        console.log('\x1b[32m%s\x1b[0m', `[PROVABLY FAIR] Client Seed: ${this.clientSeed}`);
    }

    generateHash() {
        const combinedSeed = `${this.serverSeed}:${this.clientSeed}:${this.nonce}`;
        return crypto.createHash('sha256').update(combinedSeed).digest('hex');
    }

    shuffle() {
        const hash = this.generateHash();
        console.log('\x1b[36m%s\x1b[0m', `[PROVABLY FAIR] Round ${this.nonce} Hash: ${hash}`);
        
        // Fisher-Yates shuffle using the hash as entropy
        for (let i = this.cards.length - 1; i > 0; i--) {
            const hashPart = hash.substring((i % 8) * 2, (i % 8) * 2 + 2);
            const j = Math.floor(parseInt(hashPart, 16) / 256 * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
        
        this.nonce++;
        
        // Log the shuffle for verification
        console.log('[Deck] Shuffled with new seeds:', {
            serverSeed: this.serverSeed.slice(0, 8) + '...',
            clientSeed: this.clientSeed.slice(0, 8) + '...',
            verificationHash: hash.slice(0, 8) + '...',
            firstCard: this.cards[0]
        });
        
        return this.cards;
    }

    drawCard() {
        if (this.cards.length === 0) {
            console.log('\x1b[33m%s\x1b[0m', '[PROVABLY FAIR] Reshuffling deck...');
            this.serverSeed = crypto.randomBytes(32).toString('hex');
            this.shuffle();
        }
        return this.cards.pop();
    }

    getVerificationData() {
        return {
            serverSeed: this.serverSeed,
            clientSeed: this.clientSeed,
            nonce: this.nonce - 1
        };
    }
}

const GameState = {
    tables: new Map(), // Multiple game tables
    players: new Map(), // Player socket mappings
    activeConnections: new Map(), // Track active connections with timestamps
    
    createTable(tableId) {
        const table = new BlackjackTable(tableId);
        this.tables.set(tableId, table);
        return table;
    },

    findTableBySocket(socketId) {
        for (const table of this.tables.values()) {
            if (table.players.some(p => p.socketId === socketId)) {
                return table;
            }
        }
        return null;
    },

    addConnection(socketId, username) {
        this.activeConnections.set(socketId, {
            username,
            lastActive: Date.now(),
            pingCount: 0
        });
    },

    updateActivity(socketId) {
        const connection = this.activeConnections.get(socketId);
        if (connection) {
            connection.lastActive = Date.now();
            connection.pingCount = 0;
        }
    },

    removeConnection(socketId) {
        this.activeConnections.delete(socketId);
        this.players.delete(socketId);
        
        // Remove from any tables
        for (const table of this.tables.values()) {
            table.removePlayer(socketId);
        }
    },

    cleanupInactiveConnections() {
        const now = Date.now();
        const inactivityTimeout = 5 * 60 * 1000; // 5 minutes
        const maxPingMisses = 3;

        for (const [socketId, connection] of this.activeConnections) {
            if (now - connection.lastActive > inactivityTimeout || connection.pingCount >= maxPingMisses) {
                console.log(`Cleaning up inactive connection: ${connection.username}`);
                this.removeConnection(socketId);
            }
        }
    }
};

// Set up periodic cleanup
setInterval(() => {
    GameState.cleanupInactiveConnections();
}, 60000); // Check every minute

/**
 * Socket.IO Event Handlers
 */
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    
    // Handle new connection
    socket.on('joinGame', async (data) => {
        const { username, tableId } = data;
        
        // Check if player is already in the game
        const existingTable = GameState.findTableBySocket(socket.id);
        if (existingTable) {
            console.log(`Player ${username} already in game, cleaning up old connection`);
            existingTable.removePlayer(socket.id);
            GameState.removeConnection(socket.id);
        }
        
        // Add to active connections
        GameState.addConnection(socket.id, username);
        GameState.players.set(socket.id, username);
        
        let table = GameState.tables.get(tableId);
        if (!table) {
            table = GameState.createTable(tableId);
        }

        // Check if player already exists in table
        const existingPlayer = table.findPlayer(username);
        if (existingPlayer) {
            console.log(`Removing existing player ${username} from table`);
            table.removePlayer(existingPlayer.socketId);
        }
        
        const joined = table.addPlayer(username, socket.id);
        if (!joined) {
            socket.emit('error', { message: 'Table is full' });
            return;
        }
        
        socket.join(tableId);
        io.to(tableId).emit('playerJoined', {
            joiner: username,
            players: table.players
        });
        
        // Send initial game state
        socket.emit('gameStateUpdate', table.getGameState());
    });

    // Add ping/pong for connection monitoring
    socket.on('ping', () => {
        GameState.updateActivity(socket.id);
        socket.emit('pong');
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        const table = GameState.findTableBySocket(socket.id);
        if (table) {
            const player = table.players.find(p => p.socketId === socket.id);
            if (player) {
                table.removePlayer(socket.id);
                io.to(table.id).emit('playerLeft', {
                    username: player.username,
                    players: table.players
                });
                table.broadcastGameState();
            }
        }
        
        GameState.removeConnection(socket.id);
        GameState.players.delete(socket.id);
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
                table.startRound();
                table.broadcastGameState();
            }
        }
    });

    socket.on('playerAction', ({ action }) => {
        const table = GameState.findTableBySocket(socket.id);
        const player = table?.players.find(p => p.socketId === socket.id);
        if (table && player && table.handlePlayerAction(socket, action)) {
            table.broadcastGameState();
        }
    });

    socket.on('doubleDown', (data) => {
        const { username, tableId } = data;
        const table = GameState.tables.get(tableId);
        
        if (table && table.handlePlayerAction(socket, 'doubleDown')) {
            // Get the current game state and broadcast it
            const gameState = table.getGameState();
            io.to(tableId).emit('gameStateUpdate', gameState);
        }
    });

    socket.on('startGame', async (data) => {
        const { tableId } = data;
        const table = GameState.tables.get(tableId);
        if (!table) return;

        // Only start if we have at least one player with a bet
        const playersWithBets = table.players.filter(p => p.bet > 0);
        if (playersWithBets.length >= 1) {
            table.startRound();
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

    socket.on('requestDealerTurn', ({ tableId }) => {
        const table = GameState.tables.get(tableId);
        if (table && table.state === 'dealer') {
            table.handleDealerTurn();
        }
    });

    socket.on('chatMessage', async (data) => {
        const { message, tableId } = data;
        const table = GameState.tables.get(tableId);
        if (!table) return;

        const player = table.players.find(p => p.socketId === socket.id);
        if (!player) return;

        // Broadcast the chat message to all players at the table
        io.to(tableId).emit('chatMessage', {
            username: player.username,
            message: message
        });
    });

    socket.on('startRound', () => {
        const table = GameState.findTableBySocket(socket.id);
        if (!table) return;

        // Check if the player has placed a bet
        const player = table.players.find(p => p.socketId === socket.id);
        if (!player || player.bet === 0) {
            socket.emit('gameMessage', {
                type: 'error',
                message: '❌ You must place a bet before starting the round'
            });
            return;
        }

        table.startNewRound();
    });
});

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
