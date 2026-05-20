import redis from 'redis';
import cache from 'express-redis-cache';
import logger from './logger.js';
import dotenv from 'dotenv';

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USERNAME,
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
