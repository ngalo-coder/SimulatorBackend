import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
  getClinicianProgress, 
  updateProgressAfterCase, 
  getProgressRecommendations 
} from '../controllers/clinicianProgressController.js';

const router = express.Router();

// All routes in this file will be protected and expect a valid JWT
router.use(protect);

// GET /api/progress/:userId - Get clinician progress
router.get('/:userId', getClinicianProgress);

// POST /api/progress/update - Update progress after case completion
router.post('/update', updateProgressAfterCase);

// GET /api/progress/recommendations/:userId - Get case recommendations based on progress
router.get('/recommendations/:userId', getProgressRecommendations);

export default router;