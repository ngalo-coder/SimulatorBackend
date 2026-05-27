/**
 * Unified Authentication Routes
 * 
 * RESOURCE-CENTRIC: All authentication operations consolidated here.
 * Handles: login, register, logout, token refresh, token verification,
 *          current user, and password changes.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/UserModel.js';
import { authenticateToken, requireAuth } from '../middleware/authMiddleware.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { getJwtSecret, getJwtExpiresIn } from '../config/auth.js';

const router = express.Router();

// ──────────────────────────────────────────────
// PUBLIC ENDPOINTS (no auth required)
// ──────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register',
  (req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  },
  rateLimiter(5, 15),
  async (req, res) => {
    try {
      const { email, password, firstName, lastName, institution } = req.body;

      if (!email || !password || !firstName || !lastName || !institution) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, first name, last name, and institution are required'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }

      let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');

      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase().trim() }, { username }]
      });

      if (existingUser) {
        if (existingUser.email === email.toLowerCase().trim()) {
          return res.status(409).json({ success: false, message: 'An account with this email already exists' });
        }
        username = `${username}_${Math.random().toString(36).slice(2, 6)}`;
      }

      const newUser = new User({
        username,
        email: email.toLowerCase().trim(),
        password,
        primaryRole: 'student',
        discipline: 'medicine',
        profile: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          institution: institution.trim(),
          preferences: {
            learningStyle: 'visual',
            difficultyPreference: 'beginner',
            notifications: { email: true, push: true, caseReminders: true, progressUpdates: true },
            language: 'en',
            timezone: 'UTC'
          },
          competencyLevel: 'novice'
        },
        isActive: true,
        emailVerified: false,
        competencies: [],
        permissions: []
      });

      await newUser.save();

      const jwtSecret = getJwtSecret();
      const jwtExpiresIn = getJwtExpiresIn();

      const tokenPayload = {
        userId: newUser._id,
        username: newUser.username,
        email: newUser.email,
        primaryRole: newUser.primaryRole,
        discipline: newUser.discipline
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: jwtExpiresIn });

      const userResponse = newUser.toObject();
      delete userResponse.password;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: userResponse,
        expiresIn: jwtExpiresIn
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: `Registration failed: ${process.env.NODE_ENV === 'development' ? error.message : 'Please try again'}`
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user with username/email and password
 */
router.post('/login',
  (req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  },
  rateLimiter(10, 15),
  async (req, res) => {
    try {
      const { username, password, email } = req.body;

      if ((!username && !email) || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username/email and password are required'
        });
      }

      const query = username
        ? { username: username.toLowerCase().trim() }
        : { email: email.toLowerCase().trim() };

      const user = await User.findOne(query);

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'Account is deactivated' });
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const jwtSecret = getJwtSecret();
      const jwtExpiresIn = getJwtExpiresIn();

      const tokenPayload = {
        userId: user._id,
        username: user.username,
        email: user.email,
        primaryRole: user.primaryRole,
        discipline: user.discipline
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: jwtExpiresIn });

      await user.updateLastLogin();

      const userResponse = user.toObject();
      delete userResponse.password;

      const redirectTo = user.primaryRole === 'admin' ? '/admin/dashboard' : '/dashboard';

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: userResponse,
        redirectTo,
        expiresIn: jwtExpiresIn
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: `Login failed: ${process.env.NODE_ENV === 'development' ? error.message : 'Please try again'}`,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// ──────────────────────────────────────────────
// AUTHENTICATED ENDPOINTS (require valid token)
// ──────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Log out the current user
 */
router.post('/logout',
  (req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  },
  requireAuth,
  async (_req, res) => {
    try {
      res.json({ success: true, message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ success: false, message: 'Logout failed' });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh authentication token with updated user data
 */
router.post('/refresh',
  (req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  },
  requireAuth,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: 'User not found or inactive' });
      }

      const jwtSecret = getJwtSecret();
      const jwtExpiresIn = getJwtExpiresIn();

      const tokenPayload = {
        userId: user._id,
        username: user.username,
        email: user.email,
        primaryRole: user.primaryRole,
        discipline: user.discipline
      };

      const newToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: jwtExpiresIn });

      const userResponse = user.toObject();
      delete userResponse.password;

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        token: newToken,
        user: userResponse,
        expiresIn: jwtExpiresIn
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ success: false, message: 'Token refresh failed' });
    }
  }
);

/**
 * GET /api/auth/verify
 * Verify JWT token is valid
 */
router.get('/verify',
  (req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  },
  requireAuth,
  async (req, res) => {
    try {
      const userResponse = req.user.toObject();
      delete userResponse.password;

      res.json({
        success: true,
        message: 'Token is valid',
        user: userResponse,
        tokenPayload: req.tokenPayload
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({ success: false, message: 'Token verification failed' });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current authenticated user's profile
 */
router.get('/me',
  (req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  },
  requireAuth,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const userResponse = user.toObject();
      delete userResponse.password;

      res.json({ success: true, user: userResponse });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ success: false, message: 'Failed to get user profile' });
    }
  }
);

/**
 * POST /api/auth/change-password
 * Change password for the authenticated user
 */
router.post('/change-password',
  (req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  },
  requireAuth,
  rateLimiter(5, 15),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current password and new password are required' });
      }

      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const isCurrentPasswordValid = await user.comparePassword(currentPassword);

      if (!isCurrentPasswordValid) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
      }

      user.password = newPassword;
      await user.save();

            res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ success: false, message: 'Password change failed' });
    }
  }
);

export default router;
