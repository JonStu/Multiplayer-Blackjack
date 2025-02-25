module.exports = {
    port: process.env.PORT || 3000,
    baseUrl: '/blackjack',
    corsOrigins: '*',
    socketIoSettings: {
        path: '/blackjack/socket.io',
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    }
};
