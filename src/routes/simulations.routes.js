/**
 * Unified Simulation Routes
 * 
 * RESOURCE-CENTRIC: All simulation session operations.
 * Direct migration from simulationRoutes.js with role-aware enhancements.
 */

import express from 'express';
import { protect, optionalAuth } from '../middleware/jwtAuthMiddleware.js';
import { requireAnyRole } from '../middleware/rbacMiddleware.js';
import { validateEndSession, validateObjectId, validateTreatmentPlan } from '../middleware/validation.js';
import { endSessionLimiter } from '../middleware/rateLimiter.js';
import {
  getCases,
  startSimulation,
  handleAsk,
  endSession,
  getCaseCategories,
  getPerformanceMetricsBySession,
  submitTreatmentPlan,
  getTreatmentOutcomes,
  startRetakeSession,
  getCaseRetakeSessions,
  calculateImprovementMetrics
} from '../controllers/simulationController.js';

const router = express.Router();

/**
 * GET /api/simulations
 * Get available simulation cases
 * Student → cases available to them
 * Educator/Admin → cases they manage/view
 */
router.get('/', protect, getCases);

/**
 * GET /api/simulations/categories
 * Case categories
 */
router.get('/categories', optionalAuth, getCaseCategories);

/**
 * POST /api/simulations
 * Start a simulation session
 */
router.post('/', protect, startSimulation);

/**
 * GET /api/simulations/ask
 * Ask a question during a simulation
 */
router.get('/ask', optionalAuth, handleAsk);

/**
 * POST /api/simulations/:sessionId/end
 * End a simulation session
 */
router.post('/:sessionId/end', protect, endSessionLimiter, validateEndSession, endSession);

/**
 * GET /api/simulations/:sessionId/performance
 * Get performance metrics for a session
 */
router.get('/:sessionId/performance', protect, validateObjectId('sessionId'), getPerformanceMetricsBySession);

/**
 * POST /api/simulations/:sessionId/treatment-plan
 * Submit a treatment plan
 */
router.post('/:sessionId/treatment-plan', protect, validateObjectId('sessionId'), validateTreatmentPlan, submitTreatmentPlan);

/**
 * GET /api/simulations/:sessionId/treatment-outcomes
 * Get treatment outcomes
 */
router.get('/:sessionId/treatment-outcomes', protect, validateObjectId('sessionId'), getTreatmentOutcomes);

// ──────────────────────────────────────────────
// RETAKE SESSIONS
// ──────────────────────────────────────────────

/**
 * POST /api/simulations/retakes
 * Start a retake session
 */
router.post('/retakes', protect, startRetakeSession);

/**
 * GET /api/simulations/retakes/:caseId
 * Get retake sessions for a case
 */
router.get('/retakes/:caseId', protect, getCaseRetakeSessions);

/**
 * POST /api/simulations/retakes/calculate-improvement
 */
router.post('/retakes/calculate-improvement', protect, calculateImprovementMetrics);

export default router;
