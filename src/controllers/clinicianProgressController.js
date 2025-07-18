import * as clinicianProgressService from '../services/clinicianProgressService.js';
import { handleSuccess, handleError } from '../utils/responseHandler.js';
import logger from '../config/logger.js';

const log = logger.child({ module: 'clinicianProgressController' });

export const getClinicianProgress = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            log.warn('Get clinician progress failed: userId is required');
            return res.status(400).json({ error: 'userId parameter is required' });
        }
        const progressData = await clinicianProgressService.getClinicianProgress(userId);
        log.info({ userId }, 'Fetched clinician progress successfully');
        handleSuccess(res, progressData);
    } catch (error) {
        log.error(error, 'Error fetching clinician progress');
        handleError(res, { message: 'Failed to fetch clinician progress' }, log);
    }
};

export const updateProgressAfterCase = async (req, res) => {
    try {
        const { userId, caseId, performanceMetricsId } = req.body;
        if (!userId || !caseId || !performanceMetricsId) {
            log.warn('Update progress failed: missing required parameters');
            return res.status(400).json({ error: 'userId, caseId, and performanceMetricsId are required' });
        }
        const progress = await clinicianProgressService.updateProgressAfterCase(userId, caseId, performanceMetricsId);
        log.info({ userId }, 'Updated clinician progress successfully');
        handleSuccess(res, { progress }, 'Progress updated successfully');
    } catch (error) {
        log.error(error, 'Error updating clinician progress');
        handleError(res, { message: 'Failed to update clinician progress' }, log);
    }
};

export const getProgressRecommendations = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            log.warn('Get recommendations failed: userId is required');
            return res.status(400).json({ error: 'userId parameter is required' });
        }
        const recommendations = await clinicianProgressService.getProgressRecommendations(userId);
        log.info({ userId }, 'Generated case recommendations');
        handleSuccess(res, recommendations);
    } catch (error) {
        log.error(error, 'Error generating recommendations');
        handleError(res, { message: 'Failed to generate recommendations' }, log);
    }
};
