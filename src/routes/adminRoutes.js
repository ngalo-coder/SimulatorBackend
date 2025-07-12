import express from 'express';
import { createAdmin, getAllUsers, updateUserRole, deleteUser } from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';
import { addRequestLogger } from '../middleware/loggingMiddleware.js';

const router = express.Router();

// Apply logging middleware to all routes
router.use(addRequestLogger);

// Apply authentication middleware to all routes
router.use(protect);

// Apply admin middleware to all routes
router.use(requireAdmin);

// Admin user management routes
router.post('/users/admin', createAdmin);
router.get('/users', getAllUsers);
router.put('/users/:userId/role', updateUserRole);
router.delete('/users/:userId', deleteUser);

export default router;