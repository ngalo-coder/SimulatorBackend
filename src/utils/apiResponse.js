/**
 * Standard API response helpers
 * Ensures consistent response format: { success, data, message, ... }
 */

export function sendSuccess(res, data = null, message = 'Success', statusCode = 200, extra = {}) {
  const response = {
    success: true,
    message,
    data,
    ...extra,
  };
  return res.status(statusCode).json(response);
}

export function sendCreated(res, data = null, message = 'Created successfully') {
  return sendSuccess(res, data, message, 201);
}

export function sendError(res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
  const response = {
    success: false,
    message,
    code,
  };
  if (details) response.details = details;
  return res.status(statusCode).json(response);
}

export function sendValidationError(res, errors, message = 'Validation failed') {
  return sendError(res, message, 400, 'VALIDATION_ERROR', errors);
}

export function sendUnauthorized(res, message = 'Authentication required') {
  return sendError(res, message, 401, 'AUTH_ERROR');
}

export function sendForbidden(res, message = 'Access denied') {
  return sendError(res, message, 403, 'FORBIDDEN');
}

export function sendNotFound(res, message = 'Resource not found') {
  return sendError(res, message, 404, 'NOT_FOUND');
}

export default {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
};
