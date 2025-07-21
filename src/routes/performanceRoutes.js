import express from 'express';
import ClinicianPerformance from '../models/ClinicianPerformanceModel.js';

const router = express.Router();

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
    
    const performance = await ClinicianPerformance.findOne({ userId });
    
    if (!performance) {
      return res.status(404).json({ error: 'Performance record not found' });
    }

    // Calculate overall statistics
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
    
    let query = {};
    if (specialty) {
      query[`specialtyStats.${specialty}`] = { $exists: true };
    }

    const performers = await ClinicianPerformance.find(query)
      .select('userId name specialtyStats contributorStatus')
      .limit(parseInt(limit));

    const leaderboard = performers.map(p => {
      let stats;
      if (specialty && p.specialtyStats.has(specialty)) {
        stats = p.specialtyStats.get(specialty);
      } else {
        // Calculate overall stats
        const allStats = Array.from(p.specialtyStats.values());
        stats = {
          totalCases: allStats.reduce((sum, s) => sum + s.totalCases, 0),
          excellentCount: allStats.reduce((sum, s) => sum + s.excellentCount, 0),
          averageScore: allStats.length > 0 ? 
            allStats.reduce((sum, s) => sum + s.averageScore, 0) / allStats.length : 0
        };
      }

      return {
        userId: p.userId,
        name: p.name,
        totalCases: stats.totalCases,
        excellentCount: stats.excellentCount,
        excellentRate: stats.totalCases > 0 ? (stats.excellentCount / stats.totalCases * 100).toFixed(1) : 0,
        averageScore: stats.averageScore?.toFixed(1) || 0,
        isContributor: p.contributorStatus.isEligible
      };
    }).sort((a, b) => b.excellentRate - a.excellentRate);

    res.json(leaderboard);

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