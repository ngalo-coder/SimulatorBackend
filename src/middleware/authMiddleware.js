import { verifyToken } from '../services/authService.js';
import User from '../models/UserModel.js'; // To potentially fetch full user object if needed

/**
 * Middleware to protect routes by verifying JWT.
 * Attaches user information to the request object if token is valid.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
export async function protect(req, res, next) {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ message: 'Not authorized, token failed.' });
      }

      // Attach user to request object
      // We store the id and username from the token.
      // If more user details are needed frequently, we could fetch User.findById(decoded.id).select('-password');
      // For now, decoded payload is sufficient for identifying the user.
      req.user = {
        id: decoded.id,
        username: decoded.username,
      };

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: 'Not authorized, token processing error.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided.' });
  }
}
