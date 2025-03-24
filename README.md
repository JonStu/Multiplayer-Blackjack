# Multiplayer Blackjack

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socket.io&logoColor=white)](https://socket.io/)

A sophisticated real-time multiplayer Blackjack game featuring a casino-grade experience.

[Features](#features) • [Installation](#installation) • [How to Play](#how-to-play) • [Technical Stack](#technical-stack)

</div>

## Features

- Real-time multiplayer gameplay with seamless synchronization
- Advanced betting system with realistic chip tracking
- Intelligent dealer AI following standard casino rules
- Interactive chat system with game notifications
- Modern, casino-themed UI with responsive design
- Clear visual feedback for player actions
- Provably fair card shuffling with verification system
- User authentication with persistent chip balances
- Responsive design for all devices
- Comprehensive help system with game rules and strategy guide

## Installation

1. Clone the repository:
```bash
git clone https://github.com/JonStu/Multiplayer-Blackjack.git
cd Multiplayer-Blackjack
```

2. Install dependencies:
```bash
npm install
```

3. Set up user data:
```bash
cp data/users.json.template data/users.json
```

4. Start the server:
```bash
node server.js
```

5. Open your browser and navigate to `http://localhost:3000`

## How to Play

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

5. **Verify Fairness**
   - Click the "Verify Fairness" button to check the integrity of the shuffle
   - Verification data is revealed at the end of each round
   - Includes server seed, client seed, and verification hash

## Technical Stack

### Backend
- **Runtime**: `Node.js`
- **Server**: `Express`
- **Real-time Communication**: `Socket.IO`
- **State Management**: Custom game state handler
- **Fairness Verification**: Cryptographic hash-based shuffling

### Frontend
- **Core**: Vanilla JavaScript
- **Styling**: CSS3 with custom animations
- **Layout**: Responsive HTML5
- **Real-time Updates**: Socket.IO client

## Development

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Project Structure
```
├── server.js              # Main server file with game logic
├── package.json           # Project dependencies
├── data/                  # Data storage
│   └── users.json.template # Template for user data
├── public/                # Client-side files
│   ├── css/               # Stylesheets
│   │   └── style.css      # Main CSS file
│   ├── img/               # Images and assets
│   │   └── cards/         # Card images
│   ├── js/                # Client JavaScript
│   │   ├── auth.js        # Authentication logic
│   │   ├── game.js        # Game client logic
│   │   └── help.js        # Help system
│   └── index.html         # Main HTML file
```

## Security Features

### Provably Fair System
The game implements a provably fair system that ensures the integrity of card shuffling:

1. **Server Seed**: Generated for each new deck
2. **Client Seed**: Random value for additional entropy
3. **Verification Hash**: HMAC SHA-256 hash used for shuffling
4. **Deck Revelation**: Initial deck state is revealed only after the round ends

Players can verify that the cards were dealt fairly without the possibility of manipulation.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Card designs inspired by classic casino decks
- Game logic follows standard Las Vegas rules

---

<div align="center">
Made by Jonson Stewart
</div>
