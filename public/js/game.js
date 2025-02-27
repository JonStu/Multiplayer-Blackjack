/**
 * Multiplayer Blackjack Game Client
 */
class BlackjackGame {
    constructor() {
        this.socket = io();
        this.username = localStorage.getItem('username');
        this.tableId = 'table1';
        this.playerHand = [];
        this.dealerHand = [];
        this.gameState = 'betting'; // betting, playing, dealer, ended
        this.playerScore = 0;
        this.dealerScore = 0;
        this.chips = 1000;
        this.currentBet = 0;
        this.insuranceBet = 0;
        this.hasInsurance = false;
        this.timerInterval = null;
        this.timerValue = 0;
        this.currentTurn = null;

        // Card mappings for proper display
        this.valueMap = {
            'A': 'ace',
            'K': 'king',
            'Q': 'queen',
            'J': 'jack',
            '10': '10',
            '9': '9',
            '8': '8',
            '7': '7',
            '6': '6',
            '5': '5',
            '4': '4',
            '3': '3',
            '2': '2'
        };

        this.suitMap = {
            '♠': 'spade',
            '♥': 'heart',
            '♣': 'club',
            '♦': 'diamond'
        };

        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.joinGame();
    }

    initializeElements() {
        this.elements = {
            dealerCards: document.getElementById('dealer-cards'),
            playerCards: document.getElementById('player-cards'),
            dealerScore: document.getElementById('dealer-score'),
            playerScore: document.getElementById('player-score'),
            messageArea: document.getElementById('message-area'),
            chipsDisplay: document.getElementById('chips-count'),
            hitBtn: document.getElementById('hit-btn'),
            standBtn: document.getElementById('stand-btn'),
            dealBtn: document.getElementById('deal-btn'),
            betInput: document.getElementById('bet-amount'),
            placeBetBtn: document.getElementById('place-bet-btn'),
            playersArea: document.querySelector('.other-players'),
            insurancePrompt: document.querySelector('.insurance-prompt'),
            insuranceCost: document.getElementById('insurance-cost'),
            acceptInsurance: document.getElementById('accept-insurance'),
            declineInsurance: document.getElementById('decline-insurance'),
            timerValue: document.getElementById('timer-value'),
            playerName: document.getElementById('player-name'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            chatSend: document.getElementById('chat-send'),
            lobbyList: document.getElementById('lobby-list')
        };

        // Set player name
        this.elements.playerName.textContent = this.username;
    }

    setupEventListeners() {
        this.elements.hitBtn.addEventListener('click', () => this.hit());
        this.elements.standBtn.addEventListener('click', () => this.stand());
        this.elements.dealBtn.addEventListener('click', () => this.startNewGame());
        this.elements.placeBetBtn.addEventListener('click', () => this.placeBet());
        this.elements.acceptInsurance.addEventListener('click', () => this.takeInsurance());
        this.elements.declineInsurance.addEventListener('click', () => this.hideInsurancePrompt());
        
        // Add chat event listeners
        this.elements.chatSend.addEventListener('click', () => this.sendChatMessage());
        this.elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        // Add bet input validation
        this.elements.betInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value > this.chips) {
                e.target.value = this.chips;
                this.showMessage('Maximum bet is ' + this.chips + ' chips', 'warning');
            } else if (value < 1) {
                e.target.value = 1;
                this.showMessage('Minimum bet is 1 chip', 'warning');
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('playerJoined', (data) => {
            this.showMessage(`${data.joiner} joined the game`);
            this.updateOtherPlayers(data.players);
        });

        this.socket.on('playerLeft', (data) => {
            this.showMessage(`${data.username} left the game`);
            this.updateOtherPlayers(data.players);
        });

        this.socket.on('gameStateUpdate', (data) => {
            this.updateGameState(data);
        });

        this.socket.on('chatMessage', (data) => {
            this.addChatMessage(data.username, data.message, 'user');
        });
    }

    joinGame() {
        if (this.username) {
            this.socket.emit('joinGame', {
                username: this.username,
                tableId: this.tableId
            });
        }
    }

    updateOtherPlayers(players) {
        const otherPlayersContainer = document.querySelector('.other-players');
        otherPlayersContainer.innerHTML = '';

        players.forEach(player => {
            if (player.username === this.username) return;

            const playerDiv = document.createElement('div');
            playerDiv.className = 'other-player';
            if (this.gameState === 'playing' && player.username === this.currentTurn) {
                playerDiv.classList.add('current-turn');
            }

            playerDiv.innerHTML = `
                <div class="player-name">${player.username}</div>
                <div class="player-chips">Chips: ${player.chips}</div>
                <div class="player-bet">Bet: ${player.bet || 0}</div>
                <div class="player-status">${this.getPlayerStatusText(player)}</div>
                <div class="player-cards">
                    ${player.cards.map(card => this.createCardElement(card, true).outerHTML).join('')}
                </div>
            `;

            otherPlayersContainer.appendChild(playerDiv);
        });
    }

    getPlayerStatusText(player) {
        switch(player.status) {
            case 'betting': return 'Placing bet...';
            case 'playing': return `Score: ${player.score}`;
            case 'stand': return `Standing (${player.score})`;
            case 'bust': return `Bust! (${player.score})`;
            default: return 'Waiting...';
        }
    }

    startNewGame() {
        this.clearTable();
        this.gameState = 'betting';
        this.dealerHand = [];
        this.playerHand = [];
        this.elements.dealBtn.disabled = true;
        this.elements.hitBtn.disabled = true;
        this.elements.standBtn.disabled = true;
        this.elements.placeBetBtn.disabled = false;
        this.elements.betInput.disabled = false;
        this.showMessage('Place your bet to start the game!', 'info');

        this.socket.emit('startNewGame', { 
            tableId: this.tableId
        });
    }

    async placeBet() {
        const betAmount = parseInt(this.elements.betInput.value);
        if (betAmount > this.chips) {
            this.showMessage('Not enough chips!', 'error');
            return;
        }
        if (betAmount < 1) {
            this.showMessage('Minimum bet is 1 chip!', 'error');
            return;
        }

        this.socket.emit('placeBet', { 
            amount: betAmount,
            tableId: this.tableId
        });

        this.currentBet = betAmount;
        this.chips -= betAmount;
        this.updateChipsDisplay();
        this.elements.placeBetBtn.disabled = true;
        this.elements.betInput.disabled = true;
        this.showMessage('Bet placed! Waiting for other players...', 'success');
    }

    async hit() {
        this.socket.emit('playerAction', { 
            action: 'hit',
            tableId: this.tableId
        });
        this.showMessage('Hit! Drawing a card...', 'info');
    }

    async stand() {
        this.socket.emit('playerAction', { 
            action: 'stand',
            tableId: this.tableId
        });
        this.showMessage('Stand! Waiting for other players...', 'info');
    }

    startTimer(duration) {
        this.stopTimer();
        this.timerValue = duration;
        this.elements.timerValue.textContent = this.timerValue;
        
        this.timerInterval = setInterval(() => {
            this.timerValue--;
            this.elements.timerValue.textContent = this.timerValue;
            
            if (this.timerValue <= 0) {
                this.stopTimer();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateGameState(state) {
        this.updateLobby(state);
        // Update dealer's cards
        if (state.dealer) {
            this.dealerHand = state.dealer.cards;
            this.dealerScore = state.dealer.score;
            this.renderDealerCards(state.state === 'dealer' || state.state === 'roundEnd');

            // Start timer for dealer's next card
            if (state.state === 'dealer' && state.nextCardTimer) {
                this.startTimer(state.nextCardTimer);
                this.showMessage("Dealer's turn! Drawing next card...", 'info');
            } else {
                this.stopTimer();
            }
        }

        // Update player's cards
        const player = state.players.find(p => p.username === this.username);
        if (player) {
            this.playerHand = player.cards;
            this.playerScore = player.score;
            this.chips = player.chips;
            this.renderPlayerCards();
            this.updateChipsDisplay();

            // If we just placed a bet and others have bet, start countdown
            if (state.state === 'betting' && player.bet > 0) {
                const otherPlayersWithBets = state.players.filter(p => 
                    p.username !== this.username && p.bet > 0
                ).length;
                
                if (otherPlayersWithBets > 0) {
                    this.startBettingCountdown();
                }
            }

            // Show appropriate message based on player status
            if (player.status === 'bust') {
                this.showMessage('Bust! Your score is over 21', 'error');
            } else if (player.status === 'stand') {
                this.showMessage('Standing with ' + player.score, 'info');
            }
        }

        // Update controls based on state
        switch (state.state) {
            case 'betting':
                this.elements.dealBtn.disabled = true;
                this.elements.hitBtn.disabled = true;
                this.elements.standBtn.disabled = true;
                // Only enable betting if we're in a fresh betting round (no cards dealt)
                const canBet = !this.dealerHand.length && !this.playerHand.length;
                this.elements.placeBetBtn.disabled = !canBet;
                this.elements.betInput.disabled = !canBet;
                if (canBet && !player?.bet) {
                    this.showMessage('Place your bet to start the game!', 'info');
                } else if (!canBet) {
                    this.showMessage('Waiting for all bets to be placed...', 'info');
                }
                break;
            case 'playing':
                const isPlayerTurn = state.currentTurn === this.username;
                this.elements.hitBtn.disabled = !isPlayerTurn;
                this.elements.standBtn.disabled = !isPlayerTurn;
                this.elements.dealBtn.disabled = true;
                this.elements.placeBetBtn.disabled = true;
                this.elements.betInput.disabled = true;
                if (isPlayerTurn) {
                    this.showMessage('Your turn! Hit or Stand?', 'info');
                } else {
                    const currentPlayer = state.players.find(p => p.username === state.currentTurn);
                    if (currentPlayer) {
                        this.showMessage(`Waiting for ${currentPlayer.username}'s turn...`, 'info');
                    }
                }
                break;
            case 'dealer':
                this.elements.hitBtn.disabled = true;
                this.elements.standBtn.disabled = true;
                this.elements.dealBtn.disabled = true;
                this.elements.placeBetBtn.disabled = true;
                this.elements.betInput.disabled = true;
                break;
            case 'roundEnd':
                this.elements.hitBtn.disabled = true;
                this.elements.standBtn.disabled = true;
                this.elements.dealBtn.disabled = false;
                // Disable betting until new round starts
                this.elements.placeBetBtn.disabled = true;
                this.elements.betInput.disabled = true;
                this.showRoundEndMessage(state, player);
                break;
        }

        // Update other players
        this.updateOtherPlayers(state);

        // Check for insurance opportunity
        if (state.dealer?.cards[0]?.value === 'A' && !this.hasInsurance) {
            this.offerInsurance();
        }
    }

    updateLobby(gameState) {
        const lobbyList = this.elements.lobbyList;
        lobbyList.innerHTML = '';

        const players = gameState.players || [];
        const currentTurn = gameState.currentPlayer;

        players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = `lobby-player${player.username === currentTurn ? ' current-turn' : ''}`;

            // Player name and chips
            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = player.username;
            
            const chipsSpan = document.createElement('span');
            chipsSpan.className = 'player-chips';
            chipsSpan.textContent = `${player.chips} chips`;

            // Player status
            const statusSpan = document.createElement('span');
            statusSpan.className = 'player-status';
            if (player.username === currentTurn) {
                statusSpan.textContent = 'Playing';
                statusSpan.classList.add('status-playing');
            } else if (player.bet > 0) {
                statusSpan.textContent = 'Waiting';
                statusSpan.classList.add('status-waiting');
            } else {
                statusSpan.textContent = 'Betting';
                statusSpan.classList.add('status-betting');
            }

            // Player hand
            const handDiv = document.createElement('div');
            handDiv.className = 'player-hand';
            
            if (player.hand && player.hand.length > 0) {
                player.hand.forEach(card => {
                    if (card.hidden && player.username !== this.username) {
                        const cardImg = document.createElement('img');
                        cardImg.src = '/img/cards/back.png';
                        cardImg.alt = 'Hidden Card';
                        handDiv.appendChild(cardImg);
                    } else {
                        const cardImg = document.createElement('img');
                        cardImg.src = `/img/cards/${card.value}_of_${card.suit}.png`;
                        cardImg.alt = `${card.value} of ${card.suit}`;
                        handDiv.appendChild(cardImg);
                    }
                });
            }

            playerDiv.appendChild(nameSpan);
            playerDiv.appendChild(statusSpan);
            playerDiv.appendChild(handDiv);
            playerDiv.appendChild(chipsSpan);
            lobbyList.appendChild(playerDiv);
        });
    }

    showRoundEndMessage(state, player) {
        if (!player) return;
        
        const dealerScore = state.dealer.score;
        const playerScore = player.score;
        let result = '';
        
        if (player.status === 'bust') {
            result = 'Game Over - Bust! You lost this round.';
            this.showMessage(result, 'error');
        } else if (dealerScore > 21) {
            result = 'You Win! Dealer bust with ' + dealerScore;
            this.showMessage(result, 'success');
        } else if (playerScore > dealerScore) {
            result = 'You Win! ' + playerScore + ' beats dealer\'s ' + dealerScore;
            this.showMessage(result, 'success');
        } else if (playerScore === dealerScore) {
            result = 'Push! Tied with dealer at ' + playerScore;
            this.showMessage(result, 'info');
        } else {
            result = 'Dealer Wins with ' + dealerScore + ' vs your ' + playerScore;
            this.showMessage(result, 'error');
        }
        
        this.showMessage('Place your bet to join the next round', 'info', true);
    }

    startBettingCountdown() {
        let countdown = 10;
        this.showMessage(`Game starting in ${countdown} seconds...`, 'info', true);
        
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                this.showMessage(`Game starting in ${countdown} seconds...`, 'info', true);
            } else {
                clearInterval(countdownInterval);
                this.socket.emit('startGame', { tableId: this.tableId });
            }
        }, 1000);
    }

    renderDealerCards(showAll = false) {
        this.elements.dealerCards.innerHTML = '';
        this.dealerHand.forEach((card, index) => {
            // Only show first card unless showAll is true or it's the first card
            const faceUp = showAll || index === 0;
            const cardElement = this.createCardElement(card, faceUp);
            this.elements.dealerCards.appendChild(cardElement);
        });

        if (showAll && this.dealerScore > 0) {
            this.elements.dealerScore.textContent = `Dealer Score: ${this.dealerScore}`;
        } else {
            this.elements.dealerScore.textContent = '';
        }
    }

    renderPlayerCards() {
        this.elements.playerCards.innerHTML = '';
        this.playerHand.forEach(card => {
            this.elements.playerCards.appendChild(this.createCardElement(card, true));
        });
        this.elements.playerScore.textContent = `Score: ${this.playerScore}`;
    }

    createCardElement(card, faceUp) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card dealt';
        
        if (faceUp) {
            const suit = card.suit;
            cardDiv.classList.add(this.getSuitClass(suit));
            
            // Create top-left corner
            const topLeft = document.createElement('div');
            topLeft.className = 'card-corner top-left';
            topLeft.innerHTML = `
                <span class="card-value">${card.value}</span>
                <span class="card-suit">${suit}</span>
            `;
            
            // Create center suit
            const center = document.createElement('div');
            center.className = 'card-center';
            center.textContent = suit;
            
            // Create bottom-right corner (rotated 180deg)
            const bottomRight = document.createElement('div');
            bottomRight.className = 'card-corner bottom-right';
            bottomRight.innerHTML = `
                <span class="card-value">${card.value}</span>
                <span class="card-suit">${suit}</span>
            `;
            
            cardDiv.appendChild(topLeft);
            cardDiv.appendChild(center);
            cardDiv.appendChild(bottomRight);
        } else {
            cardDiv.classList.add('card-back');
        }
        
        return cardDiv;
    }

    getSuitClass(suit) {
        switch(suit) {
            case '♥': return 'hearts';
            case '♦': return 'diamonds';
            case '♠': return 'spades';
            case '♣': return 'clubs';
            default: return '';
        }
    }

    updateControls(state) {
        const isPlayerTurn = state.currentTurn === this.username;
        this.elements.hitBtn.disabled = !isPlayerTurn;
        this.elements.standBtn.disabled = !isPlayerTurn;
        this.elements.dealBtn.disabled = state.state !== 'roundEnd';
    }

    offerInsurance() {
        this.insuranceBet = Math.floor(this.currentBet / 2);
        this.elements.insuranceCost.textContent = this.insuranceBet;
        this.elements.insurancePrompt.classList.remove('hidden');
    }

    takeInsurance() {
        if (this.chips >= this.insuranceBet) {
            this.socket.emit('takeInsurance', {
                amount: this.insuranceBet,
                tableId: this.tableId
            });
            this.hasInsurance = true;
            this.chips -= this.insuranceBet;
            this.updateChipsDisplay();
            this.hideInsurancePrompt();
        } else {
            this.showMessage('Not enough chips for insurance');
            this.hideInsurancePrompt();
        }
    }

    hideInsurancePrompt() {
        this.elements.insurancePrompt.classList.add('hidden');
    }

    clearTable() {
        this.elements.dealerCards.innerHTML = '';
        this.elements.playerCards.innerHTML = '';
        this.elements.dealerScore.textContent = '';
        this.elements.playerScore.textContent = '';
        this.dealerHand = [];
        this.playerHand = [];
    }

    sendChatMessage() {
        const message = this.elements.chatInput.value.trim();
        if (message) {
            this.socket.emit('chatMessage', {
                message,
                tableId: this.tableId
            });
            this.elements.chatInput.value = '';
        }
    }

    addChatMessage(username, message, type = 'user') {
        // Check if this is the same as the last message
        const lastMessage = this.elements.chatMessages.lastElementChild;
        if (lastMessage) {
            const isDuplicate = lastMessage.textContent === (type === 'user' ? `${username}: ${message}` : message);
            if (isDuplicate) return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        
        if (type === 'user') {
            messageDiv.textContent = `${username}: ${message}`;
        } else {
            messageDiv.textContent = message;
        }
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    showMessage(message, type = 'system', append = false) {
        // Don't show empty messages
        if (!message) return;
        this.addChatMessage(null, message, type);
    }

    updateChipsDisplay() {
        this.elements.chipsDisplay.textContent = this.chips;
    }

    createCardHTML(card) {
        const isRed = ['♥', '♦'].includes(card.suit);
        return `
            <div class="card ${isRed ? 'red' : 'black'}">
                <div class="card-value">${card.value}</div>
                <div class="card-suit">${card.suit}</div>
            </div>
        `;
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => new BlackjackGame());
