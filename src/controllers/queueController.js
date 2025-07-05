import mongoose from 'mongoose';
import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import UserCaseProgress from '../models/UserCaseProgressModel.js';
import UserQueueSession from '../models/UserQueueSessionModel.js';
import { generateFilterContextHash } from '../services/queueService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * @route   POST /api/users/queue/session/start
 * @desc    Initialize or Resume Queue Session for a user based on filters.
 * @access  Private (Authenticated users only)
 */
export async function startQueueSession(req, res) {
  const userId = req.user.id; // From authMiddleware
  const { filters } = req.body; // e.g., { program_area, specialized_area, difficulty }

  if (!filters || typeof filters !== 'object') {
    return res.status(400).json({ message: 'Filters object is required.' });
  }

  try {
    const filterContextHash = generateFilterContextHash(filters);

    // 1. Build the query for CaseModel based on filters
    const caseQuery = {};
    if (filters.program_area) {
      caseQuery['case_metadata.program_area'] = filters.program_area;
    }
    if (filters.specialized_area) {
      if (filters.specialized_area === "null" || filters.specialized_area === "None" || filters.specialized_area === "") {
        caseQuery['case_metadata.specialized_area'] = { $in: [null, "", "None"] };
      } else {
        caseQuery['case_metadata.specialized_area'] = filters.specialized_area;
      }
    }
    if (filters.difficulty) {
      caseQuery['case_metadata.difficulty'] = filters.difficulty;
    }
    // Add other filterable fields from CaseModel.case_metadata as needed

    // 2. Get all Case ObjectIds and originalCaseIdStrings matching filters
    const matchingCases = await Case.find(caseQuery).select('_id case_metadata.case_id').lean();
    if (!matchingCases.length) {
      return res.status(200).json({
        sessionId: null,
        currentCase: null,
        queuePosition: -1,
        totalInQueue: 0,
        message: 'No cases match the selected filters.'
      });
    }
    const matchingOriginalCaseIds = matchingCases.map(c => c.case_metadata.case_id);

    // 3. Get completed/skipped cases for this user and context
    const progressRecords = await UserCaseProgress.find({
      userId,
      filterContextHash,
      status: { $in: ['completed', 'skipped'] }
    }).select('originalCaseIdString').lean();
    const completedOrSkippedIds = progressRecords.map(p => p.originalCaseIdString);

    // 4. Filter out completed/skipped cases
    let availableCaseIds = matchingOriginalCaseIds.filter(id => !completedOrSkippedIds.includes(id));

    // 5. Check for an 'in_progress_queue' case for this user & context
    let currentInProgressRecord = await UserCaseProgress.findOne({
      userId,
      filterContextHash,
      status: 'in_progress_queue'
    });

    let currentCaseObject = null;
    let currentCaseOriginalId = null;
    let queuePosition = -1;

    if (currentInProgressRecord) {
      // If an 'in_progress_queue' case exists, make it the current one.
      // Ensure it's still in the available list (it might have been filtered out if filters changed, though less likely for resume)
      if (availableCaseIds.includes(currentInProgressRecord.originalCaseIdString)) {
        currentCaseOriginalId = currentInProgressRecord.originalCaseIdString;
        // Put this case at the beginning of the queue for this session
        availableCaseIds = availableCaseIds.filter(id => id !== currentCaseOriginalId);
        availableCaseIds.unshift(currentCaseOriginalId);
      } else {
        // The 'in_progress_queue' case is no longer valid for the current filters (or was completed/skipped under a different context that now applies)
        // Clear its 'in_progress_queue' status as it's not being resumed.
        await UserCaseProgress.deleteOne({ _id: currentInProgressRecord._id });
        currentInProgressRecord = null; // Nullify to proceed as if no in_progress case
      }
    }

    if (!currentCaseOriginalId && availableCaseIds.length > 0) {
      // If no 'in_progress_queue' or it was invalid, pick the first available
      currentCaseOriginalId = availableCaseIds[0];
    }

    if (currentCaseOriginalId) {
        const caseDetails = matchingCases.find(c => c.case_metadata.case_id === currentCaseOriginalId);
        if (caseDetails) {
            currentCaseObject = await Case.findById(caseDetails._id).lean(); // Fetch full case object
        }
        queuePosition = availableCaseIds.indexOf(currentCaseOriginalId);
    }


    // 6. Session Management
    const newSessionId = uuidv4();
    // Delete any old session for this user and filter context to ensure only one active session per context
    await UserQueueSession.deleteOne({ userId, filterContextHash });

    const newSession = new UserQueueSession({
      sessionId: newSessionId,
      userId,
      filterContextHash,
      filtersApplied: filters,
      queuedCaseIds: availableCaseIds, // Store original string IDs
      currentCaseIndex: queuePosition,
    });
    await newSession.save();

    // 7. Update UserCaseProgress for the current case
    if (currentCaseOriginalId) {
      const caseDetailsForProgress = matchingCases.find(c => c.case_metadata.case_id === currentCaseOriginalId);
      if (caseDetailsForProgress) {
        // If there was a different 'in_progress_queue' case, mark it as 'viewed_in_queue'
        if (currentInProgressRecord && currentInProgressRecord.originalCaseIdString !== currentCaseOriginalId) {
            currentInProgressRecord.status = 'viewed_in_queue';
            // currentInProgressRecord.sessionId = null; // Or the old session ID if relevant
            await currentInProgressRecord.save();
        }

        // Mark the new current case as 'in_progress_queue'
        await UserCaseProgress.findOneAndUpdate(
          { userId, originalCaseIdString: currentCaseOriginalId, filterContextHash },
          {
            userId,
            caseId: caseDetailsForProgress._id, // ObjectId of the case
            originalCaseIdString: currentCaseOriginalId,
            filterContextHash,
            status: 'in_progress_queue',
            sessionId: newSessionId
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    res.status(200).json({
      sessionId: newSessionId,
      currentCase: currentCaseObject,
      queuePosition: currentCaseObject ? queuePosition : -1,
      totalInQueue: availableCaseIds.length,
    });

  } catch (error) {
    console.error('Error starting queue session:', error);
    if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({ message: 'Validation error.', errors: error.errors });
    }
    res.status(500).json({ message: 'Server error starting queue session.' });
  }
}

/**
 * @route   POST /api/users/queue/session/:sessionId/next
 * @desc    Get Next Case in Queue Session.
 * @access  Private (Authenticated users only)
 */
export async function getNextCaseInQueue(req, res) {
  const userId = req.user.id;
  const { sessionId } = req.params;
  const { previousCaseId, previousCaseStatus } = req.body; // previousCaseId is originalCaseIdString

  if (!sessionId) {
    return res.status(400).json({ message: 'Session ID is required.' });
  }

  try {
    const session = await UserQueueSession.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ message: 'Queue session not found or not owned by user.' });
    }

    // 1. Update status of the previous case, if provided
    if (previousCaseId && previousCaseStatus) {
      if (!['completed', 'skipped', 'viewed_in_queue'].includes(previousCaseStatus)) {
        return res.status(400).json({ message: 'Invalid status for previous case.' });
      }
      const caseDetails = await Case.findOne({ 'case_metadata.case_id': previousCaseId }).select('_id').lean();
      if (caseDetails) {
        await UserCaseProgress.findOneAndUpdate(
          { userId, originalCaseIdString: previousCaseId, filterContextHash: session.filterContextHash },
          {
            userId,
            caseId: caseDetails._id,
            originalCaseIdString: previousCaseId,
            filterContextHash: session.filterContextHash,
            status: previousCaseStatus,
            sessionId: session.sessionId // Link to this session
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        console.warn(`Case details not found for previousCaseId: ${previousCaseId} during nextCase. Progress not updated.`);
      }
    }

    // 2. Determine the next case
    let nextCaseIndex = session.currentCaseIndex + 1;
    let nextCaseOriginalId = null;
    let nextCaseObject = null;

    while (nextCaseIndex < session.queuedCaseIds.length) {
      const potentialNextId = session.queuedCaseIds[nextCaseIndex];
      // Check if this case is already completed or skipped in this context (should ideally not happen if queue is pre-filtered)
      const progress = await UserCaseProgress.findOne({
        userId,
        originalCaseIdString: potentialNextId,
        filterContextHash: session.filterContextHash,
        status: { $in: ['completed', 'skipped'] }
      }).lean();

      if (!progress) {
        nextCaseOriginalId = potentialNextId;
        break;
      }
      nextCaseIndex++;
    }

    if (nextCaseOriginalId) {
      const caseDetails = await Case.findOne({ 'case_metadata.case_id': nextCaseOriginalId }).lean();
      if (caseDetails) {
        nextCaseObject = caseDetails; // Full case object

        // Update current case in session
        session.currentCaseIndex = nextCaseIndex;
        await session.save();

        // Mark new current case as 'in_progress_queue'
        // First, ensure any other case for this user/context isn't 'in_progress_queue' or set it to 'viewed_in_queue'
        await UserCaseProgress.updateMany(
          { userId, filterContextHash: session.filterContextHash, status: 'in_progress_queue', originalCaseIdString: { $ne: nextCaseOriginalId } },
          { $set: { status: 'viewed_in_queue', sessionId: null } } // Or keep session Id if preferred
        );

        await UserCaseProgress.findOneAndUpdate(
          { userId, originalCaseIdString: nextCaseOriginalId, filterContextHash: session.filterContextHash },
          {
            userId,
            caseId: nextCaseObject._id, // ObjectId
            originalCaseIdString: nextCaseOriginalId,
            filterContextHash: session.filterContextHash,
            status: 'in_progress_queue',
            sessionId: session.sessionId
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        // Should not happen if queuedCaseIds are valid
        console.error(`Case details not found for nextCaseOriginalId: ${nextCaseOriginalId}`);
        return res.status(500).json({ message: 'Error fetching next case details.' });
      }
    } else {
      // End of queue
      session.currentCaseIndex = session.queuedCaseIds.length; // Mark as past the end
      await session.save();
    }

    res.status(200).json({
      sessionId: session.sessionId,
      currentCase: nextCaseObject,
      queuePosition: nextCaseObject ? nextCaseIndex : -1,
      totalInQueue: session.queuedCaseIds.length,
    });

  } catch (error) {
    console.error('Error getting next case:', error);
     if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({ message: 'Validation error.', errors: error.errors });
    }
    res.status(500).json({ message: 'Server error getting next case.' });
  }
}

/**
 * @route   POST /api/users/cases/:originalCaseIdString/status
 * @desc    Mark Case Interaction Status (completed or skipped).
 * @access  Private (Authenticated users only)
 */
export async function markCaseStatus(req, res) {
  const userId = req.user.id;
  const { originalCaseIdString } = req.params;
  const { status, filterContext, sessionId } = req.body; // filterContext is an object, sessionId is optional

  if (!originalCaseIdString) {
    return res.status(400).json({ message: 'Case ID (originalCaseIdString) is required in URL parameters.' });
  }
  if (!status || !['completed', 'skipped'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be "completed" or "skipped".' });
  }
  if (!filterContext || typeof filterContext !== 'object') {
    // Making filterContext mandatory for this endpoint to ensure clarity of context.
    // Alternatively, a "global" or default context could be assumed if not provided.
    return res.status(400).json({ message: 'filterContext object is required.' });
  }

  try {
    const filterContextHash = generateFilterContextHash(filterContext);

    const caseDetails = await Case.findOne({ 'case_metadata.case_id': originalCaseIdString }).select('_id').lean();
    if (!caseDetails) {
      return res.status(404).json({ message: 'Case not found.' });
    }
    const caseObjectId = caseDetails._id;

    // Create or update the UserCaseProgress record
    // If status is 'completed' or 'skipped', it supersedes 'in_progress_queue' or 'viewed_in_queue'
    const updateData = {
      userId,
      caseId: caseObjectId,
      originalCaseIdString,
      filterContextHash,
      status,
      lastUpdatedAt: new Date(),
    };
    if (sessionId) {
      updateData.sessionId = sessionId;
    } else {
      // If no session ID provided with explicit status update,
      // consider removing session ID if one was previously associated with 'in_progress_queue'
      updateData.$unset = { sessionId: "" }; // Removes the field if it exists
    }


    const updatedProgress = await UserCaseProgress.findOneAndUpdate(
      { userId, originalCaseIdString, filterContextHash },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      message: `Case status updated to ${status} successfully.`,
      progress: updatedProgress,
    });

  } catch (error) {
    console.error('Error marking case status:', error);
    if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({ message: 'Validation error.', errors: error.errors });
    }
    res.status(500).json({ message: 'Server error marking case status.' });
  }
}
