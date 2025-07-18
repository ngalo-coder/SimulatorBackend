import * as simulationService from '../services/simulationService.js';
import { handleSuccess, handleError } from '../utils/responseHandler.js';
import logger from '../config/logger.js';

export async function getCases(req, res) {
    const log = req.log.child({ query: req.query });
    try {
        const result = await simulationService.getCases(req.query);
        log.info({ count: result.cases.length, total: result.totalCases }, 'Fetched cases from DB.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error fetching cases with filters.');
        handleError(res, { message: 'Failed to fetch cases' }, log);
    }
}

export async function startSimulation(req, res) {
    const log = req.log.child({ caseId: req.body.caseId });
    try {
        const { caseId } = req.body;
        if (!caseId) {
            log.warn('Start simulation failed: caseId is required.');
            return res.status(400).json({ error: 'caseId is required' });
        }
        const result = await simulationService.startSimulation(caseId);
        log.info({ sessionId: result.sessionId }, 'MongoDB Session started.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error starting simulation.');
        handleError(res, { message: 'Failed to start simulation' }, log);
    }
}

export async function handleAsk(req, res) {
    const log = req.log.child({ sessionId: req.query.sessionId, question: req.query.question });
    try {
        const { sessionId, question } = req.query;
        if (!sessionId || !question) {
            log.warn('Handle ask failed: sessionId and question are required.');
            return res.status(400).json({ error: 'sessionId and question are required' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        await simulationService.handleAsk(sessionId, question, res);
        log.info('Session updated in DB after AI response.');

    } catch (error) {
        log.error(error, 'Error in handleAsk.');
        if (!res.headersSent) {
            handleError(res, { message: 'Failed to handle request' }, log);
        } else {
            log.error('Headers already sent, cannot send JSON error to client.');
            if (!res.writableEnded) res.end();
        }
    }
}

export async function endSession(req, res) {
    const log = req.log.child({ sessionId: req.body.sessionId });
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            log.warn('End session failed: sessionId is required.');
            return res.status(400).json({ error: 'sessionId is required' });
        }
        const result = await simulationService.endSession(sessionId, req.user, req.headers);
        log.info('Session ended, evaluation and performance metrics saved to DB.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error in endSession.');
        handleError(res, { message: 'Failed to end session or generate evaluation' }, log);
    }
}

export async function getCaseCategories(req, res) {
    const log = req.log;
    try {
        const result = await simulationService.getCaseCategories(req.query.program_area);
        log.info('Fetched case categories successfully.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error fetching case categories.');
        handleError(res, { message: 'Failed to fetch case categories' }, log);
    }
}

export async function getPerformanceMetricsBySession(req, res) {
    const log = req.log.child({ sessionId: req.params.sessionId });
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            log.warn('Get performance metrics failed: sessionId is required.');
            return res.status(400).json({ error: 'sessionId parameter is required' });
        }
        const result = await simulationService.getPerformanceMetricsBySession(sessionId);
        log.info('Fetched performance metrics successfully.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error fetching performance metrics.');
        handleError(res, { message: 'Failed to fetch performance metrics' }, log);
    }
}

export async function getPerformanceMetricsByUser(req, res) {
    const log = req.log.child({ userId: req.params.userId });
    try {
        const { userId } = req.params;
        if (!userId) {
            log.warn('Get user performance metrics failed: userId is required.');
            return res.status(400).json({ error: 'userId parameter is required' });
        }
        const result = await simulationService.getPerformanceMetricsByUser(userId);
        log.info({ count: result.length }, 'Fetched performance metrics for user.');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error fetching performance metrics for user.');
        handleError(res, { message: 'Failed to fetch performance metrics for user' }, log);
    }
}
