import mongoose from 'mongoose';

export const validateObjectId = (paramName) => (req, res, next) => {
    const id = req.params[paramName] || req.body[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid ${paramName}` });
    }
    next();
};

export const validateEndSession = (req, res, next) => {
    const { sessionId } = req.body;
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({ message: 'Valid sessionId required' });
    }
    next();
};

export const validateProgressUpdate = (req, res, next) => {
    const { userId, caseId, performanceMetricsId } = req.body;
    const ids = [
        { name: 'userId', value: userId },
        { name: 'caseId', value: caseId },
        { name: 'performanceMetricsId', value: performanceMetricsId }
    ];
    
    for (const { name, value } of ids) {
        if (!value || !mongoose.Types.ObjectId.isValid(value)) {
            return res.status(400).json({ message: `Valid ${name} required` });
        }
    }
    next();
};

export const validateTreatmentPlan = (req, res, next) => {
    const { treatmentPlan } = req.body;
    
    if (!treatmentPlan || !Array.isArray(treatmentPlan)) {
        return res.status(400).json({ message: 'Treatment plan must be an array' });
    }

    for (const intervention of treatmentPlan) {
        if (!intervention.intervention || typeof intervention.intervention !== 'string') {
            return res.status(400).json({ message: 'Each intervention must have a valid intervention description' });
        }

        // Validate optional fields if present
        if (intervention.dosage && typeof intervention.dosage !== 'string') {
            return res.status(400).json({ message: 'Dosage must be a string if provided' });
        }

        if (intervention.frequency && typeof intervention.frequency !== 'string') {
            return res.status(400).json({ message: 'Frequency must be a string if provided' });
        }
    }

    next();
};