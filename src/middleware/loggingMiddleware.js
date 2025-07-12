/**
 * Logging middleware for Express routes
 * Adds request logging capabilities to routes
 */

/**
 * Middleware to add request logging to routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const addRequestLogger = (req, res, next) => {
  // The request already has a logger attached by pino-http in index.js
  // This is just a pass-through middleware that can be extended later if needed
  if (req.log) {
    req.log.info({ 
      path: req.path, 
      method: req.method,
      query: req.query,
      body: req.body
    }, 'Admin route accessed');
  }
  next();
};