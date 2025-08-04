import express from 'express';
import ClinicianPerformance from '../models/ClinicianPerformanceModel.js';
import ClinicianProgress from '../models/ClinicianProgressModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Add authentication middleware to all routes
router.use(protect);

// Record evaluation result and update performance
router.post('/record-evaluation', async (req, res) => {
  try {
    const {
      userId,
      userEmail,
      userName,
      sessionId,
      caseId,
      caseTitle,
      specialty,
      module,
      programArea,
      overallRating,
      criteriaScores,
      totalScore,
      duration,
      messagesExchanged
    } = req.body;

    // Find or create clinician performance record
    let performance = await ClinicianPerformance.findOne({ userId });
    
    if (!performance) {
      performance = new ClinicianPerformance({
        userId,
        email: userEmail,
        name: userName,
        evaluationHistory: [],
        specialtyStats: new Map(),
        contributorStatus: {
          isEligible: false,
          eligibleSpecialties: [],
          eligibilityCriteria: new Map()
        }
      });
    }

    // Add the evaluation
    const evaluationData = {
      sessionId,
      caseId,
      caseTitle,
      specialty,
      module,
      programArea,
      overallRating,
      criteriaScores: new Map(Object.entries(criteriaScores || {})),
      totalScore,
      duration,
      messagesExchanged,
      completedAt: new Date()
    };

    performance.addEvaluation(evaluationData);
    await performance.save();

    // Return updated eligibility status
    res.json({
      message: 'Evaluation recorded successfully',
      contributorEligible: performance.contributorStatus.isEligible,
      eligibleSpecialties: performance.contributorStatus.eligibleSpecialties,
      specialtyStats: Object.fromEntries(performance.specialtyStats)
    });

  } catch (error) {
    console.error('Error recording evaluation:', error);
    res.status(500).json({ error: 'Failed to record evaluation' });
  }
});

// Get clinician's performance summary
router.get('/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // First try to get data from ClinicianPerformance (new system)
    let performance = await ClinicianPerformance.findOne({ userId });
    
    // If not found, create summary from ClinicianProgress (legacy system)
    if (!performance) {
      const progress = await ClinicianProgress.findOne({ userId });
      const recentMetrics = await PerformanceMetrics.find({ user_ref: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('case_ref', 'case_metadata.title case_metadata.specialty case_metadata.difficulty');

      if (!progress) {
        return res.status(404).json({ error: 'Performance record not found' });
      }

      // Convert ClinicianProgress to PerformanceSummary format
      const totalEvaluations = progress.totalCasesCompleted;
      const excellentCount = recentMetrics.filter(m => m.metrics?.overall_score >= 90).length;
      const goodCount = recentMetrics.filter(m => m.metrics?.overall_score >= 70 && m.metrics?.overall_score < 90).length;
      const needsImprovementCount = recentMetrics.filter(m => m.metrics?.overall_score < 70).length;

      // Group metrics by specialty
      const specialtyStats = {};
      recentMetrics.forEach(metric => {
        const specialty = metric.case_ref?.case_metadata?.specialty || 'General';
        if (!specialtyStats[specialty]) {
          specialtyStats[specialty] = {
            totalCases: 0,
            excellentCount: 0,
            averageScore: 0,
            scores: []
          };
        }
        specialtyStats[specialty].totalCases++;
        specialtyStats[specialty].scores.push(metric.metrics?.overall_score || 0);
        if (metric.metrics?.overall_score >= 90) {
          specialtyStats[specialty].excellentCount++;
        }
      });

      // Calculate averages
      Object.keys(specialtyStats).forEach(specialty => {
        const stats = specialtyStats[specialty];
        stats.averageScore = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
        delete stats.scores; // Remove scores array from response
      });

      const summary = {
        userId: userId,
        name: req.user?.name || 'User',
        email: req.user?.email || '',
        
        overallStats: {
          totalEvaluations,
          excellentCount,
          goodCount,
          needsImprovementCount,
          excellentRate: totalEvaluations > 0 ? (excellentCount / totalEvaluations * 100).toFixed(1) : 0
        },
        
        specialtyStats,
        
        contributorStatus: {
          isEligible: false,
          eligibleSpecialties: [],
          qualificationDate: null,
          eligibilityCriteria: {}
        },
        
        contributionStats: {
          totalSubmissions: 0,
          approvedSubmissions: 0,
          rejectedSubmissions: 0,
          pendingSubmissions: 0
        },
        
        recentEvaluations: recentMetrics.map(m => ({
          caseTitle: m.case_ref?.case_metadata?.title || 'Unknown Case',
          specialty: m.case_ref?.case_metadata?.specialty || 'General',
          rating: m.metrics?.overall_score >= 90 ? 'Excellent' : 
                  m.metrics?.overall_score >= 70 ? 'Good' : 'Needs Improvement',
          score: m.metrics?.overall_score || 0,
          completedAt: m.createdAt
        }))
      };

      return res.json(summary);
    }

    // Original ClinicianPerformance logic
    const totalEvaluations = performance.evaluationHistory.length;
    const excellentCount = performance.evaluationHistory.filter(e => e.overallRating === 'Excellent').length;
    const goodCount = performance.evaluationHistory.filter(e => e.overallRating === 'Good').length;
    const needsImprovementCount = performance.evaluationHistory.filter(e => e.overallRating === 'Needs Improvement').length;

    const summary = {
      userId: performance.userId,
      name: performance.name,
      email: performance.email,
      
      overallStats: {
        totalEvaluations,
        excellentCount,
        goodCount,
        needsImprovementCount,
        excellentRate: totalEvaluations > 0 ? (excellentCount / totalEvaluations * 100).toFixed(1) : 0
      },
      
      specialtyStats: Object.fromEntries(performance.specialtyStats),
      
      contributorStatus: {
        isEligible: performance.contributorStatus.isEligible,
        eligibleSpecialties: performance.contributorStatus.eligibleSpecialties,
        qualificationDate: performance.contributorStatus.qualificationDate,
        eligibilityCriteria: Object.fromEntries(performance.contributorStatus.eligibilityCriteria)
      },
      
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
    };

    res.json(summary);

  } catch (error) {
    console.error('Error fetching performance summary:', error);
    res.status(500).json({ error: 'Failed to fetch performance summary' });
  }
});

// Check contributor eligibility for specific specialty
router.get('/eligibility/:userId/:specialty', async (req, res) => {
  try {
    const { userId, specialty } = req.params;
    
    const performance = await ClinicianPerformance.findOne({ userId });
    
    if (!performance) {
      return res.json({
        eligible: false,
        reason: 'No performance record found'
      });
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
        needsRecentExcellent: !criteria?.recentExcellent,
        needsConsistentPerformance: !criteria?.consistentPerformance
      }
    });

  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

// Get leaderboard of top performers
router.get('/leaderboard', async (req, res) => {
  try {
    const { specialty, limit = 10 } = req.query;
    
    // Get data from ClinicianProgress (which has the actual completion data)
    const progressRecords = await ClinicianProgress.find({})
      .populate('userId', 'username email')
      .limit(parseInt(limit))
      .sort({ overallAverageScore: -1 });

    const leaderboard = await Promise.all(progressRecords.map(async (progress) => {
      // Get recent performance metrics for this user to calculate excellence rate
      const recentMetrics = await PerformanceMetrics.find({ user_ref: progress.userId })
        .sort({ createdAt: -1 })
        .limit(20);

      const excellentCount = recentMetrics.filter(m => m.metrics?.overall_score >= 90).length;
      const totalCases = progress.totalCasesCompleted;
      
      return {
        userId: progress.userId,
        name: progress.userId?.username || 'Anonymous',
        totalCases: totalCases,
        excellentCount: excellentCount,
        excellentRate: totalCases > 0 ? (excellentCount / totalCases * 100).toFixed(1) : 0,
        averageScore: progress.overallAverageScore?.toFixed(1) || 0,
        isContributor: false // TODO: Check contributor status
      };
    }));

    // Sort by excellence rate, then by total cases
    leaderboard.sort((a, b) => {
      if (b.excellentRate !== a.excellentRate) {
        return b.excellentRate - a.excellentRate;
      }
      return b.totalCases - a.totalCases;
    });

    res.json(leaderboard.slice(0, parseInt(limit)));

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Update contribution stats when case is approved/rejected
router.post('/update-contribution/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    
    const performance = await ClinicianPerformance.findOne({ userId });
    
    if (!performance) {
      return res.status(404).json({ error: 'Performance record not found' });
    }

    performance.updateContributionStats(status);
    await performance.save();

    res.json({
      message: 'Contribution stats updated',
      contributionStats: performance.contributionStats
    });

  } catch (error) {
    console.error('Error updating contribution stats:', error);
    res.status(500).json({ error: 'Failed to update contribution stats' });
  }
});

// Bulk eligibility check (for admin)
router.get('/eligible-contributors/:specialty', async (req, res) => {
  try {
    const { specialty } = req.params;
    
    const eligibleContributors = await ClinicianPerformance.getEligibleContributors(specialty);
    
    const contributors = eligibleContributors.map(p => ({
      userId: p.userId,
      name: p.name,
      email: p.email,
      qualificationDate: p.contributorStatus.qualificationDate,
      specialtyStats: p.specialtyStats.get(specialty) || {},
      contributionStats: p.contributionStats
    }));

    res.json(contributors);

  } catch (error) {
    console.error('Error fetching eligible contributors:', error);
    res.status(500).json({ error: 'Failed to fetch eligible contributors' });
  }
});

export default router;