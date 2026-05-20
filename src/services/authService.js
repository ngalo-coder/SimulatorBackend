import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { getJwtSecret, getJwtExpiresIn } from '../config/auth.js';

/**
 * Generates a JSON Web Token (JWT) for a user.
 */
export function generateToken(userId, username, role = 'user') {
  return jwt.sign({ userId, username, role }, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });
}

/**
 * Verifies a JSON Web Token (JWT).
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    logger.warn({ token, error: error.message }, 'Invalid token verification attempt.');
    return null;
  }
}
