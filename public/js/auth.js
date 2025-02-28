/**
 * Authentication Module
 * Handles user registration, login, and UI state management
 */

class AuthManager {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.checkAuthState();
        this.createRandomCards();
    }

    initializeElements() {
        this.elements = {
            authContainer: document.getElementById('auth-container'),
            gameContainer: document.getElementById('game-container'),
            loginForm: document.getElementById('login-form'),
            signupForm: document.getElementById('signup-form'),
            showSignupLink: document.getElementById('show-signup'),
            showLoginLink: document.getElementById('show-login'),
            logoutBtn: document.getElementById('logout-btn'),
            playerNameSpan: document.getElementById('player-name'),
            username: document.getElementById('username'),
            password: document.getElementById('password'),
            newUsername: document.getElementById('new-username'),
            newPassword: document.getElementById('new-password'),
            card1: document.querySelector('.card-1'),
            card2: document.querySelector('.card-2'),
            loginBtn: document.getElementById('login-btn'),
            signupBtn: document.getElementById('signup-btn')
        };

        // Log any missing elements
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`[Auth] Missing UI element: ${key}`);
            }
        });
    }

    attachEventListeners() {
        // Form switching
        this.elements.showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleForms('signup');
        });

        this.elements.showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleForms('login');
        });

        // Auth actions
        this.elements.loginBtn.addEventListener('click', () => this.login());
        this.elements.signupBtn.addEventListener('click', () => this.register());
        this.elements.logoutBtn?.addEventListener('click', () => this.logout());
    }

    toggleForms(show) {
        this.elements.loginForm.classList.toggle('hidden', show === 'signup');
        this.elements.signupForm.classList.toggle('hidden', show === 'login');
    }

    async login() {
        try {
            if (!this.elements.username.value || !this.elements.password.value) {
                throw new Error('Please enter both username and password');
            }

            const response = await this.sendRequest('/login', {
                username: this.elements.username.value,
                password: this.elements.password.value
            });

            if (response.ok) {
                const data = await response.json();
                this.handleSuccessfulAuth(data);
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Invalid username or password');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    async register() {
        try {
            if (!this.elements.newUsername.value || !this.elements.newPassword.value) {
                throw new Error('Please enter both username and password');
            }

            if (this.elements.newPassword.value.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            const response = await this.sendRequest('/register', {
                username: this.elements.newUsername.value,
                password: this.elements.newPassword.value
            });

            if (response.ok) {
                this.showSuccess('Account created! Please log in.');
                this.toggleForms('login');
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Username already exists');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    async sendRequest(endpoint, data) {
        return fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }

    handleSuccessfulAuth(data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        this.showGameInterface(data.username);
    }

    showGameInterface(username) {
        this.elements.authContainer.classList.add('hidden');
        this.elements.gameContainer.classList.remove('hidden');
        this.elements.playerNameSpan.textContent = username;
    }

    showAuthInterface() {
        this.elements.gameContainer.classList.add('hidden');
        this.elements.authContainer.classList.remove('hidden');
        this.toggleForms('login');
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        this.showAuthInterface();
    }

    checkAuthState() {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        if (token && username) {
            this.showGameInterface(username);
        }
    }

    createRandomCards() {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        const getRandomCard = () => {
            const suit = suits[Math.floor(Math.random() * suits.length)];
            const value = values[Math.floor(Math.random() * values.length)];
            const isRed = suit === '♥' || suit === '♦';
            return { suit, value, isRed };
        };

        const createCardHTML = (card) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';
            cardDiv.style.color = card.isRed ? '#e74c3c' : '#2c3e50';
            
            cardDiv.innerHTML = `
                <div class="card-inner">
                    <div class="card-value">${card.value}</div>
                    <div class="card-suit">${card.suit}</div>
                </div>
            `;
            return cardDiv;
        };

        const card1 = getRandomCard();
        const card2 = getRandomCard();

        this.elements.card1.innerHTML = '';
        this.elements.card2.innerHTML = '';
        this.elements.card1.appendChild(createCardHTML(card1));
        this.elements.card2.appendChild(createCardHTML(card2));
    }

    showError(message) {
        alert(message);
    }

    showSuccess(message) {
        alert(message);
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => new AuthManager());
