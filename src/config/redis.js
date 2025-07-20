import redis from 'redis';
import cache from 'express-redis-cache';
import logger from './logger.js';

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

redisClient.on('error', (err) => {
  logger.error('Redis error: ', err);
});

const redisCache = cache({
  client: redisClient,
  prefix: 'cache',
  expire: 60 * 60, // 1 hour
});

export { redisClient, redisCache };
