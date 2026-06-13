let io;

module.exports = {
  init: (server) => {
    const { Server } = require('socket.io');
    io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    });

    io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      
      socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
      });

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  },
  emitEvent: (event, data) => {
    if (io) {
      io.emit(event, data);
      console.log(`[Socket Event] ${event}:`, JSON.stringify(data));
    } else {
      console.log(`Socket.io not initialized. Skipping event: ${event}`);
    }
  }
};
