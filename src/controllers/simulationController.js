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
        const { sessionId, question, token } = req.query;
        if (!sessionId || !question) {
            log.warn('Handle ask failed: sessionId and question are required.');
            return res.status(400).json({ error: 'sessionId and question are required' });
        }

        // Handle authentication for EventSource (which can't send Authorization headers)
        if (token) {
            try {
                const { verifyToken } = await import('../services/authService.js');
                const decoded = verifyToken(token);
                if (!decoded) {
                    log.warn('Invalid token provided in EventSource request');
                    return res.status(401).json({ error: 'Invalid token' });
                }
                // Attach user info for the request
                req.user = decoded;
            } catch (authError) {
                log.error(authError, 'Token verification failed');
                return res.status(401).json({ error: 'Authentication failed' });
            }
        } else if (!req.user) {
            log.warn('No authentication provided for EventSource request');
            return res.status(401).json({ error: 'Authentication required' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', req.get('Origin') || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        const result = await simulationService.endSession(req.body.sessionId, req.user);
        log.info('Session ended successfully');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error ending session');
        handleError(res, error, log);
    }
}

// Start a retake session for a previously attempted case
export async function startRetakeSession(req, res) {
    const log = req.log.child({ caseId: req.body.caseId, previousSessionId: req.body.previousSessionId });
    try {
        const { caseId, previousSessionId, retakeReason, improvementFocusAreas } = req.body;
        const user = req.user;
        
        if (!caseId) {
            log.warn('Start retake session failed: caseId is required.');
            return res.status(400).json({ error: 'caseId is required' });
        }

        const result = await simulationService.startRetakeSession(caseId, previousSessionId, retakeReason, improvementFocusAreas, user);
        log.info({ sessionId: result.sessionId, attemptNumber: result.attemptNumber }, 'Retake session started successfully');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error starting retake session');
        handleError(res, error, log);
    }
}

// Get retake sessions for a specific case
export async function getCaseRetakeSessions(req, res) {
    const log = req.log.child({ caseId: req.params.caseId });
    try {
        const { caseId } = req.params;
        const userId = req.user.id;
        
        if (!caseId) {
            log.warn('Get retake sessions failed: caseId is required.');
            return res.status(400).json({ error: 'caseId parameter is required' });
        }

        const result = await simulationService.getCaseRetakeSessions(caseId, userId);
        log.info({ count: result.length }, 'Retake sessions retrieved successfully');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error getting retake sessions');
        handleError(res, error, log);
    }
}

// Calculate improvement metrics between two sessions
export async function calculateImprovementMetrics(req, res) {
    const log = req.log.child({ currentSessionId: req.body.currentSessionId, previousSessionId: req.body.previousSessionId });
    try {
        const { currentSessionId, previousSessionId } = req.body;
        
        if (!currentSessionId || !previousSessionId) {
            log.warn('Calculate improvement metrics failed: both currentSessionId and previousSessionId are required.');
            return res.status(400).json({ error: 'currentSessionId and previousSessionId are required' });
        }

        const result = await simulationService.calculateImprovementMetrics(currentSessionId, previousSessionId);
        log.info('Improvement metrics calculated successfully');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error calculating improvement metrics');
        handleError(res, error, log);
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

export async function submitTreatmentPlan(req, res) {
    const log = req.log.child({ sessionId: req.params.sessionId });
    try {
        const { sessionId } = req.params;
        const { treatmentPlan } = req.body;

        if (!treatmentPlan || !Array.isArray(treatmentPlan)) {
            log.warn('Invalid treatment plan format');
            return res.status(400).json({ error: 'Treatment plan must be an array of interventions' });
        }

        const TreatmentService = await import('../services/treatmentService.js');
        
        // Record treatment decisions in session
        await TreatmentService.default.recordTreatmentDecisions(sessionId, treatmentPlan);
        
        // Analyze treatment plan and simulate outcomes
        const result = await TreatmentService.default.simulateTreatmentOutcomes(sessionId, treatmentPlan);
        
        log.info('Treatment plan submitted and outcomes simulated successfully');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error submitting treatment plan');
        handleError(res, { message: 'Failed to submit treatment plan' }, log);
    }
}

export async function getTreatmentOutcomes(req, res) {
    const log = req.log.child({ sessionId: req.params.sessionId });
    try {
        const { sessionId } = req.params;
        
        const TreatmentService = await import('../services/treatmentService.js');
        const session = await import('../models/SessionModel.js').then(mod => mod.default.findById(sessionId));
        
        if (!session || !session.treatment_plan || session.treatment_plan.length === 0) {
            log.warn('No treatment plan found for session');
            return res.status(404).json({ error: 'No treatment plan found for this session' });
        }

        // Simulate outcomes based on recorded treatment plan
        const result = await TreatmentService.default.simulateTreatmentOutcomes(sessionId, session.treatment_plan);
        
        log.info('Treatment outcomes retrieved successfully');
        handleSuccess(res, result);
    } catch (error) {
        log.error(error, 'Error retrieving treatment outcomes');
        handleError(res, { message: 'Failed to retrieve treatment outcomes' }, log);
    }
}
