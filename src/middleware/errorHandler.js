 import logger from '../config/logger.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Global error handling middleware
 * Catches all errors thrown in routes/controllers and returns consistent responses
 */
export function globalErrorHandler(err, req, res, _next) {
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Log the error
  if (statusCode >= 500) {
    logger.error({
      err,
      method: req.method,
      path: req.path,
      requestId: req.id,
    }, err.message || 'Internal server error');
  } else if (statusCode >= 400) {
    logger.warn({
      err: err.message,
      method: req.method,
      path: req.path,
      code,
    }, `Request error: ${err.message}`);
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.entries(err.errors).map(([field, error]) => ({
      field,
      message: error.message,
      value: error.value,
    }));
    return sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', details);
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return sendError(res, `Duplicate value for ${field}`, 409, 'DUPLICATE_ENTRY');
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, `Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID');
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401, 'AUTH_ERROR');
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401, 'TOKEN_EXPIRED');
  }

  // Handle validation details from ValidationError class
  if (err.details && Array.isArray(err.details)) {
    return sendError(res, err.message, statusCode, code, err.details);
  }

  // Production vs development error detail
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  const response = {
    success: false,
    message,
    code,
  };

  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack.split('\n').slice(0, 4).join('\n');
  }

  return res.status(statusCode).json(response);
}

/**
 * 404 handler for unknown routes
 */
export function notFoundHandler(req, res) {
  return sendError(
    res,
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'ROUTE_NOT_FOUND'
  );
}

/**
 * Async route handler wrapper to catch errors
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default { globalErrorHandler, notFoundHandler, asyncHandler };
