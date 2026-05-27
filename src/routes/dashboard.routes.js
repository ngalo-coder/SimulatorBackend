/**
 * Unified Dashboard Routes
 * 
 * RESOURCE-CENTRIC: All dashboard data consolidated here.
 * Replaces: studentRoutes.js (dashboard parts), educatorRoutes.js (dashboard parts),
 *           adminRoutes.js (dashboard/stats parts)
 */

import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAnyRole } from '../middleware/rbacMiddleware.js';
import * as dashboardController from '../controllers/dashboardController.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/dashboard
 * Role-aware dashboard data
 */
router.get('/', dashboardController.getDashboard);

/**
 * GET /api/dashboard/stats
 * Stats summary - role-aware
 */
router.get('/stats', dashboardController.getStats);

// ──────────────────────────────────────────────
// STUDENT-SPECIFIC DASHBOARD
// ──────────────────────────────────────────────

/**
 * GET /api/dashboard/student/progress
 * Detailed student progress data
 */
router.get('/student/progress', requireAnyRole(['student']), dashboardController.getStudentProgress);

/**
 * GET /api/dashboard/student/recommendations
 */
router.get('/student/recommendations', requireAnyRole(['student']), dashboardController.getStudentRecommendations);

/**
 * GET /api/dashboard/student/activity-feed
 */
router.get('/student/activity-feed', requireAnyRole(['student']), dashboardController.getActivityFeed);

// ──────────────────────────────────────────────
// EDUCATOR-SPECIFIC DASHBOARD
// ──────────────────────────────────────────────

/**
 * GET /api/dashboard/educator/students
 * Educator's student list with progress data
 */
router.get('/educator/students', requireAnyRole(['educator', 'admin']), dashboardController.getEducatorStudents);

/**
 * GET /api/dashboard/educator/cases
 * Educator's case management data
 */
router.get('/educator/cases', requireAnyRole(['educator', 'admin']), dashboardController.getCaseStatistics);

export default router;
