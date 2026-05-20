import mongoose from 'mongoose';
import { ValidationError } from './AppError.js';

/**
 * Utility for common request validations
 */

export function requireFields(body, ...fields) {
  const missing = fields.filter(f => {
    const value = body[f];
    return value === undefined || value === null || value === '';
  });
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`, 
      missing.map(f => ({ field: f, message: `${f} is required` }))
    );
  }
}

export function validateEmail(email) {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Invalid email format', [
      { field: 'email', message: 'Must be a valid email address', value: email }
    ]);
  }
}

export function validateObjectId(id, fieldName = 'id') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ${fieldName}`, [
      { field: fieldName, message: `Must be a valid ObjectId`, value: id }
    ]);
  }
  return id;
}

export function validatePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginationResponse(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Sanitize a string to prevent XSS
 */
export function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Validate enum value
 */
export function validateEnum(value, allowedValues, fieldName = 'value') {
  if (value && !allowedValues.includes(value)) {
    throw new ValidationError(`Invalid ${fieldName}`, [
      { field: fieldName, message: `Must be one of: ${allowedValues.join(', ')}`, value }
    ]);
  }
}

export default {
  requireFields,
  validateEmail,
  validateObjectId,
  validatePagination,
  buildPaginationResponse,
  sanitize,
  validateEnum,
};
