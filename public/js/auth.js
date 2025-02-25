document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    const gameContainer = document.getElementById('game-container');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const playerNameSpan = document.getElementById('player-name');

    // Auth endpoints
    const API_BASE = '/blackjack';
    const AUTH_ENDPOINTS = {
        login: `${API_BASE}/login`,
        register: `${API_BASE}/register`,
        updateChips: `${API_BASE}/update-chips`
    };

    async function login(username, password) {
        try {
            const response = await fetch(AUTH_ENDPOINTS.login, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            localStorage.setItem('chips', data.chips);
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async function register(username, password) {
        try {
            const response = await fetch(AUTH_ENDPOINTS.register, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            return data;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    async function updateChips(username, chips) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(AUTH_ENDPOINTS.updateChips, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, chips })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update chips');
            }

            localStorage.setItem('chips', chips);
            return data;
        } catch (error) {
            console.error('Update chips error:', error);
            throw error;
        }
    }

    // Show/hide forms
    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    // Handle login
    document.getElementById('login-btn').addEventListener('click', async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const data = await login(username, password);
            showGameInterface(data.username);
        } catch (error) {
            alert(error.message || 'Login failed');
        }
    });

    // Handle signup
    document.getElementById('signup-btn').addEventListener('click', async () => {
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;

        try {
            await register(username, password);
            alert('Account created successfully! Please log in.');
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        } catch (error) {
            alert(error.message || 'Signup failed');
        }
    });

    // Handle logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('chips');
        showAuthInterface();
    });

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (token && username) {
        showGameInterface(username);
    }

    function showGameInterface(username) {
        authContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        playerNameSpan.textContent = username;
    }

    function showAuthInterface() {
        gameContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
    }
});
