import express from 'express';
import { 
  createAdmin, 
  getAllUsers, 
  updateUserRole, 
  deleteUser,
  getProgramAreas,
  getSpecialties,
  getAllCases,
  updateCase,
  deleteCase,
  getUsersWithScores,
  getSystemStats
} from '../controllers/adminController.js';
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

// Case metadata routes
router.get('/program-areas', getProgramAreas);
router.get('/specialties', getSpecialties);
router.get('/cases', getAllCases);
router.put('/cases/:caseId', updateCase);
router.delete('/cases/:caseId', deleteCase);

// User scores routes
router.get('/users/scores', getUsersWithScores);

// System stats route
router.get('/stats', getSystemStats);

export default router;