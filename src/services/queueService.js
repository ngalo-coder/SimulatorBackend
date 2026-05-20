import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import UserCaseProgress from '../models/UserCaseProgressModel.js';
import UserQueueSession from '../models/UserQueueSessionModel.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a stable hash for a given filter object.
 */
export function generateFilterContextHash(filters) {
  if (!filters || typeof filters !== 'object' || Object.keys(filters).length === 0) {
    return crypto.createHash('md5').update('').digest('hex');
  }

  const sortedKeys = Object.keys(filters).sort();

  const filterString = sortedKeys
    .map(key => {
      const value = filters[key] == null ? '' : String(filters[key]);
      return `${key}:${value}`;
    })
    .join('|');

  return crypto.createHash('md5').update(filterString).digest('hex');
}

export async function startQueueSession(userId, filters) {
    const filterContextHash = generateFilterContextHash(filters);

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
    // Note: difficulty filtering removed from user interface but kept in database for background grading

    const matchingCases = await Case.find(caseQuery).select('_id case_metadata.case_id').lean();
    if (!matchingCases.length) {
        return { message: 'No cases match the selected filters.' };
    }
    const matchingOriginalCaseIds = matchingCases.map(c => c.case_metadata.case_id);

    const progressRecords = await UserCaseProgress.find({
        userId,
        filterContextHash,
        status: { $in: ['completed', 'skipped'] }
    }).select('originalCaseIdString').lean();
    const completedOrSkippedIds = progressRecords.map(p => p.originalCaseIdString);

    let availableCaseIds = matchingOriginalCaseIds.filter(id => !completedOrSkippedIds.includes(id));

    let currentInProgressRecord = await UserCaseProgress.findOne({
        userId,
        filterContextHash,
        status: 'in_progress_queue'
    });

    let currentCaseObject = null;
    let currentCaseOriginalId = null;
    let queuePosition = -1;

    if (currentInProgressRecord) {
        if (availableCaseIds.includes(currentInProgressRecord.originalCaseIdString)) {
            currentCaseOriginalId = currentInProgressRecord.originalCaseIdString;
            availableCaseIds = availableCaseIds.filter(id => id !== currentCaseOriginalId);
            availableCaseIds.unshift(currentCaseOriginalId);
        } else {
            await UserCaseProgress.deleteOne({ _id: currentInProgressRecord._id });
            currentInProgressRecord = null;
        }
    }

    if (!currentCaseOriginalId && availableCaseIds.length > 0) {
        currentCaseOriginalId = availableCaseIds[0];
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

    const newSession = new UserQueueSession({
        sessionId: newSessionId,
        userId,
        filterContextHash,
        filtersApplied: filters,
        queuedCaseIds: availableCaseIds,
        currentCaseIndex: queuePosition,
    });
    await newSession.save();

    if (currentCaseOriginalId) {
        const caseDetailsForProgress = matchingCases.find(c => c.case_metadata.case_id === currentCaseOriginalId);
        if (caseDetailsForProgress) {
            if (currentInProgressRecord && currentInProgressRecord.originalCaseIdString !== currentCaseOriginalId) {
                currentInProgressRecord.status = 'viewed_in_queue';
                await currentInProgressRecord.save();
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
        }
    }

    return {
        sessionId: newSessionId,
        currentCase: currentCaseObject,
        queuePosition: currentCaseObject ? queuePosition : -1,
        totalInQueue: availableCaseIds.length,
    };
}

export async function getNextCaseInQueue(userId, sessionId, previousCaseId, previousCaseStatus) {
    const session = await UserQueueSession.findOne({ sessionId, userId });
    if (!session) {
        throw { status: 404, message: 'Queue session not found or not owned by user.' };
    }

    if (previousCaseId && previousCaseStatus) {
        if (!['completed', 'skipped', 'viewed_in_queue'].includes(previousCaseStatus)) {
            throw { status: 400, message: 'Invalid status for previous case.' };
        }
        const caseDetails = await Case.findOne({ 'case_metadata.case_id': previousCaseId }).select('_id').lean();
        if (caseDetails) {
            await UserCaseProgress.findOneAndUpdate(
                { userId, originalCaseIdString: previousCaseId, filterContextHash: session.filterContextHash },
                { status: previousCaseStatus, sessionId: session.sessionId },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
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
        nextCaseIndex++;
    }

    if (nextCaseOriginalId) {
        const caseDetails = await Case.findOne({ 'case_metadata.case_id': nextCaseOriginalId }).lean();
        if (caseDetails) {
            nextCaseObject = caseDetails;
            session.currentCaseIndex = nextCaseIndex;
            await session.save();

            await UserCaseProgress.updateMany(
                { userId, filterContextHash: session.filterContextHash, status: 'in_progress_queue', originalCaseIdString: { $ne: nextCaseOriginalId } },
                { $set: { status: 'viewed_in_queue', sessionId: null } }
            );

            await UserCaseProgress.findOneAndUpdate(
                { userId, originalCaseIdString: nextCaseOriginalId, filterContextHash: session.filterContextHash },
                { status: 'in_progress_queue', sessionId: session.sessionId, caseId: nextCaseObject._id },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } else {
            throw { status: 500, message: 'Error fetching next case details.' };
        }
    } else {
        session.currentCaseIndex = session.queuedCaseIds.length;
        await session.save();
    }

    return {
        sessionId: session.sessionId,
        currentCase: nextCaseObject,
        queuePosition: nextCaseObject ? nextCaseIndex : -1,
        totalInQueue: session.queuedCaseIds.length,
    };
}

export async function markCaseStatus(userId, originalCaseIdString, status, filterContext, sessionId) {
    const filterContextHash = generateFilterContextHash(filterContext);

    const caseDetails = await Case.findOne({ 'case_metadata.case_id': originalCaseIdString }).select('_id').lean();
    if (!caseDetails) {
        throw { status: 404, message: 'Case not found.' };
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

    return updatedProgress;
}

export async function getQueueSession(userId, sessionId) {
    const session = await UserQueueSession.findOne({ sessionId, userId }).lean();
    if (!session) {
        throw { status: 404, message: 'Queue session not found or not owned by user.' };
    }

    // Get current case details if available
    let currentCase = null;
    if (session.currentCaseIndex >= 0 && session.currentCaseIndex < session.queuedCaseIds.length) {
        const currentCaseId = session.queuedCaseIds[session.currentCaseIndex];
        const caseDetails = await Case.findOne({ 'case_metadata.case_id': currentCaseId }).lean();
        if (caseDetails) {
            currentCase = caseDetails;
        }
    }

    // Get completed cases count
    const completedCases = await UserCaseProgress.find({
        userId,
        filterContextHash: session.filterContextHash,
        status: { $in: ['completed', 'skipped'] }
    }).select('originalCaseIdString').lean();

    return {
        sessionId: session.sessionId,
        userId: session.userId,
        programArea: session.filtersApplied.program_area,
        specialty: session.filtersApplied.specialty,
        currentCaseIndex: session.currentCaseIndex,
        totalCases: session.queuedCaseIds.length,
        completedCases: completedCases.map(c => c.originalCaseIdString),
        createdAt: session.createdAt,
        lastAccessedAt: session.updatedAt,
        currentCase
    };
}

export async function getCaseHistory(userId) {
    // Get all performance metrics for the user
    const PerformanceMetrics = mongoose.model('PerformanceMetrics');
    
    const performanceRecords = await PerformanceMetrics.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

    // Get case details for each performance record
    const caseHistory = [];
    
    for (const record of performanceRecords) {
        try {
            const caseDetails = await Case.findOne({ 'case_metadata.case_id': record.caseId }).lean();
            if (caseDetails) {
                caseHistory.push({
                    caseId: record.caseId,
                    title: caseDetails.case_metadata.title,
                    specialty: caseDetails.case_metadata.specialty,
                    programArea: caseDetails.case_metadata.program_area,
                    status: 'completed',
                    completedAt: record.createdAt,
                    score: record.totalScore || 0,
                    rating: record.overallRating || 'Not Rated',
                    duration: record.duration || 0,
                    messagesExchanged: record.messagesExchanged || 0
                });
            }
        } catch (error) {
            console.error(`Error fetching case details for ${record.caseId}:`, error);
        }
    }

    return caseHistory;
}
