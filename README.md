# Multiplayer Blackjack

A real-time multiplayer Blackjack game with user authentication.

## Features

- User authentication (signup/login)
- Real-time gameplay using WebSocket
- Smooth card dealing animations
- Chip tracking system
- Responsive design
- Modern UI/UX

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with:
   ```
   JWT_SECRET=your-secret-key
   PORT=3000
   ```
4. Make sure MongoDB is running on your system

## Running the Application

1. Start the server:
   ```bash
   npm start
   ```
2. Visit `jonstu.dev/blackjack` in your browser

## Game Rules

- Classic Blackjack rules
- Dealer must hit on 16 and stand on 17
- Blackjack pays 3:2
- Each player starts with 1000 chips
- Minimum bet is 1 chip

## Technologies Used

- Frontend: HTML5, CSS3, JavaScript
- Backend: Node.js, Express
- Database: MongoDB
- Real-time: Socket.IO
- Authentication: JWT, bcrypt
