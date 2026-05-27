/**
 * Unified Progress Routes
 * 
 * RESOURCE-CENTRIC: All progress and performance tracking consolidated here.
 * Replaces: performanceRoutes.js, performanceReviewRoutes.js,
 *           clinicianProgressRoutes.js, studentProgressRoutes.js
 */

import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAnyRole } from '../middleware/rbacMiddleware.js';
import * as progressController from '../controllers/progressController.js';

const router = express.Router();

router.use(authenticateToken);

// ──────────────────────────────────────────────
// PERFORMANCE SUMMARY
// ──────────────────────────────────────────────

/**
 * GET /api/progress
 * Get progress data - role-aware (student sees own, educator sees students, admin sees all)
 */
router.get('/', progressController.getProgress);

/**
 * GET /api/progress/performance-summary/:userId
 */
router.get('/performance-summary/:userId', progressController.getPerformanceSummary);

// ──────────────────────────────────────────────
// LEADERBOARD
// ──────────────────────────────────────────────

/**
 * GET /api/progress/leaderboard
 */
router.get('/leaderboard', progressController.getLeaderboard);

// ──────────────────────────────────────────────
// ELIGIBILITY (for case contribution)
// ──────────────────────────────────────────────

/**
 * GET /api/progress/eligibility/:userId/:specialty
 */
router.get('/eligibility/:userId/:specialty', progressController.getEligibility);

/**
 * POST /api/progress/record-progress
 */
router.post('/record-progress', progressController.recordProgress);

export default router;

