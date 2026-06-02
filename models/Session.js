const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userId: { type: String, default: 'anonymous' },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    conversation: [
        {
            role: { type: String, enum: ['user', 'patient'] },
            content: String,
            timestamp: { type: Date, default: Date.now }
        }
    ],
    userDiagnosis: String,
    endedManually: { type: Boolean, default: false },
    assessment: {
        grade: String,
        score: Number,
        feedback: String,
        strengths: [String],
        weaknesses: [String]
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);
