module.exports = {
    port: process.env.PORT || 3000,
    baseUrl: '/blackjack',
    corsOrigins: [
        'https://jonstu.dev',
        'https://www.jonstu.dev'
    ],
    socketIoSettings: {
        path: '/blackjack/socket.io',
        cors: {
            origin: [
                'https://jonstu.dev',
                'https://www.jonstu.dev'
            ],
            methods: ["GET", "POST"]
        }
    }
};
