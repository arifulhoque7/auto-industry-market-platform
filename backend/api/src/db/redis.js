const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    await redisClient.ping();
  } catch (error) {
    logger.error('Redis connection error:', error);
    throw error;
  }
};

const getCache = async (key) => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
};

const setCache = async (key, value, ttl = 3600) => {
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    logger.error(`Error setting cache for key ${key}:`, error);
  }
};

const deleteCache = async (pattern) => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (error) {
    logger.error(`Error deleting cache for pattern ${pattern}:`, error);
  }
};

module.exports = {
  connectRedis,
  getCache,
  setCache,
  deleteCache,
  getRedisClient: () => redisClient
};