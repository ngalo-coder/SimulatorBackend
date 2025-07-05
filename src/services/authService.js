import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'yourSuperSecretKey123!'; // Fallback for local dev if .env is missing
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

/**
 * Generates a JSON Web Token (JWT) for a user.
 * @param {string} userId - The ID of the user.
 * @param {string} username - The username of the user.
 * @returns {string} The generated JWT.
 */
export function generateToken(userId, username) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined. Please check your .env file.');
    throw new Error('JWT secret is missing, cannot generate token.');
  }
  return jwt.sign({ id: userId, username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verifies a JSON Web Token (JWT).
 * @param {string} token - The JWT to verify.
 * @returns {object | null} The decoded token payload if verification is successful, otherwise null.
 */
export function verifyToken(token) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined. Please check your .env file.');
    throw new Error('JWT secret is missing, cannot verify token.');
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Invalid token:', error.message);
    return null;
  }
}

// Note: Password hashing and comparison are handled within UserModel.js
// using bcryptjs for better model encapsulation. This service is focused on JWTs.
