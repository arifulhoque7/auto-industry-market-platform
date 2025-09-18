const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectMongoDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/auto_marketplace';

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Create text indexes for encrypted field searching
    const ServiceRequest = require('../models/ServiceRequest');
    await ServiceRequest.createIndexes();

    return mongoose.connection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

module.exports = { connectMongoDB };