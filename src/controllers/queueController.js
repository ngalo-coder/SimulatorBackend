import * as queueService from '../services/queueService.js';
import { handleSuccess, handleError } from '../utils/responseHandler.js';
import logger from '../config/logger.js';

export async function startQueueSession(req, res) {
    const log = req.log.child({ userId: req.user.id, filters: req.body.filters });
    try {
        const { filters } = req.body;
        if (!filters || typeof filters !== 'object') {
            log.warn('Start queue session failed: Filters object is required.');
            return res.status(400).json({ message: 'Filters object is required.' });
        }
        const result = await queueService.startQueueSession(req.user.id, filters);
        log.info('Queue session started successfully.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error starting queue session.');
        handleError(res, error, log);
    }
}

export async function getNextCaseInQueue(req, res) {
    const log = req.log.child({ userId: req.user.id, sessionId: req.params.sessionId });
    try {
        const { sessionId } = req.params;
        const { previousCaseId, previousCaseStatus } = req.body;
        if (!sessionId) {
            log.warn('Get next case failed: Session ID is required.');
            return res.status(400).json({ message: 'Session ID is required.' });
        }
        const result = await queueService.getNextCaseInQueue(req.user.id, sessionId, previousCaseId, previousCaseStatus);
        log.info('Fetched next case in queue successfully.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error getting next case in queue.');
        handleError(res, error, log);
    }
}

export async function markCaseStatus(req, res) {
    const log = req.log.child({ userId: req.user.id, originalCaseIdString: req.params.originalCaseIdString });
    try {
        const { originalCaseIdString } = req.params;
        const { status, filterContext, sessionId } = req.body;

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

        const result = await queueService.markCaseStatus(req.user.id, originalCaseIdString, status, filterContext, sessionId);
        log.info('Successfully marked case status.');
        handleSuccess(res, {
            message: `Case status updated to ${status} successfully.`,
            progress: result,
        });
    } catch (error) {
        log.error(error, 'Error marking case status.');
        handleError(res, error, log);
    }
}

export async function getQueueSession(req, res) {
    const log = req.log.child({ userId: req.user.id, sessionId: req.params.sessionId });
    try {
        const { sessionId } = req.params;
        
        if (!sessionId) {
            log.warn('Get queue session failed: Session ID is required.');
            return res.status(400).json({ message: 'Session ID is required.' });
        }

        const result = await queueService.getQueueSession(req.user.id, sessionId);
        log.info('Fetched queue session successfully.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error getting queue session.');
        handleError(res, error, log);
    }
}

export async function getCaseHistory(req, res) {
    const log = req.log.child({ userId: req.user.id, targetUserId: req.params.userId });
    try {
        // If userId is provided in params, use it (for admin), otherwise use current user
        const targetUserId = req.params.userId || req.user.id;
        
        // If requesting another user's history, check if current user is admin
        if (req.params.userId && req.params.userId !== req.user.id) {
            if (!req.user.isAdmin) {
                log.warn('Get case history failed: Insufficient permissions.');
                return res.status(403).json({ message: 'Insufficient permissions to view other users\' case history.' });
            }
        }

        const result = await queueService.getCaseHistory(targetUserId);
        log.info('Fetched case history successfully.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error getting case history.');
        handleError(res, error, log);
    }
}
