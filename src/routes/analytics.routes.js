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
import AnalyticsService from '../services/AnalyticsService.js';
import ProgressAnalyticsService from '../services/ProgressAnalyticsService.js';
import educatorDashboardService from '../services/EducatorDashboardService.js';
import studentDashboardService from '../services/StudentDashboardService.js';

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
router.get('/case-usage', requireAnyRole(['admin', 'educator']), async (req, res) => {
  try {
    const { timeRange = '30d', specialty, difficulty, programArea } = req.query;
    const analytics = await AnalyticsService.getCaseUsageAnalytics({
      timeRange,
      specialty: specialty || undefined,
      difficulty: difficulty || undefined,
      programArea: programArea || undefined
    });
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Get case usage analytics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch case usage analytics' });
  }
});

/**
 * GET /api/analytics/case-effectiveness
 * Case effectiveness metrics (admin/educator)
 */
router.get('/case-effectiveness', requireAnyRole(['admin', 'educator']), async (req, res) => {
  try {
    const { caseId } = req.query;
    const metrics = await AnalyticsService.getCaseEffectivenessMetrics(caseId || null);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Get case effectiveness metrics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch case effectiveness metrics' });
  }
});

/**
 * GET /api/analytics/difficulty-analysis
 */
router.get('/difficulty-analysis', requireAnyRole(['admin', 'educator']), async (req, res) => {
  try {
    const { specialty, programArea } = req.query;
    const analysis = await AnalyticsService.getDifficultyAnalysis({
      specialty: specialty || undefined,
      programArea: programArea || undefined
    });
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Get difficulty analysis error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch difficulty analysis' });
  }
});

/**
 * GET /api/analytics/performance-trends
 */
router.get('/performance-trends', requireAnyRole(['admin', 'educator']), async (req, res) => {
  try {
    const { timeRange = '90d', interval = 'week' } = req.query;
    const trends = await AnalyticsService.getPerformanceTrends(timeRange, interval);
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Get performance trends error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch performance trends' });
  }
});

/**
 * GET /api/analytics/contributor-analytics
 * (admin only)
 */
router.get('/contributor-analytics', requireAnyRole(['admin']), async (req, res) => {
  try {
    const analytics = await AnalyticsService.getContributorAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Get contributor analytics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch contributor analytics' });
  }
});

/**
 * GET /api/analytics/review-quality
 * (admin only)
 */
router.get('/review-quality', requireAnyRole(['admin']), async (req, res) => {
  try {
    const { timeRange = '30d', reviewerId } = req.query;
    const metrics = await AnalyticsService.getReviewQualityMetrics({
      timeRange,
      reviewerId: reviewerId || undefined
    });
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Get review quality metrics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch review quality metrics' });
  }
});

// ──────────────────────────────────────────────
// PROGRESS ANALYTICS (per user)
// ──────────────────────────────────────────────

/**
 * GET /api/analytics/progress/realtime/:userId
 */
router.get('/progress/realtime/:userId', requireAnyRole(['student', 'educator', 'admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange, granularity } = req.query;

    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const progressData = await ProgressAnalyticsService.getRealTimeProgress(userId, {
      timeRange: timeRange || '30d',
      granularity: granularity || 'week'
    });
    res.json({ success: true, data: progressData });
  } catch (error) {
    console.error('Get real-time progress error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch real-time progress data' });
  }
});

/**
 * GET /api/analytics/progress/competency-trends/:userId
 */
router.get('/progress/competency-trends/:userId', requireAnyRole(['student', 'educator', 'admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange, granularity } = req.query;

    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const trendData = await ProgressAnalyticsService.analyzeCompetencyTrends(userId, {
      timeRange: timeRange || '90d',
      granularity: granularity || 'week'
    });
    res.json({ success: true, data: trendData });
  } catch (error) {
    console.error('Analyze competency trends error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to analyze competency trends' });
  }
});

/**
 * GET /api/analytics/progress/benchmarks/:userId
 */
router.get('/progress/benchmarks/:userId', requireAnyRole(['student', 'educator', 'admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { specialty, difficulty, programArea } = req.query;

    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const benchmarkData = await ProgressAnalyticsService.compareToBenchmarks(userId, {
      specialty: specialty || undefined,
      difficulty: difficulty || undefined,
      programArea: programArea || undefined
    });
    res.json({ success: true, data: benchmarkData });
  } catch (error) {
    console.error('Compare to benchmarks error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to compare against benchmarks' });
  }
});

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
