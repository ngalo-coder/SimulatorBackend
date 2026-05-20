import jwt from 'jsonwebtoken';

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

export const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d';

export const generateToken = (payload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiresIn() });
};

export const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

export default {
  getJwtSecret,
  getJwtExpiresIn,
  generateToken,
  verifyToken
};