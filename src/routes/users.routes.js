/**
 * Unified Users Routes
 * 
 * RESOURCE-CENTRIC: All user-related operations consolidated here.
 * Replaces: userRoutes.js, adminUserRoutes.js, privacyRoutes.js (parts)
 */

import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAnyRole } from '../middleware/rbacMiddleware.js';
import * as usersController from '../controllers/usersController.js';

const router = express.Router();

// ──────────────────────────────────────────────
// REGISTRATION & UTILITY (no auth required)
// ──────────────────────────────────────────────

/**
 * POST /api/users/register
 * Register a new user account
 */
router.post('/register', usersController.registerUser);

/**
 * GET /api/users/disciplines
 * Available healthcare disciplines
 */
router.get('/disciplines', usersController.getDisciplines);

/**
 * GET /api/users/roles
 * Available user roles
 */
router.get('/roles', usersController.getRoles);

/**
 * GET /api/users/registration-config
 * Complete registration form configuration
 */
router.get('/registration-config', usersController.getRegistrationConfig);

// ──────────────────────────────────────────────
// USER LISTING & LOOKUP (authenticated)
// ──────────────────────────────────────────────

/**
 * GET /api/users
 * List users - role-aware (admin sees all, educator sees students, student sees self)
 */
router.get('/', authenticateToken, usersController.getUsers);

/**
 * GET /api/users/:id
 * Get a single user by ID
 */
router.get('/:id', authenticateToken, usersController.getUserById);

/**
 * PUT /api/users/:id
 * Update a user (admin can update anyone, user can update themselves)
 */
router.put('/:id', authenticateToken, usersController.updateUserProfile);

/**
 * DELETE /api/users/:id
 * Soft-delete a user (admin only)
 */
router.delete('/:id', authenticateToken, requireAnyRole(['admin']), usersController.deleteUser);

// ──────────────────────────────────────────────
// USER PREFERENCES
// ──────────────────────────────────────────────

/**
 * GET /api/users/:userId/preferences
 * Get user preferences
 */
router.get('/:userId/preferences', authenticateToken, usersController.getUserPreferences);

/**
 * PUT /api/users/:userId/preferences
 * Update user preferences
 */
router.put('/:userId/preferences', authenticateToken, usersController.updateUserPreferences);

export default router;
