/**
 * Multiplayer Blackjack Game Client
 */
class BlackjackGame {
    constructor(username, tableId) {
        this.username = username;
        this.tableId = tableId;
        this.socket = io();
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
        this.showOtherPlayersCards = false; // Add new property
        this.lastPlayersUpdate = null; // Store last update

        // Connection monitoring
        this.lastPong = Date.now();
        this.connectionMonitoring = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        // Start connection monitoring
        this.startConnectionMonitoring();

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
        this.addDealerStyles();
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
            playersArea: document.getElementById('players-area'),
            insurancePrompt: document.querySelector('.insurance-prompt'),
            insuranceCost: document.getElementById('insurance-cost'),
            acceptInsurance: document.getElementById('accept-insurance'),
            declineInsurance: document.getElementById('decline-insurance'),
            timerValue: document.getElementById('timer-value'),
            playerName: document.getElementById('player-name'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            chatSend: document.getElementById('chat-send'),
            toggleCardsBtn: document.getElementById('toggle-cards-btn')
        };

        // Set player name
        if (this.elements.playerName) {
            this.elements.playerName.textContent = this.username;
        }

        // Update chips display
        if (this.elements.chipsDisplay) {
            this.elements.chipsDisplay.textContent = this.chips;
        }

        // Log any missing elements
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`[Client] Missing UI element: ${key}`);
            }
        });
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

        // Add toggle cards button listener
        this.elements.toggleCardsBtn.addEventListener('click', () => {
            this.showOtherPlayersCards = !this.showOtherPlayersCards;
            this.elements.toggleCardsBtn.textContent = this.showOtherPlayersCards ? 'Hide Other Cards' : 'Show Other Cards';
            this.updateOtherPlayers(this.lastPlayersUpdate || []);
        });
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('[Client] Connected to server');
            this.joinGame();
        });

        this.socket.on('gameStateUpdate', (data) => {
            console.log('[Client] Game state update:', data);
            this.updateGameState(data);
        });

        this.socket.on('playerJoined', (data) => {
            console.log('[Client] Player joined:', data);
            this.showMessage(`${data.joiner} joined the game`);
            this.updateOtherPlayers(data.players);
        });

        this.socket.on('playerLeft', (data) => {
            console.log('[Client] Player left:', data);
            this.showMessage(`${data.username} left the game`);
            this.updateOtherPlayers(data.players);
        });

        this.socket.on('dealerTurn', (data) => {
            console.log('[Client] Dealer turn:', data);
            this.handleDealerTurn(data);
        });

        this.socket.on('dealerCard', (data) => {
            console.log('[Client] Dealer card:', data);
            this.handleDealerCard(data);
        });

        this.socket.on('dealerStand', (data) => {
            console.log('[Client] Dealer stand:', data);
            this.handleDealerStand(data);
        });

        this.socket.on('roundEnd', (data) => {
            console.log('[Client] Round end:', data);
            this.handleRoundEnd(data);
        });

        // Add ping/pong for connection monitoring
        this.socket.on('pong', () => {
            this.lastPong = Date.now();
            this.reconnectAttempts = 0;
        });

        this.socket.on('disconnect', () => {
            console.log('[Client] Disconnected from server');
            this.handleConnectionLoss();
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
        this.lastPlayersUpdate = players;
        const otherPlayersContainer = this.elements.playersArea;
        otherPlayersContainer.innerHTML = '';

        players.forEach(player => {
            if (player.username === this.username) return;

            const playerDiv = document.createElement('div');
            playerDiv.className = 'other-player';
            if (this.gameState === 'playing' && player.username === this.currentTurn) {
                playerDiv.classList.add('current-turn');
            }

            const showCards = this.showOtherPlayersCards || this.gameState === 'ended';
            
            playerDiv.innerHTML = `
                <div class="player-name">${player.username}</div>
                <div class="player-chips">Chips: ${player.chips}</div>
                <div class="player-bet">Bet: ${player.bet || 0}</div>
                <div class="player-status">${this.getPlayerStatusText(player)}</div>
                <div class="player-cards">
                    ${player.cards.map(card => this.createCardElement(card, showCards).outerHTML).join('')}
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
        this.elements.hitBtn.disabled = true;
        this.elements.standBtn.disabled = true;
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

    updateGameState(data) {
        this.gameState = data.state;
        
        // Update player's hand if it exists in the data
        if (data.players) {
            const playerData = data.players.find(p => p.username === this.username);
            if (playerData) {
                this.playerHand = playerData.cards || [];
                this.playerScore = playerData.score || 0;
                this.chips = playerData.chips || this.chips;
            }
        }

        // Update dealer's hand if it exists in the data
        if (data.dealer) {
            this.dealerHand = data.dealer.cards || [];
            this.dealerScore = data.dealer.score || 0;
        }

        this.currentTurn = data.currentTurn;

        // Update UI based on game state
        this.renderPlayerCards();
        this.renderDealerCards(data.state === 'dealer' || data.state === 'ended');
        this.updateControls(data);
        this.updateChipsDisplay();
        
        if (data.players) {
            this.updateOtherPlayers(data.players);
        }

        // Handle game state specific logic
        switch(data.state) {
            case 'betting':
                this.elements.placeBetBtn.disabled = false;
                this.elements.betInput.disabled = false;
                this.elements.hitBtn.disabled = true;
                this.elements.standBtn.disabled = true;
                this.elements.dealBtn.disabled = true;
                this.showMessage('Place your bet to start the game!', 'info');
                break;
                
            case 'playing':
                this.elements.placeBetBtn.disabled = true;
                this.elements.betInput.disabled = true;
                this.elements.dealBtn.disabled = true;
                if (this.currentTurn === this.username) {
                    this.elements.hitBtn.disabled = false;
                    this.elements.standBtn.disabled = false;
                    this.showMessage('Your turn! Hit or Stand?', 'info');
                } else {
                    this.elements.hitBtn.disabled = true;
                    this.elements.standBtn.disabled = true;
                    this.showMessage(`Waiting for ${this.currentTurn}'s turn`, 'info');
                }
                break;
                
            case 'dealer':
                this.elements.hitBtn.disabled = true;
                this.elements.standBtn.disabled = true;
                this.elements.dealBtn.disabled = true;
                this.elements.placeBetBtn.disabled = true;
                this.elements.betInput.disabled = true;
                this.showMessage("Dealer's turn", 'info');

                // Request dealer action if all players are done
                const allPlayersDone = data.players.every(p => 
                    p.status === 'stand' || p.status === 'bust'
                );
                if (allPlayersDone) {
                    this.socket.emit('requestDealerTurn', { tableId: this.tableId });
                }
                break;
                
            case 'ended':
                this.elements.dealBtn.disabled = false;
                this.elements.hitBtn.disabled = true;
                this.elements.standBtn.disabled = true;
                this.elements.placeBetBtn.disabled = true;
                this.elements.betInput.disabled = true;
                
                // Show all cards
                this.renderDealerCards(true);
                
                if (data.winners) {
                    this.showRoundEndMessage(data);
                }
                break;
        }

        // Check for insurance if dealer shows an Ace
        if (this.dealerHand.length > 0) {
            const firstCard = this.dealerHand[0];
            const value = typeof firstCard === 'string' ? firstCard.charAt(0) : firstCard.value;
            if (value === 'A' && !this.hasInsurance && this.gameState === 'playing') {
                this.offerInsurance();
            }
        }
    }

    showRoundEndMessage(data) {
        let message = '';
        const playerResult = data.winners.find(w => w.username === this.username);
        
        if (playerResult) {
            if (playerResult.result === 'win') {
                message = `You won ${playerResult.amount} chips! `;
            } else if (playerResult.result === 'push') {
                message = 'Push! Your bet has been returned. ';
            } else {
                message = `You lost ${playerResult.amount} chips. `;
            }
        }

        message += `\nDealer's score: ${this.dealerScore}`;
        this.showMessage(message, playerResult?.result === 'win' ? 'success' : 'info');
    }

    renderPlayerCards() {
        const cardsContainer = this.elements.playerCards;
        cardsContainer.innerHTML = '';
        
        this.playerHand.forEach(card => {
            const cardElement = this.createCardElement(card, true);
            cardsContainer.appendChild(cardElement);
        });
        
        // Update score
        if (this.playerHand.length > 0) {
            this.elements.playerScore.textContent = `Score: ${this.playerScore}`;
        } else {
            this.elements.playerScore.textContent = '';
        }
    }

    renderDealerCards(showAll = false) {
        console.log('[Client] Rendering dealer cards, showAll:', showAll);
        
        // Clear existing cards
        if (this.elements.dealerCards) {
            this.elements.dealerCards.innerHTML = '';
        }

        if (!this.dealerHand || !Array.isArray(this.dealerHand)) {
            console.warn('[Client] No dealer hand to render');
            return;
        }

        // Create card container with proper spacing
        const cardContainer = document.createElement('div');
        cardContainer.className = 'card-container';
        
        this.dealerHand.forEach((card, index) => {
            // First card is face up, others depend on showAll
            const faceUp = index === 0 || showAll;
            const cardElement = this.createCardElement(card, faceUp);
            
            // Add animation class for new cards
            if (this.gameState === 'dealer' && index === this.dealerHand.length - 1) {
                cardElement.classList.add('dealt');
            }
            
            // Add data attributes for face cards
            if (['K', 'Q', 'J', 'A'].includes(card.value)) {
                cardElement.setAttribute('data-value', card.value);
            }
            
            // Position cards with slight overlap
            cardElement.style.marginLeft = index > 0 ? '-40px' : '0';
            cardElement.style.zIndex = index;
            
            cardContainer.appendChild(cardElement);
        });

        // Add score display if showing all cards
        if (showAll && this.dealerScore !== undefined) {
            const scoreElement = document.createElement('div');
            scoreElement.className = 'score';
            scoreElement.textContent = `Score: ${this.dealerScore}`;
            cardContainer.appendChild(scoreElement);
        }

        if (this.elements.dealerCards) {
            this.elements.dealerCards.appendChild(cardContainer);
        }
    }

    createCardElement(card, faceUp = true) {
        const cardElement = document.createElement('div');
        cardElement.className = faceUp ? 'card' : 'card card-back';
        
        if (faceUp) {
            // Main card container
            const innerCard = document.createElement('div');
            innerCard.className = 'card-inner';
            
            // Add suit-based styling
            const suitClass = this.getSuitClass(card.suit);
            innerCard.classList.add(suitClass);
            
            // Create corner values
            const cornerTop = document.createElement('div');
            cornerTop.className = 'corner top';
            cornerTop.innerHTML = `
                <span class="value">${card.value}</span>
                <span class="suit">${card.suit}</span>
            `;
            
            const cornerBottom = document.createElement('div');
            cornerBottom.className = 'corner bottom';
            cornerBottom.innerHTML = `
                <span class="value">${card.value}</span>
                <span class="suit">${card.suit}</span>
            `;
            
            // Create center pip
            const centerPip = document.createElement('div');
            centerPip.className = 'center-pip';
            centerPip.innerHTML = `
                <span class="big-suit">${card.suit}</span>
                <span class="big-value">${card.value}</span>
            `;
            
            // Add shine effect
            const shine = document.createElement('div');
            shine.className = 'card-shine';
            
            // Assemble card
            innerCard.appendChild(cornerTop);
            innerCard.appendChild(centerPip);
            innerCard.appendChild(cornerBottom);
            innerCard.appendChild(shine);
            cardElement.appendChild(innerCard);
        } else {
            // Back of card design
            const backDesign = document.createElement('div');
            backDesign.className = 'card-back-design';
            cardElement.appendChild(backDesign);
        }
        
        return cardElement;
    }

    getSuitClass(suit) {
        switch (suit) {
            case '♠': return 'spades';
            case '♥': return 'hearts';
            case '♣': return 'clubs';
            case '♦': return 'diamonds';
            default: return '';
        }
    }

    getCardValue(value) {
        if (value === 'A') return 11;
        if (['K', 'Q', 'J'].includes(value)) return 10;
        return parseInt(value);
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

    getCardDescription(card) {
        let value, suit;
        if (typeof card === 'string') {
            [value, suit] = card.split('');
        } else {
            value = card.value;
            suit = card.suit;
        }
        return `${this.valueMap[value] || value} of ${suit}`;
    }

    async animateCardReveal(cardElement) {
        cardElement.style.transition = 'transform 0.5s ease-in-out';
        cardElement.style.transform = 'rotateY(90deg)';
        
        await new Promise(resolve => setTimeout(resolve, 250));
        cardElement.classList.remove('card-back');
        cardElement.style.transform = 'rotateY(0deg)';
        
        return new Promise(resolve => setTimeout(resolve, 250));
    }

    async handleDealerTurn(data) {
        console.log('[Client] Dealer turn started:', data);
        
        // Only handle if we're not already in dealer state
        if (this.gameState === 'dealer') {
            console.log('[Client] Already in dealer state, ignoring');
            return;
        }
        
        this.gameState = 'dealer';
        this.dealerHand = data.dealerHand;
        this.dealerScore = data.dealerScore;
        
        if (data.debug) {
            console.log('[Dealer Debug]', data.debug);
        }
        
        // Disable all controls
        this.disableAllControls();
        
        // Add active dealer styling
        const dealerArea = this.elements.dealerCards;
        if (dealerArea) {
            dealerArea.classList.add('dealer-active');
        }
        
        // First reveal all current dealer cards
        console.log('[Client] Revealing all dealer cards');
        this.renderDealerCards(true);
        
        this.showMessage("Dealer's turn...", 'info');
        
        // Request dealer to start their turn
        this.socket.emit('requestDealerTurn', { tableId: this.tableId });
    }

    async handleDealerCard(data) {
        console.log('[Client] Dealer drew card:', data);
        const { card, dealerHand, dealerScore, willDrawAgain, debug } = data;
        
        // Only handle if we're in dealer state
        if (this.gameState !== 'dealer') {
            console.log('[Client] Not in dealer state, ignoring card draw');
            return;
        }
        
        if (debug) {
            console.log('[Dealer Debug]', debug);
        }
        
        // Update dealer's hand and score
        this.dealerHand = dealerHand;
        this.dealerScore = dealerScore;
        
        // Render all cards with new card
        console.log('[Client] Updating dealer display with new card');
        this.renderDealerCards(true);
        
        // Show message about the card draw
        this.showMessage(`Dealer draws ${this.getCardDescription(card)}. Score: ${dealerScore}`, 'info');
        
        // If dealer will draw again, show anticipation message
        if (willDrawAgain) {
            setTimeout(() => {
                if (this.gameState === 'dealer') {  // Only show if still in dealer state
                    this.showMessage('Dealer must draw again...', 'info');
                }
            }, 1000);
        }
    }

    handleDealerStand(data) {
        console.log('[Client] Dealer stands:', data);
        const { dealerScore, message, debug } = data;
        
        // Only handle if we're in dealer state
        if (this.gameState !== 'dealer') {
            console.log('[Client] Not in dealer state, ignoring stand');
            return;
        }
        
        if (debug) {
            console.log('[Dealer Debug]', debug);
        }
        
        // Remove active dealer styling
        const dealerArea = this.elements.dealerCards;
        if (dealerArea) {
            dealerArea.classList.remove('dealer-active');
        }
        
        // Make sure all cards are visible
        this.renderDealerCards(true);
        
        // Show dealer's final decision
        this.showMessage(message, 'info');
    }

    handleRoundEnd(data) {
        console.log('[Client] Round ended:', data);
        
        // Only handle if we're not already in roundEnd state
        if (this.gameState === 'roundEnd') {
            console.log('[Client] Already in roundEnd state, ignoring');
            return;
        }
        
        this.gameState = 'roundEnd';
        this.dealerHand = data.dealerHand;
        this.dealerScore = data.dealerScore;
        
        // Show all cards
        this.renderDealerCards(true);
        this.renderPlayerCards();
        
        // Update chips
        if (data.players) {
            const playerData = data.players.find(p => p.username === this.username);
            if (playerData) {
                this.chips = playerData.chips;
                this.updateChipsDisplay();
            }
        }
        
        // Show round results
        if (data.winners && data.losers) {
            if (data.winners.includes(this.username)) {
                this.showMessage('You won!', 'success');
            } else if (data.losers.includes(this.username)) {
                this.showMessage('You lost.', 'error');
            } else {
                this.showMessage('Push - your bet has been returned.', 'info');
            }
        }
        
        // Enable deal button for next round after a delay
        setTimeout(() => {
            if (this.gameState === 'roundEnd') {  // Only enable if still in roundEnd state
                if (this.elements.dealBtn) this.elements.dealBtn.disabled = false;
                if (this.elements.betInput) this.elements.betInput.disabled = false;
                if (this.elements.betBtn) this.elements.betBtn.disabled = false;
                this.showMessage('Place your bets for the next round!', 'info');
            }
        }, 3000);
    }

    renderCardContent(cardElement, card) {
        console.log('[Client] Rendering card content:', card);
        
        // Ensure card object has required properties
        if (!card || !card.suit || !card.value) {
            console.error('[Client] Invalid card object:', card);
            return;
        }

        // Add color class based on suit
        if (card.suit === '♥' || card.suit === '♦') {
            cardElement.classList.add('red');
        }

        // Create card value elements
        const valueTop = document.createElement('div');
        valueTop.className = 'card-value-top';
        valueTop.textContent = `${card.value}${card.suit}`;

        const valueBottom = document.createElement('div');
        valueBottom.className = 'card-value-bottom';
        valueBottom.textContent = `${card.value}${card.suit}`;

        const valueCenter = document.createElement('div');
        valueCenter.className = 'card-value-center';
        valueCenter.textContent = card.suit;

        cardElement.appendChild(valueTop);
        cardElement.appendChild(valueCenter);
        cardElement.appendChild(valueBottom);
    }

    getCardDescription(card) {
        let value, suit;
        if (typeof card === 'string') {
            [value, suit] = card.split('');
        } else {
            value = card.value;
            suit = card.suit;
        }
        return `${this.valueMap[value] || value} of ${suit}`;
    }

    async animateCardReveal(cardElement) {
        cardElement.style.transition = 'transform 0.5s ease-in-out';
        cardElement.style.transform = 'rotateY(90deg)';
        
        await new Promise(resolve => setTimeout(resolve, 250));
        cardElement.classList.remove('card-back');
        cardElement.style.transform = 'rotateY(0deg)';
        
        return new Promise(resolve => setTimeout(resolve, 250));
    }

    disableAllControls() {
        // Check each element before disabling
        const controls = ['hitBtn', 'standBtn', 'dealBtn', 'betBtn', 'betInput', 'placeBetBtn'];
        controls.forEach(control => {
            if (this.elements[control]) {
                this.elements[control].disabled = true;
            } else {
                console.warn(`[Client] Missing control element: ${control}`);
            }
        });
    }

    updateDealerScore(score) {
        console.log('[Client] Updating dealer score:', score);
        const scoreElement = document.createElement('div');
        scoreElement.className = 'score';
        scoreElement.textContent = `Score: ${score}`;
        
        // Remove old score if exists
        const oldScore = this.elements.dealerCards.querySelector('.score');
        if (oldScore) {
            oldScore.remove();
        }
        
        this.elements.dealerCards.appendChild(scoreElement);
    }

    startConnectionMonitoring() {
        // Send ping every 30 seconds
        this.connectionMonitoring = setInterval(() => {
            if (Date.now() - this.lastPong > 60000) { // No pong for 1 minute
                this.handleConnectionLoss();
                return;
            }
            
            this.socket.emit('ping');
        }, 30000);

        // Listen for pong responses
        this.socket.on('pong', () => {
            this.lastPong = Date.now();
            this.reconnectAttempts = 0; // Reset reconnect attempts on successful pong
        });

        // Handle disconnection
        this.socket.on('disconnect', () => {
            this.handleConnectionLoss();
        });
    }

    handleConnectionLoss() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.showMessage('Connection lost. Please refresh the page.', 'error');
            clearInterval(this.connectionMonitoring);
            return;
        }

        this.reconnectAttempts++;
        this.showMessage('Attempting to reconnect...', 'warning');
        
        // Attempt to reconnect
        this.socket.connect();
        
        // Re-join game on reconnection
        this.socket.once('connect', () => {
            this.socket.emit('joinGame', {
                username: this.username,
                tableId: this.tableId
            });
            this.showMessage('Reconnected!', 'success');
        });
    }

    cleanup() {
        if (this.connectionMonitoring) {
            clearInterval(this.connectionMonitoring);
        }
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    addDealerStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .dealer-active {
                box-shadow: 0 0 15px #4CAF50;
                animation: dealerPulse 1.5s infinite;
            }
            
            @keyframes dealerPulse {
                0% { box-shadow: 0 0 15px #4CAF50; }
                50% { box-shadow: 0 0 25px #4CAF50; }
                100% { box-shadow: 0 0 15px #4CAF50; }
            }
            
            .dealer-card-draw {
                animation: cardDraw 0.5s ease-out;
            }
            
            @keyframes cardDraw {
                from {
                    transform: translateY(-50px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => new BlackjackGame(localStorage.getItem('username'), 'table1'));
