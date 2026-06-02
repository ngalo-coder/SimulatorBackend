const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    specialty: { type: String, required: true },
    category: { type: String, enum: ['Basic', 'Specialised'], required: true },
    difficulty: String,
    patientProfile: {
        age: Number,
        gender: String,
        chiefComplaint: String,
        historyPresent: String,
        pastMedicalHistory: String,
        socialHistory: String,
        familyHistory: String,
        physicalExam: String,
        patientPersonality: String,
        correctDiagnosis: { type: String, required: true },
        expectedQuestions: [String]
    },
    patientSystemPrompt: { type: String, required: true }
});

module.exports = mongoose.model('Case', caseSchema);
