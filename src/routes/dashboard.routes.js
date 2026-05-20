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
import studentDashboardService from '../services/StudentDashboardService.js';
import educatorDashboardService from '../services/EducatorDashboardService.js';
import adminStatsService from '../services/adminStatsService.js';
import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/dashboard
 * Role-aware dashboard data
 */
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role;
    let data = {};

    if (role === 'student') {
      const [performanceData, availableCases, progressStats, recommendations] = await Promise.all([
        studentDashboardService.getPerformanceMetrics(req.user),
        studentDashboardService.getAvailableCases(req.user),
        studentDashboardService.getProgressStats(req.user),
        studentDashboardService.getRecommendations(req.user)
      ]);
      data = { performanceData, availableCases, progressStats, recommendations };
    } else if (role === 'educator') {
      const [performanceMetrics, caseStatistics, studentStatistics] = await Promise.all([
        educatorDashboardService.getPerformanceMetrics(req.user),
        educatorDashboardService.getCaseStatistics(req.user),
        educatorDashboardService.getStudentStatistics(req.user)
      ]);
      data = { performanceMetrics, caseStatistics, studentStatistics };
    } else if (role === 'admin') {
      const stats = await adminStatsService.getComprehensiveStats();
      data = stats;
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load dashboard' });
  }
});

/**
 * GET /api/dashboard/stats
 * Stats summary - role-aware
 */
router.get('/stats', async (req, res) => {
  try {
    const role = req.user?.role;

    if (role === 'student') {
      const progress = await studentDashboardService.getProgressStats(req.user);
      return res.json({ success: true, data: progress });
    } else if (role === 'educator') {
      const [performance, caseStats, studentStats] = await Promise.all([
        educatorDashboardService.getPerformanceMetrics(req.user),
        educatorDashboardService.getCaseStatistics(req.user),
        educatorDashboardService.getStudentStatistics(req.user)
      ]);
      return res.json({ success: true, data: { performance, caseStats, studentStats } });
    } else {
      const [totalUsers, totalCases, totalSessions] = await Promise.all([
        User.countDocuments(),
        Case.countDocuments({ status: 'published' }),
        PerformanceMetrics.countDocuments()
      ]);
      return res.json({ success: true, data: { totalUsers, totalCases, totalSessions } });
    }
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load stats' });
  }
});

// ──────────────────────────────────────────────
// STUDENT-SPECIFIC DASHBOARD
// ──────────────────────────────────────────────

/**
 * GET /api/dashboard/student/progress
 * Detailed student progress data
 */
router.get('/student/progress', requireAnyRole(['student']), async (req, res) => {
  try {
    const progress = await studentDashboardService.getProgressStats(req.user);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load progress' });
  }
});

/**
 * GET /api/dashboard/student/recommendations
 */
router.get('/student/recommendations', requireAnyRole(['student']), async (req, res) => {
  try {
    const recommendations = await studentDashboardService.getRecommendations(req.user);
    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load recommendations' });
  }
});

/**
 * GET /api/dashboard/student/activity-feed
 */
router.get('/student/activity-feed', requireAnyRole(['student']), async (req, res) => {
  try {
    const activityFeed = await studentDashboardService.getActivityFeed(req.user);
    res.json({ success: true, data: activityFeed });
  } catch (error) {
    console.error('Get activity feed error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load activity feed' });
  }
});

// ──────────────────────────────────────────────
// EDUCATOR-SPECIFIC DASHBOARD
// ──────────────────────────────────────────────

/**
 * GET /api/dashboard/educator/students
 * Educator's student list with progress data
 */
router.get('/educator/students', requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const students = await educatorDashboardService.getStudentList(req.user);
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Get educator students error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load students' });
  }
});

/**
 * GET /api/dashboard/educator/cases
 * Educator's case management data
 */
router.get('/educator/cases', requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const caseData = await educatorDashboardService.getCaseManagementData(req.user);
    res.json({ success: true, data: caseData });
  } catch (error) {
    console.error('Get educator cases error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load cases' });
  }
});

export default router;
