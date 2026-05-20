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
import ClinicianPerformance from '../models/ClinicianPerformanceModel.js';
import ClinicianProgress from '../models/ClinicianProgressModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';
import User from '../models/UserModel.js';
import helpGuidanceService from '../services/HelpGuidanceService.js';
import adaptiveLearningService from '../services/AdaptiveLearningService.js';
import userPreferencesService from '../services/UserPreferencesService.js';
import ProgressPDFService from '../services/ProgressPDFService.js';
import studentDashboardService from '../services/StudentDashboardService.js';

const router = express.Router();

router.use(authenticateToken);

// ──────────────────────────────────────────────
// PERFORMANCE SUMMARY
// ──────────────────────────────────────────────

/**
 * GET /api/progress
 * Get progress data - role-aware (student sees own, educator sees students, admin sees all)
 */
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?._id?.toString();

    if (role === 'student') {
      // Return student's own progress
      const progress = await ClinicianProgress.findOne({ userId });
      if (!progress) return res.json({ success: true, data: { totalCasesCompleted: 0, overallAverageScore: 0, specialtyBreakdown: {}, recentActivity: [] } });
      return res.json({ success: true, data: progress });
    } else if (role === 'educator') {
      // Return aggregated progress for all students of this educator (simplified)
      const allProgress = await ClinicianProgress.find({}).populate('userId', 'username profile.firstName profile.lastName email');
      return res.json({ success: true, data: allProgress });
    } else {
      // Admin sees all progress data
      const allProgress = await ClinicianProgress.find({}).populate('userId', 'username email role');
      const totalStudents = await User.countDocuments({ role: 'student' });
      return res.json({ success: true, data: { progressRecords: allProgress, meta: { totalStudents } } });
    }
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load progress data' });
  }
});

/**
 * GET /api/progress/performance-summary/:userId
 */
router.get('/performance-summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Access control
    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Try new performance system first
    let performance = await ClinicianPerformance.findOne({ userId });
    if (performance) {
      return res.json({
        success: true,
        data: {
          userId: performance.userId, name: performance.name, email: performance.email,
          overallStats: {
            totalEvaluations: performance.evaluationHistory.length,
            excellentCount: performance.evaluationHistory.filter(e => e.overallRating === 'Excellent').length,
            goodCount: performance.evaluationHistory.filter(e => e.overallRating === 'Good').length,
            needsImprovementCount: performance.evaluationHistory.filter(e => e.overallRating === 'Needs Improvement').length
          },
          specialtyStats: Object.fromEntries(performance.specialtyStats),
          contributorStatus: performance.contributorStatus,
          contributionStats: performance.contributionStats,
          recentEvaluations: performance.evaluationHistory.slice(-10).reverse().map(e => ({
            caseTitle: e.caseTitle, specialty: e.specialty,
            rating: e.overallRating, score: e.totalScore,
            completedAt: e.completedAt
          }))
        }
      });
    }

    // Fallback to legacy progress system
    const progress = await ClinicianProgress.findOne({ userId });
    if (!progress) return res.status(404).json({ success: false, message: 'No performance data found' });

    const recentMetrics = await PerformanceMetrics.find({ user_ref: userId })
      .sort({ createdAt: -1 }).limit(10)
      .populate('case_ref', 'case_metadata.title case_metadata.specialty');

    return res.json({
      success: true,
      data: {
        userId, name: progress.userId?.username || 'User', email: progress.userId?.email || '',
        overallStats: {
          totalEvaluations: progress.totalCasesCompleted,
          excellentCount: recentMetrics.filter(m => (m.metrics?.overall_score || 0) >= 90).length,
          goodCount: recentMetrics.filter(m => (m.metrics?.overall_score || 0) >= 70 && (m.metrics?.overall_score || 0) < 90).length,
          needsImprovementCount: recentMetrics.filter(m => (m.metrics?.overall_score || 0) < 70).length
        },
        recentEvaluations: recentMetrics.map(m => ({
          caseTitle: m.case_ref?.case_metadata?.title || 'Unknown',
          specialty: m.case_ref?.case_metadata?.specialty || 'General',
          rating: (m.metrics?.overall_score || 0) >= 90 ? 'Excellent' : (m.metrics?.overall_score || 0) >= 70 ? 'Good' : 'Needs Improvement',
          score: m.metrics?.overall_score || 0,
          completedAt: m.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Get performance summary error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load performance summary' });
  }
});

// ──────────────────────────────────────────────
// LEADERBOARD
// ──────────────────────────────────────────────

/**
 * GET /api/progress/leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { specialty, limit = 10 } = req.query;

    const progressRecords = await ClinicianProgress.find({})
      .populate('userId', 'username email')
      .limit(parseInt(limit))
      .sort({ overallAverageScore: -1 });

    const leaderboard = await Promise.all(progressRecords.map(async (progress) => {
      const recentMetrics = await PerformanceMetrics.find({ user_ref: progress.userId })
        .sort({ createdAt: -1 }).limit(20);

      const excellentCount = recentMetrics.filter(m => (m.metrics?.overall_score || 0) >= 90).length;
      const totalCases = progress.totalCasesCompleted;

      return {
        userId: progress.userId?._id,
        name: progress.userId?.username || 'Anonymous',
        totalCases,
        excellentCount,
        excellentRate: totalCases > 0 ? ((excellentCount / totalCases) * 100).toFixed(1) : 0,
        averageScore: progress.overallAverageScore?.toFixed(1) || 0,
        isContributor: false
      };
    }));

    leaderboard.sort((a, b) => b.excellentRate - a.excellentRate || b.totalCases - a.totalCases);

    res.json({ success: true, data: leaderboard.slice(0, parseInt(limit)) });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch leaderboard' });
  }
});

// ──────────────────────────────────────────────
// ELIGIBILITY (for case contribution)
// ──────────────────────────────────────────────

/**
 * GET /api/progress/eligibility/:userId/:specialty
 */
router.get('/eligibility/:userId/:specialty', async (req, res) => {
  try {
    const { userId, specialty } = req.params;

    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const performance = await ClinicianPerformance.findOne({ userId });
    if (!performance) return res.json({ eligible: false, reason: 'No performance record found' });

    const isEligible = performance.contributorStatus.eligibleSpecialties.includes(specialty);
    const criteria = performance.contributorStatus.eligibilityCriteria.get(specialty);

    res.json({
      eligible: isEligible, specialty,
      criteria: criteria || { excellentCount: 0, recentExcellent: false, consistentPerformance: false, qualificationMet: false },
      requirements: {
        excellentRatingsNeeded: Math.max(0, 3 - (criteria?.excellentCount || 0)),
        needsRecentExcellent: !criteria?.recentExcellent,
        needsConsistentPerformance: !criteria?.consistentPerformance
      }
    });
  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to check eligibility' });
  }
});

/**
 * POST /api/progress/update-contribution/:userId
 */
router.post('/update-contribution/:userId', requireAnyRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const performance = await ClinicianPerformance.findOne({ userId });
    if (!performance) return res.status(404).json({ success: false, message: 'Performance record not found' });

    performance.updateContributionStats(status);
    await performance.save();

    res.json({ success: true, message: 'Contribution stats updated', contributionStats: performance.contributionStats });
  } catch (error) {
    console.error('Update contribution stats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update contribution stats' });
  }
});

/**
 * GET /api/progress/eligible-contributors/:specialty
 */
router.get('/eligible-contributors/:specialty', requireAnyRole(['admin']), async (req, res) => {
  try {
    const { specialty } = req.params;
    const eligibleContributors = await ClinicianPerformance.getEligibleContributors(specialty);
    const contributors = eligibleContributors.map(p => ({
      userId: p.userId, name: p.name, email: p.email,
      qualificationDate: p.contributorStatus.qualificationDate,
      specialtyStats: p.specialtyStats.get(specialty) || {},
      contributionStats: p.contributionStats
    }));
    res.json({ success: true, data: contributors });
  } catch (error) {
    console.error('Fetch eligible contributors error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch eligible contributors' });
  }
});

/**
 * POST /api/progress/record-evaluation
 */
router.post('/record-evaluation', async (req, res) => {
  try {
    const { userId, sessionId, caseId, caseTitle, specialty, overallRating, totalScore, ...rest } = req.body;

    let performance = await ClinicianPerformance.findOne({ userId });
    if (!performance) {
      performance = new ClinicianPerformance({
        userId,
        email: req.body.userEmail,
        name: req.body.userName,
        evaluationHistory: [],
        specialtyStats: new Map(),
        contributorStatus: { isEligible: false, eligibleSpecialties: [], eligibilityCriteria: new Map() }
      });
    }

    performance.addEvaluation({
      sessionId, caseId, caseTitle, specialty,
      module: rest.module, programArea: rest.programArea,
      overallRating, criteriaScores: new Map(Object.entries(rest.criteriaScores || {})),
      totalScore, duration: rest.duration, messagesExchanged: rest.messagesExchanged,
      completedAt: new Date()
    });
    await performance.save();

    res.json({
      message: 'Evaluation recorded successfully',
      contributorEligible: performance.contributorStatus.isEligible,
      eligibleSpecialties: performance.contributorStatus.eligibleSpecialties,
      specialtyStats: Object.fromEntries(performance.specialtyStats)
    });
  } catch (error) {
    console.error('Record evaluation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to record evaluation' });
  }
});

// ──────────────────────────────────────────────
// HELP & GUIDANCE (student-centric)
// ──────────────────────────────────────────────

/**
 * GET /api/progress/help/contextual
 */
router.get('/help/contextual', async (req, res) => {
  try {
    const context = { page: req.query.page, caseId: req.query.caseId, difficulty: req.query.difficulty };
    const helpData = await helpGuidanceService.getContextualHelp(req.user, context);
    res.json({ success: true, data: helpData });
  } catch (error) {
    console.error('Get contextual help error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load contextual help' });
  }
});

/**
 * GET /api/progress/help/search
 */
router.get('/help/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ success: false, message: 'Search query is required' });
    const searchResults = await helpGuidanceService.searchHelp(query, req.user);
    res.json({ success: true, data: searchResults });
  } catch (error) {
    console.error('Search help error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to search help content' });
  }
});

/**
 * GET /api/progress/help/categories
 */
router.get('/help/categories', async (req, res) => {
  try {
    const categories = helpGuidanceService.getHelpCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get help categories error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load help categories' });
  }
});

/**
 * GET /api/progress/help/categories/:categoryId
 */
router.get('/help/categories/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const categoryHelp = await helpGuidanceService.getHelpByCategory(categoryId, req.user);
    res.json({ success: true, data: categoryHelp });
  } catch (error) {
    console.error('Get help by category error:', error);
    res.status(404).json({ success: false, message: error.message || 'Category not found' });
  }
});

/**
 * GET /api/progress/help/tutorials/:tutorialId
 */
router.get('/help/tutorials/:tutorialId', async (req, res) => {
  try {
    const { tutorialId } = req.params;
    const tutorial = await helpGuidanceService.getTutorial(tutorialId, req.user);
    res.json({ success: true, data: tutorial });
  } catch (error) {
    console.error('Get tutorial error:', error);
    res.status(404).json({ success: false, message: error.message || 'Tutorial not found' });
  }
});

/**
 * GET /api/progress/guidance
 */
router.get('/guidance', async (req, res) => {
  try {
    const guidance = await helpGuidanceService.getPersonalizedGuidance(req.user);
    res.json({ success: true, data: guidance });
  } catch (error) {
    console.error('Get personalized guidance error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load personalized guidance' });
  }
});

// ──────────────────────────────────────────────
// ADAPTIVE LEARNING
// ──────────────────────────────────────────────

/**
 * GET /api/progress/learning-efficiency
 */
router.get('/learning-efficiency', async (req, res) => {
  try {
    const efficiency = await adaptiveLearningService.optimizeLearningEfficiency(req.user);
    res.json({ success: true, data: efficiency });
  } catch (error) {
    console.error('Optimize learning efficiency error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to optimize learning efficiency' });
  }
});

/**
 * POST /api/progress/adjust-difficulty
 */
router.post('/adjust-difficulty', async (req, res) => {
  try {
    const { caseId, performanceScore } = req.body;
    if (!caseId || performanceScore === undefined) {
      return res.status(400).json({ success: false, message: 'Case ID and performance score are required' });
    }
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) return res.status(404).json({ success: false, message: 'Case not found' });
    const adjustment = await adaptiveLearningService.adjustDifficulty(req.user, caseDoc, performanceScore);
    res.json({ success: true, data: adjustment });
  } catch (error) {
    console.error('Adjust difficulty error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to adjust difficulty' });
  }
});

/**
 * POST /api/progress/schedule-repetition
 */
router.post('/schedule-repetition', async (req, res) => {
  try {
    const { competency, performanceScore } = req.body;
    if (!competency || performanceScore === undefined) {
      return res.status(400).json({ success: false, message: 'Competency and performance score are required' });
    }
    const schedule = await adaptiveLearningService.scheduleSpacedRepetition(req.user, competency, performanceScore);
    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Schedule repetition error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to schedule repetition' });
  }
});

/**
 * GET /api/progress/learning-style
 */
router.get('/learning-style', async (req, res) => {
  try {
    const learningStyle = await adaptiveLearningService.assessLearningStyle(req.user);
    res.json({ success: true, data: learningStyle });
  } catch (error) {
    console.error('Assess learning style error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to assess learning style' });
  }
});

// ──────────────────────────────────────────────
// PROGRESS REPORT DOWNLOAD
// ──────────────────────────────────────────────

/**
 * GET /api/progress/download-pdf
 */
router.get('/download-pdf', async (req, res) => {
  try {
    const { format = 'comprehensive', timeRange = '90d' } = req.query;
    const username = req.user.username || 'student';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `progress-report-${username}-${timestamp}.pdf`;

    const pdfBuffer = await ProgressPDFService.generateProgressReport(req.user._id, {
      format, timeRange, user: req.user
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate progress PDF error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate progress report' });
  }
});

// ──────────────────────────────────────────────
// STUDENT ACHIEVEMENTS & ACTIVITY
// ──────────────────────────────────────────────

/**
 * GET /api/progress/achievements
 */
router.get('/achievements', async (req, res) => {
  try {
    const achievements = await studentDashboardService.getAchievements(req.user);
    res.json({ success: true, data: achievements });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load achievements' });
  }
});

/**
 * GET /api/progress/activity
 */
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const activities = await studentDashboardService.getRecentActivity(req.user, limit);
    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load activity' });
  }
});

export default router;
