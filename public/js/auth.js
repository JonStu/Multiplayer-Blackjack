document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    const gameContainer = document.getElementById('game-container');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const playerNameSpan = document.getElementById('player-name');
    const chipsDisplay = document.getElementById('chips-display');

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

        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                localStorage.setItem('chips', data.chips);
                showGameInterface(data.username, data.chips);
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    });

    // Handle signup
    document.getElementById('signup-btn').addEventListener('click', async () => {
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;

        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                alert('Account created successfully! Please log in.');
                signupForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
                // Clear the signup form
                document.getElementById('new-username').value = '';
                document.getElementById('new-password').value = '';
            } else {
                alert(data.message || 'Signup failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            alert('Signup failed. Please try again.');
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
    const chips = localStorage.getItem('chips');
    if (token && username) {
        showGameInterface(username, chips);
    }

    function showGameInterface(username, chips) {
        authContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        playerNameSpan.textContent = username;
        if (chipsDisplay) {
            chipsDisplay.textContent = chips;
        }
        // Initialize the game
        if (typeof initGame === 'function') {
            initGame(username, chips);
        }
    }

    function showAuthInterface() {
        gameContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    }
});
