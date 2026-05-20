import * as clinicianProgressService from '../services/clinicianProgressService.js';
import { handleSuccess, handleError } from '../utils/responseHandler.js';
import logger from '../config/logger.js';

const log = logger.child({ module: 'clinicianProgressController' });

export const getClinicianProgress = async (req, res) => {
    try {
        const progressData = await clinicianProgressService.getClinicianProgress(req.params.userId);
        handleSuccess(res, progressData);
    } catch (error) {
        log.error(error, 'Progress fetch failed');
        handleError(res, error, log);
    }
};

export const updateProgressAfterCase = async (req, res) => {
    try {
        const { userId, caseId, performanceMetricsId } = req.body;
        const progress = await clinicianProgressService.updateProgressAfterCase(userId, caseId, performanceMetricsId);
        log.info({ userId }, 'Progress updated');
        handleSuccess(res, { progress });
    } catch (error) {
        log.error(error, 'Progress update failed');
        handleError(res, error, log);
    }
};

export const getProgressRecommendations = async (req, res) => {
    try {
        const recommendations = await clinicianProgressService.getProgressRecommendations(req.params.userId);
        handleSuccess(res, recommendations);
    } catch (error) {
        log.error(error, 'Recommendations failed');
        handleError(res, error, log);
    }
};
