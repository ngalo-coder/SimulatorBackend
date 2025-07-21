import express from 'express';
import ContributedCase from '../models/ContributedCaseModel.js';
import Case from '../models/CaseModel.js';
import emailService from '../services/emailService.js';

const router = express.Router();

// Get all submitted cases for review
router.get('/contributed-cases', async (req, res) => {
  try {
    const { status = 'submitted' } = req.query;
    
    const cases = await ContributedCase.find({ status })
      .sort({ submittedAt: -1 })
      .select('_id contributorName contributorEmail status caseData.case_metadata submittedAt reviewComments');
    
    res.json(cases);
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
    
    res.json(contributedCase);
  } catch (error) {
    console.error('Error fetching case details:', error);
    res.status(500).json({ error: 'Failed to fetch case details' });
  }
});

// Approve case and add to main database
router.post('/contributed-cases/:caseId/approve', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { reviewerId, reviewComments } = req.body;
    
    const contributedCase = await ContributedCase.findById(caseId);
    
    if (!contributedCase) {
      return res.status(404).json({ error: 'Case not found' });
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
    
    // Send approval notification email
    await emailService.notifyCaseApproved(
      contributedCase.contributorEmail,
      contributedCase.contributorName,
      contributedCase.caseData.case_metadata.title,
      reviewComments
    );
    
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
    const { reviewerId, reviewComments } = req.body;
    
    const contributedCase = await ContributedCase.findById(caseId);
    
    if (!contributedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    contributedCase.status = 'rejected';
    contributedCase.reviewedBy = reviewerId;
    contributedCase.reviewedAt = new Date();
    contributedCase.reviewComments = reviewComments;
    
    await contributedCase.save();
    
    // Send rejection notification email
    await emailService.notifyCaseRejected(
      contributedCase.contributorEmail,
      contributedCase.contributorName,
      contributedCase.caseData.case_metadata.title,
      reviewComments
    );
    
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
    const { reviewerId, reviewComments, revisionRequests } = req.body;
    
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
    
    // Send revision request notification email
    await emailService.notifyRevisionRequested(
      contributedCase.contributorEmail,
      contributedCase.contributorName,
      contributedCase.caseData.case_metadata.title,
      reviewComments,
      revisionRequests
    );
    
    res.json({ message: 'Revision requested' });
  } catch (error) {
    console.error('Error requesting revision:', error);
    res.status(500).json({ error: 'Failed to request revision' });
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
          totalSubmissions: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      },
      { $sort: { totalSubmissions: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      statusStats: stats,
      topContributors: contributorStats
    });
  } catch (error) {
    console.error('Error fetching contribution stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;