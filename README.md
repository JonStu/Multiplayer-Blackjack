# 🎰 Multiplayer Blackjack

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socket.io&logoColor=white)](https://socket.io/)

A sophisticated real-time multiplayer Blackjack game featuring a casino-grade experience.

[Features](#features) • [Installation](#installation) • [How to Play](#how-to-play) • [Technical Stack](#technical-stack) • [Contributing](#contributing)

</div>

## ✨ Features

- 🎮 Real-time multiplayer gameplay with seamless synchronization
- 💰 Advanced betting system with realistic chip tracking
- 🤖 Intelligent dealer AI following standard casino rules
- 💬 Interactive chat system with game notifications
- 🎨 Modern, casino-themed UI with responsive design
- 🎯 Clear visual feedback for player actions
- 📱 Fully responsive design for all devices
- ❓ Comprehensive help system with game rules and strategy guide
- 🔒 Secure user authentication system

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/JonStu/Multiplayer-Blackjack.git
cd Multiplayer-Blackjack
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
node server.js
```

4. Open your browser and navigate to `http://localhost:3000`

## 🎮 How to Play

1. **Login or Create Account**
   - Use the authentication system to access your account
   - Your chips and game history are automatically saved

2. **Place Your Bet**
   - Click on chips to select bet amount
   - Confirm your bet to join the round

3. **Game Actions**
   - **Hit**: Request another card
   - **Stand**: Keep your current hand
   - **Double Down**: Double your bet and receive one more card
   - **Insurance**: Available when dealer shows an Ace

4. **Game Rules**
   - Press the "How to Play" button in-game for detailed rules
   - Learn basic strategy and betting tips
   - View win conditions and payout rates

## 🛠 Technical Stack

### Backend
- **Runtime**: `Node.js`
- **Server**: `Express`
- **Real-time Communication**: `Socket.IO`
- **State Management**: Custom game state handler

### Frontend
- **Core**: Vanilla JavaScript
- **Styling**: CSS3 with custom animations
- **Layout**: Responsive HTML5
- **Real-time Updates**: Socket.IO client

## 🔧 Development

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Environment Setup
```bash
# Create environment file
cp .env.example .env

# Install development dependencies
npm install --include=dev
```

### Project Structure
```
├── server.js           # Main server file
├── public/            
│   ├── css/           # Stylesheets
│   ├── js/            # Client-side JavaScript
│   └── img/           # Game assets
├── data/              # User data storage
└── README.md          # This file
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ by Jonathan Stuart
</div>
