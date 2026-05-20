import Session from '../models/SessionModel.js';
import Case from '../models/CaseModel.js';
import logger from '../config/logger.js';

/**
 * Start a queue session for the user
 */
export async function startQueueSession(req, res) {
  try {
    const userId = req.user._id;
    const { caseId } = req.body;

    // Find existing active session or create new one
    let session = await Session.findOne({
      user_ref: userId,
      status: 'active'
    }).sort({ createdAt: -1 });

    if (!session) {
      session = await Session.create({
        user_ref: userId,
        case_ref: caseId,
        status: 'active',
        startedAt: new Date()
      });
    }

    res.json({
      success: true,
      sessionId: session._id,
      status: session.status
    });
  } catch (error) {
    logger.error('Error starting queue session:', error);
    res.status(500).json({ success: false, error: 'Failed to start queue session' });
  }
}

/**
 * Get the next case in the queue
 */
export async function getNextCaseInQueue(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId).populate('case_ref');

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Return the current case or find next available
    const caseData = session.case_ref;

    res.json({
      success: true,
      case: caseData
    });
  } catch (error) {
    logger.error('Error getting next case in queue:', error);
    res.status(500).json({ success: false, error: 'Failed to get next case' });
  }
}

/**
 * Mark case status (completed, skipped, paused)
 */
export async function markCaseStatus(req, res) {
  try {
    const { originalCaseIdString } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['completed', 'skipped', 'paused'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const session = await Session.findOneAndUpdate(
      { 'case_ref': originalCaseIdString },
      { status, notes, updatedAt: new Date() },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Error marking case status:', error);
    res.status(500).json({ success: false, error: 'Failed to update case status' });
  }
}

/**
 * Get queue session details
 */
export async function getQueueSession(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId)
      .populate('case_ref')
      .populate('user_ref', 'username email');

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({
      success: true,
      sessionId: session._id,
      userId: session.user_ref?._id,
      status: session.status,
      currentCaseIndex: 0,
      totalCases: 1,
      startedAt: session.createdAt,
      completedAt: session.updatedAt,
      cases: session.case_ref ? [session.case_ref] : []
    });
  } catch (error) {
    logger.error('Error getting queue session:', error);
    res.status(500).json({ success: false, error: 'Failed to get queue session' });
  }
}

/**
 * Get user's case history
 */
export async function getCaseHistory(req, res) {
  try {
    const userId = req.params.userId || req.user._id;

    // Check permissions
    if (userId !== req.user._id.toString() && req.user.primaryRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const sessions = await Session.find({ user_ref: userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('case_ref', 'case_metadata.title case_metadata.case_id')
      .lean();

    const totalCount = await Session.countDocuments({ user_ref: userId });

    const history = sessions.map(session => ({
      caseId: session.case_ref?.case_metadata?.case_id || session._id,
      caseTitle: session.case_ref?.case_metadata?.title || 'Unknown Case',
      status: session.status,
      completedAt: session.updatedAt,
      duration: session.updatedAt && session.createdAt
        ? (new Date(session.updatedAt) - new Date(session.createdAt)) / 1000
        : 0
    }));

    res.json({
      success: true,
      history,
      totalCount,
      hasMore: offset + limit < totalCount
    });
  } catch (error) {
    logger.error('Error getting case history:', error);
    res.status(500).json({ success: false, error: 'Failed to get case history' });
  }
}
