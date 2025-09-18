const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const { ApolloServer } = require('apollo-server-express');
const { register } = require('prom-client');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const quoteRoutes = require('./routes/quotes');
const partsRoutes = require('./routes/parts');
const { authenticateToken } = require('./middleware/auth');
const { connectPostgres } = require('./db/postgres');
const { connectRedis } = require('./db/redis');
const { connectRabbitMQ } = require('./services/rabbitmq');
const { typeDefs, resolvers } = require('./graphql/schema');
const swaggerSpec = require('./config/swagger');
const { initializeWebSocket } = require('./services/websocket');
const logger = require('./utils/logger');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', process.env.FRONTEND_URL].filter(Boolean),
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', authenticateToken, requestRoutes);
app.use('/api/quotes', authenticateToken, quoteRoutes);
app.use('/api/parts', partsRoutes);

// Initialize services
async function startServer() {
  try {
    // Connect to databases
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/auto_marketplace');
    logger.info('MongoDB connected');

    await connectPostgres();
    logger.info('PostgreSQL connected');

    await connectRedis();
    logger.info('Redis connected');

    await connectRabbitMQ();
    logger.info('RabbitMQ connected');

    // Connect to Kafka (optional - falls back to RabbitMQ if not available)
    const kafkaService = require('./services/kafka');
    await kafkaService.connect();

    // Initialize WebSocket
    initializeWebSocket(io);

    // Setup GraphQL
    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => ({
        user: req.user,
        io
      })
    });

    await apolloServer.start();
    apolloServer.applyMiddleware({ app, path: '/graphql' });

    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
      logger.info(`API Docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});