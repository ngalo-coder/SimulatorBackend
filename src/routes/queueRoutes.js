import express from 'express';
import { startQueueSession, getNextCaseInQueue, markCaseStatus } from '../controllers/queueController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes in this file will be protected and expect a valid JWT

// Base path for these routes will be /api/users (defined in index.js)

// Initialize or Resume Queue Session
// POST /api/users/queue/session/start
router.post('/queue/session/start', protect, startQueueSession);

// Get Next Case in Queue Session
// POST /api/users/queue/session/:sessionId/next
router.post('/queue/session/:sessionId/next', protect, getNextCaseInQueue);

// Mark Case Interaction Status
// POST /api/users/cases/:originalCaseIdString/status
router.post('/cases/:originalCaseIdString/status', protect, markCaseStatus);

export default router;
