const http = require('http');
const app = require('./app');
const socketService = require('./services/socket.service');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
socketService.init(server);

// Start server
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 TripBlock Server started in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`==================================================`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
