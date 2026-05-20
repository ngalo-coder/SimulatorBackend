import jwt from 'jsonwebtoken';
import User from '../models/UserModel.js';
import logger from '../config/logger.js';
import { getJwtSecret } from '../config/auth.js';
import { AppError, AuthenticationError, AuthorizationError } from '../utils/AppError.js';

/**
 * Authenticate JWT token from Authorization header
 * Attaches user and tokenPayload to req
 */
export const authenticateToken = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      throw new AuthenticationError('Access token is required');
    }

    const decoded = jwt.verify(token, getJwtSecret());

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      throw new AuthenticationError('Invalid token - user not found');
    }
    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      username: user.username,
      email: user.email,
      primaryRole: user.primaryRole,
      role: user.primaryRole,
      discipline: user.discipline,
      profile: user.profile,
      isActive: user.isActive,
      getAllRoles: () => user.getAllRoles(),
      toObject: () => user.toObject(),
    };
    req.tokenPayload = decoded;
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token has expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new AuthenticationError('Invalid or malformed token'));
    }
    return next(new AuthenticationError('Authentication failed'));
  }
};

/**
 * Optional Authentication Middleware
 * Attempts to authenticate but doesn't fail if no token is provided
 */
export const optionalAuth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      req.user = null;
      req.tokenPayload = null;
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.userId).select('-password');
    if (user && user.isActive) {
      req.user = {
        id: user._id.toString(),
        _id: user._id,
        username: user.username,
        email: user.email,
        primaryRole: user.primaryRole,
        role: user.primaryRole,
        discipline: user.discipline,
        getAllRoles: () => user.getAllRoles(),
        toObject: () => user.toObject(),
      };
      req.tokenPayload = decoded;
    } else {
      req.user = null;
      req.tokenPayload = null;
    }
    next();
  } catch {
    req.user = null;
    req.tokenPayload = null;
    next();
  }
};

/**
 * Role-based authorization guard
 */
export const requireRoles = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }
    const userRoles = typeof req.user.getAllRoles === 'function'
      ? req.user.getAllRoles()
      : [req.user.primaryRole || req.user.role];

    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    if (!hasRole) {
      return next(new AuthorizationError(`Access denied. Required roles: ${allowedRoles.join(', ')}`));
    }
    next();
  };
};

/**
 * Discipline-based authorization guard
 */
export const requireDiscipline = (...allowedDisciplines) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }
    if (!allowedDisciplines.includes(req.user.discipline)) {
      return next(new AuthorizationError(`Access denied. Required disciplines: ${allowedDisciplines.join(', ')}`));
    }
    next();
  };
};

/**
 * API Key Authentication (for service-to-service communication)
 */
export const authenticateApiKey = async (req, _res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return next(new AuthenticationError('API key is required'));
    }

    const validApiKeys = process.env.VALID_API_KEYS?.split(',').filter(Boolean) || [];
    if (!validApiKeys.includes(apiKey)) {
      return next(new AuthenticationError('Invalid API key'));
    }

    req.user = {
      id: 'service',
      _id: 'service',
      username: 'service',
      primaryRole: 'service',
      role: 'service',
      isService: true,
      getAllRoles: () => ['service'],
      toObject: () => ({ _id: 'service', username: 'service', primaryRole: 'service' }),
    };
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AuthenticationError('API key authentication failed'));
  }
};

/**
 * Convenience middleware combinations
 */
export const requireAuth = authenticateToken;
export const requireStudent = [authenticateToken, requireRoles('student')];
export const requireEducator = [authenticateToken, requireRoles('educator')];
export const requireAdmin = [authenticateToken, requireRoles('admin')];
export const requireEducatorOrAdmin = [authenticateToken, requireRoles('educator', 'admin')];
export const requireAnyRole = [authenticateToken, requireRoles('student', 'educator', 'admin')];

/**
 * Development/Testing Middleware
 */
export const mockAuth = (mockUser = null) => {
  return (req, _res, next) => {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      req.user = mockUser || {
        id: 'mock-user-id',
        _id: 'mock-user-id',
        username: 'mockuser',
        primaryRole: 'student',
        role: 'student',
        discipline: 'medicine',
        getAllRoles: () => ['student'],
        toObject: () => ({ _id: 'mock-user-id', username: 'mockuser', primaryRole: 'student' }),
      };
    }
    next();
  };
};