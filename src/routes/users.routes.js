/**
 * Unified Users Routes
 * 
 * RESOURCE-CENTRIC: All user-related operations consolidated here.
 * Replaces: userRoutes.js, adminUserRoutes.js, privacyRoutes.js (parts)
 */

import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAnyRole } from '../middleware/rbacMiddleware.js';
import * as usersController from '../controllers/usersController.js';

const router = express.Router();

// Configure multer for file uploads (admin CSV import)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

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

// ──────────────────────────────────────────────
// ADMIN OPERATIONS
// ──────────────────────────────────────────────

/**
 * POST /api/users/import
 * Import users from CSV (admin only)
 */
router.post('/import', authenticateToken, requireAnyRole(['admin']), upload.single('file'), usersController.importUsersCSV);

export default router;
