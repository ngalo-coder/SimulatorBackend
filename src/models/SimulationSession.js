import mongoose from 'mongoose';

const simulationSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case',
        required: true
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    systemStatus: {
        type: String,
        enum: ['ACTIVE', 'ERROR', 'RECOVERING', 'COMPLETED'],
        default: 'ACTIVE'
    },
    lastError: {
        type: {
            type: String,
            enum: ['PATIENT_NONRESPONSIVE', 'SYSTEM_ERROR']
        },
        timestamp: Date,
        details: String
    },
    recoveryAttempts: {
        type: Number,
        default: 0
    },
    lastRecoveryAttempt: {
        type: Date
    },
    interactions: [{
        type: {
            type: String,
            enum: ['QUESTION', 'RESPONSE', 'ACTION', 'ERROR']
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        content: String
    }],
    metadata: {
        specialty: String,
        difficulty: String,
        category: String
    }
}, {
    timestamps: true
});

// Indexes for performance
simulationSessionSchema.index({ userId: 1, startTime: -1 });
simulationSessionSchema.index({ systemStatus: 1 });
simulationSessionSchema.index({ 'lastError.timestamp': -1 });

const SimulationSession = mongoose.model('SimulationSession', simulationSessionSchema);

export default SimulationSession;
