import express from 'express';
import { protect } from '../middleware/jwtAuthMiddleware.js';
import { 
  getCases, 
  startSimulation,
  handleAsk,
  endSession,
  getCaseCategories,
  getPerformanceMetricsBySession, // Import new controller function
  getPerformanceMetricsByUser // Import new controller function for future use
} from '../controllers/simulationController.js';

const router = express.Router();

// Protect all simulation routes
router.use(protect);

router.get('/cases', getCases);
router.get('/case-categories', getCaseCategories);
router.post('/start', startSimulation);
router.get('/ask', handleAsk);
router.post('/end', endSession);

// Routes for performance metrics
router.get('/performance-metrics/session/:sessionId', getPerformanceMetricsBySession);
// The following route is for future implementation when user tracking is in place:
// router.get('/performance-metrics/user/:userId', getPerformanceMetricsByUser);

export default router;