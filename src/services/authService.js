import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'yourSuperSecretKey123!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

if (!process.env.JWT_SECRET) {
  logger.warn('JWT_SECRET is not defined in .env file. Using a default, non-secure key. This is not safe for production.');
}

/**
 * Generates a JSON Web Token (JWT) for a user.
 */
export function generateToken(userId, username, role = 'user') {
  if (!JWT_SECRET) {
    logger.error('JWT_SECRET is missing. Cannot generate token.');
    throw new Error('JWT secret is missing.');
  }
  return jwt.sign({ id: userId, username, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verifies a JSON Web Token (JWT).
 */
export function verifyToken(token) {
  if (!JWT_SECRET) {
    logger.error('JWT_SECRET is missing. Cannot verify token.');
    throw new Error('JWT secret is missing.');
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    logger.warn({ token, error: error.message }, 'Invalid token verification attempt.');
    return null;
  }
}
