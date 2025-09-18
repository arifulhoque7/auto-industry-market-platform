const logger = require('../utils/logger');

let io;

const initializeWebSocket = (socketIO) => {
  io = socketIO;

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join room based on user role and ID
    socket.on('join', (data) => {
      const { userId, role } = data;
      socket.join(`user:${userId}`);
      socket.join(`role:${role}`);
      logger.info(`User ${userId} joined rooms`);
    });

    // Subscribe to specific request updates
    socket.on('subscribe:request', (requestId) => {
      socket.join(`request:${requestId}`);
      logger.info(`Socket ${socket.id} subscribed to request ${requestId}`);
    });

    // Subscribe to inventory updates
    socket.on('subscribe:inventory', () => {
      socket.join('inventory:updates');
      logger.info(`Socket ${socket.id} subscribed to inventory updates`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
};

const notifyQuote = (data) => {
  if (!io) return;

  // Notify the car owner
  io.to(`user:${data.ownerId}`).emit('new:quote', data);

  // Notify everyone watching the request
  io.to(`request:${data.requestId}`).emit('request:update', {
    type: 'new_quote',
    data
  });
};

const notifyInventoryUpdate = (data) => {
  if (!io) return;

  io.to('inventory:updates').emit('inventory:update', data);
};

const notifyRequestUpdate = (requestId, update) => {
  if (!io) return;

  io.to(`request:${requestId}`).emit('request:update', update);
};

module.exports = {
  initializeWebSocket,
  notifyQuote,
  notifyInventoryUpdate,
  notifyRequestUpdate
};