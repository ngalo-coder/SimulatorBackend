import logger from '../config/logger.js';

/**
 * Middleware to protect admin-only routes.
 * This middleware should be used after the protect middleware.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
export function requireAdmin(req, res, next) {
  // Check if user exists and has admin role
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized, no user found.' });
  }

  if (req.user.role !== 'admin') {
    logger.warn({ userId: req.user.id, role: req.user.role }, 'Non-admin user attempted to access admin route');
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }

  next();
}