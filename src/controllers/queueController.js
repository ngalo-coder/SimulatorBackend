import mongoose from 'mongoose';
import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import UserCaseProgress from '../models/UserCaseProgressModel.js';
import UserQueueSession from '../models/UserQueueSessionModel.js';
import { generateFilterContextHash } from '../services/queueService.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

/**
 * @route   POST /api/users/queue/session/start
 * @desc    Initialize or Resume Queue Session for a user based on filters.
 * @access  Private (Authenticated users only)
 */
export async function startQueueSession(req, res) {
  const userId = req.user.id;
  const { filters } = req.body;
  const log = req.log.child({ userId, filters });

  if (!filters || typeof filters !== 'object') {
    log.warn('Start queue session failed: Filters object is required.');
    return res.status(400).json({ message: 'Filters object is required.' });
  }

  try {
    log.info('Starting queue session process.');
    const filterContextHash = generateFilterContextHash(filters);
    log.info({ filterContextHash }, 'Generated filter context hash.');

    const caseQuery = {};
    if (filters.program_area) caseQuery['case_metadata.program_area'] = filters.program_area;
    if (filters.specialty) caseQuery['case_metadata.specialty'] = filters.specialty;
    if (filters.specialized_area) {
      if (["null", "None", ""].includes(filters.specialized_area)) {
        caseQuery['case_metadata.specialized_area'] = { $in: [null, "", "None"] };
      } else {
        caseQuery['case_metadata.specialized_area'] = filters.specialized_area;
      }
    }
    if (filters.difficulty) caseQuery['case_metadata.difficulty'] = filters.difficulty;

    const matchingCases = await Case.find(caseQuery).select('_id case_metadata.case_id').lean();
    if (!matchingCases.length) {
      log.info('No cases found matching the selected filters.');
      return res.status(200).json({ message: 'No cases match the selected filters.' });
    }
    const matchingOriginalCaseIds = matchingCases.map(c => c.case_metadata.case_id);
    log.info({ count: matchingCases.length }, 'Found matching cases.');

    const progressRecords = await UserCaseProgress.find({
      userId,
      filterContextHash,
      status: { $in: ['completed', 'skipped'] }
    }).select('originalCaseIdString').lean();
    const completedOrSkippedIds = progressRecords.map(p => p.originalCaseIdString);
    log.info({ count: completedOrSkippedIds.length }, 'Found completed/skipped cases for user.');

    let availableCaseIds = matchingOriginalCaseIds.filter(id => !completedOrSkippedIds.includes(id));
    log.info({ count: availableCaseIds.length }, 'Calculated available cases.');

    let currentInProgressRecord = await UserCaseProgress.findOne({
      userId,
      filterContextHash,
      status: 'in_progress_queue'
    });

    let currentCaseObject = null;
    let currentCaseOriginalId = null;
    let queuePosition = -1;

    if (currentInProgressRecord) {
      log.info({ caseId: currentInProgressRecord.originalCaseIdString }, 'Found an in-progress case for this context.');
      if (availableCaseIds.includes(currentInProgressRecord.originalCaseIdString)) {
        currentCaseOriginalId = currentInProgressRecord.originalCaseIdString;
        availableCaseIds = availableCaseIds.filter(id => id !== currentCaseOriginalId);
        availableCaseIds.unshift(currentCaseOriginalId);
        log.info({ caseId: currentCaseOriginalId }, 'Resuming with in-progress case.');
      } else {
        log.warn({ caseId: currentInProgressRecord.originalCaseIdString }, 'In-progress case is no longer valid with current filters. Deleting record.');
        await UserCaseProgress.deleteOne({ _id: currentInProgressRecord._id });
        currentInProgressRecord = null;
      }
    }

    if (!currentCaseOriginalId && availableCaseIds.length > 0) {
      currentCaseOriginalId = availableCaseIds[0];
      log.info({ caseId: currentCaseOriginalId }, 'No in-progress case found, picking first available case.');
    }

    if (currentCaseOriginalId) {
        const caseDetails = matchingCases.find(c => c.case_metadata.case_id === currentCaseOriginalId);
        if (caseDetails) {
            currentCaseObject = await Case.findById(caseDetails._id).lean();
        }
        queuePosition = availableCaseIds.indexOf(currentCaseOriginalId);
    }

    const newSessionId = uuidv4();
    await UserQueueSession.deleteOne({ userId, filterContextHash });
    log.info('Deleted old queue session for this context.');

    const newSession = new UserQueueSession({
      sessionId: newSessionId,
      userId,
      filterContextHash,
      filtersApplied: filters,
      queuedCaseIds: availableCaseIds,
      currentCaseIndex: queuePosition,
    });
    await newSession.save();
    log.info({ sessionId: newSessionId }, 'Created new queue session.');

    if (currentCaseOriginalId) {
      const caseDetailsForProgress = matchingCases.find(c => c.case_metadata.case_id === currentCaseOriginalId);
      if (caseDetailsForProgress) {
        if (currentInProgressRecord && currentInProgressRecord.originalCaseIdString !== currentCaseOriginalId) {
            currentInProgressRecord.status = 'viewed_in_queue';
            await currentInProgressRecord.save();
            log.info({ caseId: currentInProgressRecord.originalCaseIdString }, 'Marked previous in-progress case as viewed.');
        }

        await UserCaseProgress.findOneAndUpdate(
          { userId, originalCaseIdString: currentCaseOriginalId, filterContextHash },
          {
            userId,
            caseId: caseDetailsForProgress._id,
            originalCaseIdString: currentCaseOriginalId,
            filterContextHash,
            status: 'in_progress_queue',
            sessionId: newSessionId
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        log.info({ caseId: currentCaseOriginalId, sessionId: newSessionId }, 'Marked current case as in_progress_queue.');
      }
    }

    res.status(200).json({
      sessionId: newSessionId,
      currentCase: currentCaseObject,
      queuePosition: currentCaseObject ? queuePosition : -1,
      totalInQueue: availableCaseIds.length,
    });

  } catch (error) {
    log.error(error, 'Error starting queue session.');
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
  const { previousCaseId, previousCaseStatus } = req.body;
  const log = req.log.child({ userId, sessionId, previousCaseId, previousCaseStatus });

  if (!sessionId) {
    log.warn('Get next case failed: Session ID is required.');
    return res.status(400).json({ message: 'Session ID is required.' });
  }

  try {
    log.info('Fetching next case in queue.');
    const session = await UserQueueSession.findOne({ sessionId, userId });
    if (!session) {
      log.warn('Queue session not found or not owned by user.');
      return res.status(404).json({ message: 'Queue session not found or not owned by user.' });
    }

    if (previousCaseId && previousCaseStatus) {
      if (!['completed', 'skipped', 'viewed_in_queue'].includes(previousCaseStatus)) {
        log.warn('Invalid status for previous case.');
        return res.status(400).json({ message: 'Invalid status for previous case.' });
      }
      const caseDetails = await Case.findOne({ 'case_metadata.case_id': previousCaseId }).select('_id').lean();
      if (caseDetails) {
        await UserCaseProgress.findOneAndUpdate(
          { userId, originalCaseIdString: previousCaseId, filterContextHash: session.filterContextHash },
          { status: previousCaseStatus, sessionId: session.sessionId },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        log.info('Updated status of previous case.');
      } else {
        log.warn(`Case details not found for previousCaseId: ${previousCaseId}. Progress not updated.`);
      }
    }

    let nextCaseIndex = session.currentCaseIndex + 1;
    let nextCaseOriginalId = null;
    let nextCaseObject = null;

    while (nextCaseIndex < session.queuedCaseIds.length) {
      const potentialNextId = session.queuedCaseIds[nextCaseIndex];
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
      log.info({ caseId: potentialNextId }, 'Skipping already completed/skipped case in queue.');
      nextCaseIndex++;
    }

    if (nextCaseOriginalId) {
      const caseDetails = await Case.findOne({ 'case_metadata.case_id': nextCaseOriginalId }).lean();
      if (caseDetails) {
        nextCaseObject = caseDetails;
        session.currentCaseIndex = nextCaseIndex;
        await session.save();
        log.info({ caseId: nextCaseOriginalId, index: nextCaseIndex }, 'Found next case.');

        await UserCaseProgress.updateMany(
          { userId, filterContextHash: session.filterContextHash, status: 'in_progress_queue', originalCaseIdString: { $ne: nextCaseOriginalId } },
          { $set: { status: 'viewed_in_queue', sessionId: null } }
        );

        await UserCaseProgress.findOneAndUpdate(
          { userId, originalCaseIdString: nextCaseOriginalId, filterContextHash: session.filterContextHash },
          { status: 'in_progress_queue', sessionId: session.sessionId, caseId: nextCaseObject._id },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        log.info({ caseId: nextCaseOriginalId }, 'Marked new case as in_progress_queue.');
      } else {
        log.error(`Case details not found for nextCaseOriginalId: ${nextCaseOriginalId}`);
        return res.status(500).json({ message: 'Error fetching next case details.' });
      }
    } else {
      log.info('End of queue reached.');
      session.currentCaseIndex = session.queuedCaseIds.length;
      await session.save();
    }

    res.status(200).json({
      sessionId: session.sessionId,
      currentCase: nextCaseObject,
      queuePosition: nextCaseObject ? nextCaseIndex : -1,
      totalInQueue: session.queuedCaseIds.length,
    });

  } catch (error) {
    log.error(error, 'Error getting next case in queue.');
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
  const { status, filterContext, sessionId } = req.body;
  const log = req.log.child({ userId, originalCaseIdString, status, sessionId });

  if (!originalCaseIdString) {
    log.warn('Mark case status failed: Case ID is required.');
    return res.status(400).json({ message: 'Case ID (originalCaseIdString) is required in URL parameters.' });
  }
  if (!status || !['completed', 'skipped'].includes(status)) {
    log.warn('Mark case status failed: Invalid status.');
    return res.status(400).json({ message: 'Invalid status. Must be "completed" or "skipped".' });
  }
  if (!filterContext || typeof filterContext !== 'object') {
    log.warn('Mark case status failed: filterContext object is required.');
    return res.status(400).json({ message: 'filterContext object is required.' });
  }

  try {
    log.info('Marking case status.');
    const filterContextHash = generateFilterContextHash(filterContext);

    const caseDetails = await Case.findOne({ 'case_metadata.case_id': originalCaseIdString }).select('_id').lean();
    if (!caseDetails) {
      log.warn('Case not found.');
      return res.status(404).json({ message: 'Case not found.' });
    }
    const caseObjectId = caseDetails._id;

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
      updateData.$unset = { sessionId: "" };
    }

    const updatedProgress = await UserCaseProgress.findOneAndUpdate(
      { userId, originalCaseIdString, filterContextHash },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    log.info('Successfully marked case status.');

    res.status(200).json({
      message: `Case status updated to ${status} successfully.`,
      progress: updatedProgress,
    });

  } catch (error) {
    log.error(error, 'Error marking case status.');
    if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({ message: 'Validation error.', errors: error.errors });
    }
    res.status(500).json({ message: 'Server error marking case status.' });
  }
}
