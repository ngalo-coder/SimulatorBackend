/**
 * Progress Controller
 * Orchestrates progress tracking, performance metrics, and leaderboard data
 */

import ClinicianPerformance from '../models/ClinicianPerformanceModel.js';
import ClinicianProgress from '../models/ClinicianProgressModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';
import User from '../models/UserModel.js';
import studentDashboardService from '../services/StudentDashboardService.js';

export async function getProgress(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?._id?.toString();

    if (role === 'student') {
      // Return student's own progress
      const progress = await ClinicianProgress.findOne({ userId });
      if (!progress) {
        return res.json({
          success: true,
          data: { totalCasesCompleted: 0, overallAverageScore: 0, specialtyBreakdown: {}, recentActivity: [] }
        });
      }
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
}

export async function getPerformanceSummary(req, res) {
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
          userId: performance.userId,
          name: performance.name,
          email: performance.email,
          overallStats: {
            totalEvaluations: performance.evaluationHistory.length,
            excellentCount: performance.evaluationHistory.filter(e => e.overallRating === 'Excellent').length,
            goodCount: performance.evaluationHistory.filter(e => e.overallRating === 'Good').length,
            needsImprovementCount: performance.evaluationHistory.filter(e => e.overallRating === 'Needs Improvement').length
          },
          specialtyStats: Object.fromEntries(performance.specialtyStats),
          contributorStatus: performance.contributorStatus,
          contributionStats: performance.contributionStats,
          recentEvaluations: performance.evaluationHistory
            .slice(-10)
            .reverse()
            .map(e => ({
              caseTitle: e.caseTitle,
              specialty: e.specialty,
              rating: e.overallRating,
              score: e.totalScore,
              completedAt: e.completedAt
            }))
        }
      });
    }

    // Fallback to legacy progress system
    const progress = await ClinicianProgress.findOne({ userId });
    if (!progress) {
      return res.status(404).json({ success: false, message: 'No performance data found' });
    }

    const recentMetrics = await PerformanceMetrics.find({ user_ref: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('case_ref', 'case_metadata.title case_metadata.specialty');

    return res.json({
      success: true,
      data: {
        userId,
        name: progress.userId?.username || 'User',
        email: progress.userId?.email || '',
        overallStats: {
          totalEvaluations: progress.totalCasesCompleted,
          excellentCount: recentMetrics.filter(m => (m.metrics?.overall_score || 0) >= 90).length,
          goodCount: recentMetrics.filter(m => (m.metrics?.overall_score || 0) >= 70 && (m.metrics?.overall_score || 0) < 90).length,
          needsImprovementCount: recentMetrics.filter(m => (m.metrics?.overall_score || 0) < 70).length
        },
        recentEvaluations: recentMetrics.map(m => ({
          caseTitle: m.case_ref?.case_metadata?.title || 'Unknown',
          specialty: m.case_ref?.case_metadata?.specialty || 'General',
          rating:
            (m.metrics?.overall_score || 0) >= 90
              ? 'Excellent'
              : (m.metrics?.overall_score || 0) >= 70
              ? 'Good'
              : 'Needs Improvement',
          score: m.metrics?.overall_score || 0,
          completedAt: m.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Get performance summary error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load performance summary' });
  }
}

export async function getLeaderboard(req, res) {
  try {
    const { specialty, limit = 10 } = req.query;

    const progressRecords = await ClinicianProgress.find({})
      .populate('userId', 'username email')
      .limit(parseInt(limit))
      .sort({ overallAverageScore: -1 });

    const leaderboard = await Promise.all(
      progressRecords.map(async progress => {
        const recentMetrics = await PerformanceMetrics.find({ user_ref: progress.userId })
          .sort({ createdAt: -1 })
          .limit(20);

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
      })
    );

    leaderboard.sort((a, b) => b.excellentRate - a.excellentRate || b.totalCases - a.totalCases);

    res.json({ success: true, data: leaderboard.slice(0, parseInt(limit)) });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch leaderboard' });
  }
}

export async function getEligibility(req, res) {
  try {
    const { userId, specialty } = req.params;

    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const performance = await ClinicianPerformance.findOne({ userId });
    if (!performance) {
      return res.json({ eligible: false, reason: 'No performance record found' });
    }

    const isEligible = performance.contributorStatus.eligibleSpecialties.includes(specialty);
    const criteria = performance.contributorStatus.eligibilityCriteria.get(specialty);

    res.json({
      eligible: isEligible,
      specialty,
      criteria: criteria || {
        excellentCount: 0,
        recentExcellent: false,
        consistentPerformance: false,
        qualificationMet: false
      },
      requirements: {
        excellentRatingsNeeded: Math.max(0, 3 - (criteria?.excellentCount || 0)),
        needsRecentExcellent: !criteria?.recentExcellent
      }
    });
  } catch (error) {
    console.error('Get eligibility error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to check eligibility' });
  }
}

export async function recordProgress(req, res) {
  try {
    const { userId, caseId, score, specialty } = req.body;

    if (!userId || !caseId || score === undefined) {
      return res.status(400).json({ success: false, message: 'userId, caseId, and score are required' });
    }

    // Record in performance metrics
    const metric = new PerformanceMetrics({
      user_ref: userId,
      case_ref: caseId,
      metrics: {
        overall_score: score,
        specialty: specialty
      }
    });

    await metric.save();

    // Update progress record
    let progress = await ClinicianProgress.findOne({ userId });
    if (!progress) {
      progress = new ClinicianProgress({ userId, totalCasesCompleted: 0, overallAverageScore: 0 });
    }

    progress.totalCasesCompleted = (progress.totalCasesCompleted || 0) + 1;
    progress.overallAverageScore =
      ((progress.overallAverageScore * ((progress.totalCasesCompleted || 1) - 1)) + score) /
      (progress.totalCasesCompleted || 1);

    await progress.save();

    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Record progress error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to record progress' });
  }
}
