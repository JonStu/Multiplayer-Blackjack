class BlackjackGame {
    constructor() {
        this.socket = io();
        this.deck = this.createDeck();
        this.playerHand = [];
        this.dealerHand = [];
        this.gameState = 'betting'; // betting, playing, dealer, ended
        this.playerScore = 0;
        this.dealerScore = 0;
        this.chips = 1000;
        this.currentBet = 0;
        this.insuranceBet = 0;
        this.hasInsurance = false;

        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
    }

    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        let deck = [];
        
        for (let suit of suits) {
            for (let value of values) {
                deck.push({ suit, value });
            }
        }
        
        return this.shuffleDeck(deck);
    }

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    initializeElements() {
        this.dealerCards = document.getElementById('dealer-cards');
        this.playerCards = document.getElementById('player-cards');
        this.dealerScoreElement = document.getElementById('dealer-score');
        this.playerScoreElement = document.getElementById('player-score');
        this.messageElement = document.getElementById('message');
        this.chipsElement = document.getElementById('chips-amount');
        this.hitBtn = document.getElementById('hit-btn');
        this.standBtn = document.getElementById('stand-btn');
        this.dealBtn = document.getElementById('deal-btn');
        this.betInput = document.getElementById('bet-amount');
        this.placeBetBtn = document.getElementById('place-bet-btn');
        this.insurancePrompt = document.querySelector('.insurance-prompt');
        this.insuranceCost = document.getElementById('insurance-cost');
        this.acceptInsurance = document.getElementById('accept-insurance');
        this.declineInsurance = document.getElementById('decline-insurance');

        this.updateChipsDisplay();
    }

    setupEventListeners() {
        this.hitBtn.addEventListener('click', () => this.hit());
        this.standBtn.addEventListener('click', () => this.stand());
        this.dealBtn.addEventListener('click', () => this.startNewGame());
        this.placeBetBtn.addEventListener('click', () => this.placeBet());
        this.acceptInsurance.addEventListener('click', () => this.takeInsurance());
        this.declineInsurance.addEventListener('click', () => this.hideInsurancePrompt());
    }

    setupSocketListeners() {
        this.socket.on('gameState', (state) => this.updateGameState(state));
        this.socket.on('message', (msg) => this.showMessage(msg));
    }

    updateGameState(state) {
        this.gameState = state.gameState;
        this.playerHand = state.playerHand;
        this.dealerHand = state.dealerHand;
        this.updateDisplay();
    }

    async startNewGame() {
        this.deck = this.createDeck();
        this.clearTable();
        this.gameState = 'betting';
        this.dealBtn.disabled = true;
        this.hitBtn.disabled = true;
        this.standBtn.disabled = true;
        this.placeBetBtn.disabled = false;
        this.betInput.disabled = false;
        this.showMessage('Place your bet!');
    }

    async placeBet() {
        const betAmount = parseInt(this.betInput.value);
        if (betAmount > this.chips) {
            this.showMessage('Not enough chips!');
            return;
        }
        if (betAmount < 1) {
            this.showMessage('Minimum bet is 1 chip!');
            return;
        }

        this.currentBet = betAmount;
        this.chips -= betAmount;
        this.updateChipsDisplay();
        
        this.gameState = 'playing';
        this.placeBetBtn.disabled = true;
        this.betInput.disabled = true;
        this.hitBtn.disabled = false;
        this.standBtn.disabled = false;
        
        await this.dealInitialCards();
    }

    async dealInitialCards() {
        this.playerHand = [this.deck.pop(), this.deck.pop()];
        this.dealerHand = [this.deck.pop(), this.deck.pop()];
        
        // Deal cards with animation
        await this.renderCard(this.playerCards, this.playerHand[0], true);
        await this.renderCard(this.dealerCards, this.dealerHand[0], true);
        await this.renderCard(this.playerCards, this.playerHand[1], true);
        await this.renderCard(this.dealerCards, this.dealerHand[1], false);

        this.calculateScores();
        this.checkForBlackjack();
        this.offerInsurance();
    }

    offerInsurance() {
        const dealerCards = document.querySelectorAll('.dealer-cards .card');
        const dealerFirstCard = dealerCards[0];
        
        // Only offer insurance if dealer's face-up card is an Ace
        if (dealerFirstCard && dealerFirstCard.dataset.value === 'A') {
            this.insuranceBet = Math.floor(this.currentBet / 2);
            this.insuranceCost.textContent = this.insuranceBet;
            this.insurancePrompt.classList.remove('hidden');
        }
    }

    takeInsurance() {
        if (this.chips >= this.insuranceBet) {
            this.hasInsurance = true;
            this.chips -= this.insuranceBet;
            this.updateChipsDisplay();
            
            // Update message to show insurance taken
            this.messageElement.textContent = 'Insurance taken';
            this.hideInsurancePrompt();
        } else {
            this.messageElement.textContent = 'Not enough chips for insurance';
            this.hideInsurancePrompt();
        }
    }

    hideInsurancePrompt() {
        this.insurancePrompt.classList.add('hidden');
    }

    handleInsuranceOutcome() {
        if (!this.hasInsurance) return;
        
        const dealerHasBlackjack = this.calculateHandScore(this.dealerHand) === 21 && this.dealerHand.length === 2;
        
        if (dealerHasBlackjack) {
            // Insurance pays 2:1
            const insuranceWinnings = this.insuranceBet * 2;
            this.chips += insuranceWinnings + this.insuranceBet;
            this.messageElement.textContent = `Insurance bet won! +${insuranceWinnings} chips`;
        } else {
            this.messageElement.textContent = 'Insurance bet lost';
        }
        
        this.updateChipsDisplay();
        this.hasInsurance = false;
        this.insuranceBet = 0;
    }

    createCardElement(card, faceUp) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card dealt';
        
        if (faceUp) {
            cardElement.classList.add(card.suit === '♥' || card.suit === '♦' ? 'red' : 'black');
            cardElement.setAttribute('data-value', `${card.value}${card.suit}`);
            cardElement.textContent = `${card.value}${card.suit}`;
        } else {
            cardElement.style.background = '#2d2d2d';
            cardElement.textContent = '🂠';
        }
        
        return cardElement;
    }

    async renderCard(container, card, faceUp) {
        const cardElement = this.createCardElement(card, faceUp);
        container.appendChild(cardElement);

        return new Promise(resolve => {
            setTimeout(resolve, 500);
        });
    }

    async hit() {
        if (this.gameState !== 'playing') return;
        
        const card = this.deck.pop();
        this.playerHand.push(card);
        await this.renderCard(this.playerCards, card, true);
        
        this.calculateScores();
        if (this.playerScore > 21) {
            this.endGame('bust');
        }
    }

    async stand() {
        if (this.gameState !== 'playing') return;
        this.gameState = 'dealer';
        this.hitBtn.disabled = true;
        this.standBtn.disabled = true;

        // Reveal dealer's hole card
        this.dealerCards.innerHTML = '';
        for (let card of this.dealerHand) {
            await this.renderCard(this.dealerCards, card, true);
        }

        // Dealer hits on 16, stands on 17
        while (this.dealerScore < 17) {
            const card = this.deck.pop();
            this.dealerHand.push(card);
            await this.renderCard(this.dealerCards, card, true);
            this.calculateScores();
        }

        this.determineWinner();
    }

    calculateScores() {
        this.playerScore = this.calculateHandScore(this.playerHand);
        this.dealerScore = this.calculateHandScore(this.dealerHand);

        this.playerScoreElement.textContent = `Score: ${this.playerScore}`;
        // Only show dealer's score when all cards are visible
        if (this.gameState === 'dealer' || this.gameState === 'ended') {
            this.dealerScoreElement.textContent = `Score: ${this.dealerScore}`;
        } else {
            // Calculate score of only the visible card
            const visibleCardScore = this.calculateHandScore([this.dealerHand[0]]);
            this.dealerScoreElement.textContent = `Score: ${visibleCardScore}`;
        }
    }

    calculateHandScore(hand) {
        let score = 0;
        let aces = 0;

        for (let card of hand) {
            if (card.value === 'A') {
                aces++;
                score += 11;
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                score += 10;
            } else {
                score += parseInt(card.value) || 0;
            }
        }

        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }

        return score;
    }

    checkForBlackjack() {
        if (this.playerScore === 21) {
            this.endGame('blackjack');
        }
    }

    determineWinner() {
        if (this.dealerScore > 21) {
            this.endGame('dealer_bust');
        } else if (this.dealerScore > this.playerScore) {
            this.endGame('dealer_wins');
        } else if (this.dealerScore < this.playerScore) {
            this.endGame('player_wins');
        } else {
            this.endGame('push');
        }
    }

    endGame(result) {
        this.gameState = 'ended';
        this.hitBtn.disabled = true;
        this.standBtn.disabled = true;
        this.dealBtn.disabled = false;

        this.handleInsuranceOutcome();

        switch (result) {
            case 'blackjack':
                this.chips += Math.floor(this.currentBet * 2.5);
                this.showMessage('Blackjack! You win!');
                break;
            case 'bust':
                this.showMessage('Bust! You lose!');
                break;
            case 'dealer_bust':
                this.chips += this.currentBet * 2;
                this.showMessage('Dealer busts! You win!');
                break;
            case 'dealer_wins':
                this.showMessage('Dealer wins!');
                break;
            case 'player_wins':
                this.chips += this.currentBet * 2;
                this.showMessage('You win!');
                break;
            case 'push':
                this.chips += this.currentBet;
                this.showMessage('Push! Bet returned.');
                break;
        }

        this.updateChipsDisplay();
        this.currentBet = 0;
    }

    clearTable() {
        this.dealerCards.innerHTML = '';
        this.playerCards.innerHTML = '';
        this.playerScore = 0;
        this.dealerScore = 0;
        this.playerScoreElement.textContent = '';
        this.dealerScoreElement.textContent = '';
        this.messageElement.textContent = '';
        this.playerHand = [];
        this.dealerHand = [];
    }

    showMessage(message) {
        this.messageElement.textContent = message;
    }

    updateChipsDisplay() {
        this.chipsElement.textContent = this.chips;
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new BlackjackGame();
});
