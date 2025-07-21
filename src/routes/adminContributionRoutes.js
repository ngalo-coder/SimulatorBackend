import express from 'express';
import ContributedCase from '../models/ContributedCaseModel.js';
import Case from '../models/CaseModel.js';
import ClinicianPerformance from '../models/ClinicianPerformanceModel.js';

const router = express.Router();

// Get all contributed cases for admin review
router.get('/contributed-cases', async (req, res) => {
  try {
    const { status = 'submitted', page = 1, limit = 20, specialty } = req.query;
    
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }
    if (specialty) {
      query['caseData.case_metadata.specialty'] = specialty;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const cases = await ContributedCase.find(query)
      .sort({ submittedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('_id contributorName contributorEmail status caseData.case_metadata submittedAt reviewComments reviewedBy reviewedAt');
    
    const total = await ContributedCase.countDocuments(query);
    
    res.json({
      cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching contributed cases:', error);
    res.status(500).json({ error: 'Failed to fetch contributed cases' });
  }
});

// Get full case details for review
router.get('/contributed-cases/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const contributedCase = await ContributedCase.findById(caseId);
    
    if (!contributedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Get contributor performance info
    const performance = await ClinicianPerformance.findOne({ 
      userId: contributedCase.contributorId 
    });
    
    res.json({
      ...contributedCase.toObject(),
      contributorPerformance: performance ? {
        totalCases: performance.performanceStats.totalCases,
        excellentCount: performance.performanceStats.excellentCount,
        averageRating: performance.performanceStats.averageRating,
        contributionHistory: performance.contributionHistory,
        eligibleSpecialties: performance.contributorStatus.eligibleSpecialties
      } : null
    });
  } catch (error) {
    console.error('Error fetching case details:', error);
    res.status(500).json({ error: 'Failed to fetch case details' });
  }
});

// Approve case and add to main database
router.post('/contributed-cases/:caseId/approve', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { reviewerId, reviewerName, reviewComments } = req.body;
    
    const contributedCase = await ContributedCase.findById(caseId);
    
    if (!contributedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    if (contributedCase.status !== 'submitted' && contributedCase.status !== 'under_review') {
      return res.status(400).json({ error: 'Case is not in a reviewable state' });
    }
    
    // Create new case in main database
    const newCase = new Case(contributedCase.caseData);
    await newCase.save();
    
    // Update contributed case status
    contributedCase.status = 'approved';
    contributedCase.reviewedBy = reviewerId;
    contributedCase.reviewedAt = new Date();
    contributedCase.reviewComments = reviewComments;
    
    await contributedCase.save();
    
    // Update contributor performance stats
    const performance = await ClinicianPerformance.findOne({ 
      userId: contributedCase.contributorId 
    });
    
    if (performance) {
      performance.updateContributionStats('approved');
      await performance.save();
    }
    
    // TODO: Send notification email to contributor
    
    res.json({
      message: 'Case approved and added to database',
      newCaseId: newCase._id,
      caseId: newCase.case_metadata.case_id
    });
  } catch (error) {
    console.error('Error approving case:', error);
    res.status(500).json({ error: 'Failed to approve case' });
  }
});

// Reject case
router.post('/contributed-cases/:caseId/reject', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { reviewerId, reviewerName, reviewComments } = req.body;
    
    const contributedCase = await ContributedCase.findById(caseId);
    
    if (!contributedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    contributedCase.status = 'rejected';
    contributedCase.reviewedBy = reviewerId;
    contributedCase.reviewedAt = new Date();
    contributedCase.reviewComments = reviewComments;
    
    await contributedCase.save();
    
    // Update contributor performance stats
    const performance = await ClinicianPerformance.findOne({ 
      userId: contributedCase.contributorId 
    });
    
    if (performance) {
      performance.updateContributionStats('rejected');
      await performance.save();
    }
    
    // TODO: Send notification email to contributor
    
    res.json({ message: 'Case rejected' });
  } catch (error) {
    console.error('Error rejecting case:', error);
    res.status(500).json({ error: 'Failed to reject case' });
  }
});

// Request revisions
router.post('/contributed-cases/:caseId/request-revision', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { reviewerId, reviewerName, reviewComments, revisionRequests } = req.body;
    
    const contributedCase = await ContributedCase.findById(caseId);
    
    if (!contributedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    contributedCase.status = 'needs_revision';
    contributedCase.reviewedBy = reviewerId;
    contributedCase.reviewedAt = new Date();
    contributedCase.reviewComments = reviewComments;
    contributedCase.revisionRequests = revisionRequests.map(req => ({
      ...req,
      requestedAt: new Date()
    }));
    
    await contributedCase.save();
    
    // TODO: Send notification email to contributor
    
    res.json({ message: 'Revision requested' });
  } catch (error) {
    console.error('Error requesting revision:', error);
    res.status(500).json({ error: 'Failed to request revision' });
  }
});

// Bulk actions
router.post('/contributed-cases/bulk-action', async (req, res) => {
  try {
    const { action, caseIds, reviewerId, reviewerName, reviewComments } = req.body;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const results = [];
    
    for (const caseId of caseIds) {
      try {
        const contributedCase = await ContributedCase.findById(caseId);
        
        if (!contributedCase) {
          results.push({ caseId, status: 'error', message: 'Case not found' });
          continue;
        }
        
        if (action === 'approve') {
          // Create new case in main database
          const newCase = new Case(contributedCase.caseData);
          await newCase.save();
          
          contributedCase.status = 'approved';
          
          // Update contributor stats
          const performance = await ClinicianPerformance.findOne({ 
            userId: contributedCase.contributorId 
          });
          if (performance) {
            performance.updateContributionStats('approved');
            await performance.save();
          }
          
          results.push({ 
            caseId, 
            status: 'success', 
            message: 'Approved',
            newCaseId: newCase.case_metadata.case_id
          });
        } else {
          contributedCase.status = 'rejected';
          
          // Update contributor stats
          const performance = await ClinicianPerformance.findOne({ 
            userId: contributedCase.contributorId 
          });
          if (performance) {
            performance.updateContributionStats('rejected');
            await performance.save();
          }
          
          results.push({ caseId, status: 'success', message: 'Rejected' });
        }
        
        contributedCase.reviewedBy = reviewerId;
        contributedCase.reviewedAt = new Date();
        contributedCase.reviewComments = reviewComments;
        
        await contributedCase.save();
        
      } catch (error) {
        results.push({ 
          caseId, 
          status: 'error', 
          message: error.message 
        });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ error: 'Failed to perform bulk action' });
  }
});

// Get contribution statistics
router.get('/contribution-stats', async (req, res) => {
  try {
    const stats = await ContributedCase.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const contributorStats = await ContributedCase.aggregate([
      {
        $group: {
          _id: '$contributorId',
          contributorName: { $first: '$contributorName' },
          contributorEmail: { $first: '$contributorEmail' },
          totalSubmissions: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          approvalRate: {
            $cond: [
              { $gt: [{ $add: ['$approved', '$rejected'] }, 0] },
              { $divide: ['$approved', { $add: ['$approved', '$rejected'] }] },
              0
            ]
          }
        }
      },
      { $sort: { totalSubmissions: -1 } },
      { $limit: 10 }
    ]);
    
    const specialtyStats = await ContributedCase.aggregate([
      {
        $group: {
          _id: '$caseData.case_metadata.specialty',
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    res.json({
      statusStats: stats,
      topContributors: contributorStats,
      specialtyStats
    });
  } catch (error) {
    console.error('Error fetching contribution stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get review queue summary
router.get('/review-queue', async (req, res) => {
  try {
    const queueStats = await ContributedCase.aggregate([
      {
        $match: {
          status: { $in: ['submitted', 'under_review'] }
        }
      },
      {
        $group: {
          _id: '$caseData.case_metadata.specialty',
          count: { $sum: 1 },
          oldestSubmission: { $min: '$submittedAt' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const urgentCases = await ContributedCase.find({
      status: 'submitted',
      submittedAt: { $lt: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)) } // Older than 7 days
    })
    .select('_id contributorName caseData.case_metadata.title caseData.case_metadata.specialty submittedAt')
    .sort({ submittedAt: 1 })
    .limit(10);
    
    res.json({
      queueStats,
      urgentCases,
      totalPending: queueStats.reduce((sum, stat) => sum + stat.count, 0)
    });
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

export default router;