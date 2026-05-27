/**
 * Unified Analytics Routes
 * 
 * RESOURCE-CENTRIC: All analytics consolidated here.
 * Replaces: analyticsRoutes.js, progressAnalyticsRoutes.js,
 *           adminRoutes.js (analytics parts), educatorRoutes.js (analytics parts)
 */

import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAnyRole } from '../middleware/rbacMiddleware.js';
import * as analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

// Apply authentication to all analytics routes
router.use(authenticateToken);

// ──────────────────────────────────────────────
// CASE USAGE & EFFECTIVENESS ANALYTICS
// ──────────────────────────────────────────────

/**
 * GET /api/analytics/case-usage
 * Case usage analytics (admin/educator)
 */
router.get('/case-usage', requireAnyRole(['admin', 'educator']), analyticsController.getCaseUsageAnalytics);

/**
 * GET /api/analytics/case-effectiveness
 * Case effectiveness metrics (admin/educator)
 */
router.get('/case-effectiveness', requireAnyRole(['admin', 'educator']), analyticsController.getCaseEffectivenessMetrics);

/**
 * GET /api/analytics/difficulty-analysis
 */
router.get('/difficulty-analysis', requireAnyRole(['admin', 'educator']), analyticsController.getDifficultyAnalysis);

/**
 * GET /api/analytics/performance-trends
 */
router.get('/performance-trends', requireAnyRole(['admin', 'educator']), analyticsController.getPerformanceTrends);

/**
 * GET /api/analytics/contributor-analytics
 * (admin only)
 */
router.get('/contributor-analytics', requireAnyRole(['admin']), analyticsController.getContributorAnalytics);

/**
 * GET /api/analytics/review-quality
 * (admin only)
 */
router.get('/review-quality', requireAnyRole(['admin']), analyticsController.getReviewQualityMetrics);

// ──────────────────────────────────────────────
// PROGRESS ANALYTICS (per user)
// ──────────────────────────────────────────────

/**
 * GET /api/analytics/progress/realtime/:userId
 */
router.get('/progress/realtime/:userId', requireAnyRole(['student', 'educator', 'admin']), analyticsController.getRealTimeProgress);

/**
 * GET /api/analytics/progress/competency-trends/:userId
 */
router.get('/progress/competency-trends/:userId', requireAnyRole(['student', 'educator', 'admin']), analyticsController.analyzeCompetencyTrends);

/**
 * GET /api/analytics/progress/benchmarks/:userId
 */
router.get('/progress/benchmarks/:userId', requireAnyRole(['student', 'educator', 'admin']), analyticsController.compareToBenchmarks);

/**
 * GET /api/analytics/progress/predictions/:userId
 */
router.get('/progress/predictions/:userId', requireAnyRole(['student', 'educator', 'admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange } = req.query;

    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const predictionData = await ProgressAnalyticsService.predictLearningOutcomes(userId, {
      timeRange: timeRange || '90d'
    });
    res.json({ success: true, data: predictionData });
  } catch (error) {
    console.error('Predict learning outcomes error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to predict learning outcomes' });
  }
});

/**
 * GET /api/analytics/progress/visualization/:userId
 */
router.get('/progress/visualization/:userId', requireAnyRole(['student', 'educator', 'admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const visualizationData = await ProgressAnalyticsService.getVisualizationData(userId);
    res.json({ success: true, data: visualizationData });
  } catch (error) {
    console.error('Get visualization data error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate visualization data' });
  }
});

// ──────────────────────────────────────────────
// EDUCATORS / ADMIN DASHBOARD ANALYTICS
// ──────────────────────────────────────────────

/**
 * GET /api/analytics/educator/dashboard
 * Full educator analytics suite
 */
router.get('/educator/dashboard', requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const [performanceMetrics, caseStatistics, studentStatistics] = await Promise.all([
      educatorDashboardService.getPerformanceMetrics(req.user),
      educatorDashboardService.getCaseStatistics(req.user),
      educatorDashboardService.getStudentStatistics(req.user)
    ]);
    res.json({ success: true, data: { performanceMetrics, caseStatistics, studentStatistics } });
  } catch (error) {
    console.error('Get educator analytics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load analytics' });
  }
});

// ──────────────────────────────────────────────
// CACHE MANAGEMENT
// ──────────────────────────────────────────────

router.post('/clear-cache', requireAnyRole(['admin']), async (req, res) => {
  try {
    AnalyticsService.clearCache();
    ProgressAnalyticsService.clearCache();
    res.json({ success: true, message: 'Analytics cache cleared successfully' });
  } catch (error) {
    console.error('Clear analytics cache error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to clear analytics cache' });
  }
});

export default router;
