/**
 * Authentication Module
 * Handles user registration, login, and UI state management
 */

class AuthManager {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.checkAuthState();
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
            newPassword: document.getElementById('new-password')
        };
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
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('signup-btn').addEventListener('click', () => this.register());
        this.elements.logoutBtn?.addEventListener('click', () => this.logout());
    }

    toggleForms(show) {
        this.elements.loginForm.classList.toggle('hidden', show === 'signup');
        this.elements.signupForm.classList.toggle('hidden', show === 'login');
    }

    async login() {
        try {
            const response = await this.sendRequest('/login', {
                username: this.elements.username.value,
                password: this.elements.password.value
            });

            if (response.ok) {
                const data = await response.json();
                this.handleSuccessfulAuth(data);
            } else {
                const error = await response.json();
                throw new Error(error.message);
            }
        } catch (error) {
            this.showError(error.message || 'Login failed');
        }
    }

    async register() {
        try {
            const response = await this.sendRequest('/register', {
                username: this.elements.newUsername.value,
                password: this.elements.newPassword.value
            });

            if (response.ok) {
                this.showSuccess('Account created! Please log in.');
                this.toggleForms('login');
            } else {
                const error = await response.json();
                throw new Error(error.message);
            }
        } catch (error) {
            this.showError(error.message || 'Registration failed');
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

    showError(message) {
        alert(message);
    }

    showSuccess(message) {
        alert(message);
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => new AuthManager());
