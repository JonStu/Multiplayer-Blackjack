# Multiplayer Blackjack

A real-time multiplayer Blackjack game built with Node.js, Express, and Socket.IO.

## Features

- Real-time multiplayer gameplay
- Intuitive turn-based system with alphabetical order
- Betting system with chip tracking
- Dealer AI that follows standard casino rules
- Interactive chat system with game notifications
- Modern, casino-themed UI with responsive design
- Clear visual feedback for available actions
- Insurance options for dealer blackjack

## Recent Updates

⚠️ **EXPERIMENTAL BRANCH WARNING** ⚠️
This branch (`experimental-dealer-turn`) contains experimental changes to the dealer turn mechanics and round reset functionality. These changes are currently under development and may contain bugs or incomplete features. Please do not use this branch in production.

Changes in this branch:
- Enhanced dealer turn completion logic
- Improved round reset functionality
- Better win/loss message handling
- Smoother game state transitions
- Enhanced chip tracking and updates

Known Issues:
- Round reset timing may need adjustment
- Message queue might show duplicate messages in edge cases
- Potential race conditions during state transitions

For stable version, please use the `main` branch.

- Added integrated chat system for player communication
- Enhanced UI with improved button visibility and feedback
- Implemented smart message deduplication
- Added visual indicators for available actions
- Improved betting controls and validation
- Enhanced casino-themed color scheme

## Technical Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Real-time Communication**: Socket.IO
- **State Management**: Custom game state handler

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/JonStu/Multiplayer-Blackjack.git
```

2. Install dependencies:
```bash
npm install
```

3. Set up user data:
```bash
# Create the data directory if it doesn't exist
mkdir -p data
# Copy the template users file
cp data/users.json.template data/users.json
```

4. Start the server:
```bash
node server.js
```

5. Open your browser and navigate to `http://localhost:3000`

## Development Setup

- The `data/users.json` file is gitignored to prevent committing user data
- Use the `users.json.template` as a reference for the user data structure
- All sensitive data should be stored in environment variables (create a `.env` file)

## Game Rules

- Players are dealt two cards initially
- Players take turns in alphabetical order
- Dealer always plays last
- Players can Hit or Stand during their turn
- Dealer must hit on 16 and stand on 17
- Insurance is offered when dealer shows an Ace
- Blackjack pays 3:2
- Insurance pays 2:1

## UI Features

- Color-coded action buttons:
  - Hit (Green)
  - Stand (Red)
  - Deal (Gold)
  - Bet (Blue)
- Visual feedback for available actions
- Integrated chat system with game notifications
- Real-time chip count and bet tracking
- Responsive design for various screen sizes

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - see LICENSE file for details
