import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const casesDir = path.join(__dirname, '..', '..', 'cases');
const loadedCases = {};

function transformCaseData(rawJsonContent, caseIdFromFile) {
    const sourceData = rawJsonContent.case_metadata || {};
    const patientProfile = rawJsonContent.patient_profile || {};

    const transformed = {
        id: caseIdFromFile,
        title: sourceData.title || "Untitled Case",
        description: rawJsonContent.description || `Case ID: ${caseIdFromFile}`,
        category: sourceData.category || "General",
        difficulty: sourceData.difficulty || "Intermediate",
        estimated_time: sourceData.estimated_duration_min,
        tags: sourceData.tags,
        patient_age: patientProfile.age,
        patient_gender: patientProfile.gender,
        chief_complaint: patientProfile.chief_complaint,
        presenting_symptoms: sourceData.presenting_symptoms,
    };

    Object.keys(transformed).forEach(key => {
        if (transformed[key] === undefined) delete transformed[key];
    });

    return {
        id: caseIdFromFile,
        originalData: rawJsonContent,
        case_metadata: transformed
    };
}

fs.readdirSync(casesDir).forEach(file => {
    if (file.endsWith('.json')) {
        const caseId = path.basename(file, '.json');
        const filePath = path.join(casesDir, file);
        try {
            const rawContent = fs.readFileSync(filePath, 'utf-8');
            const rawJson = JSON.parse(rawContent);
            loadedCases[caseId] = transformCaseData(rawJson, caseId);
            logger.info({ caseId }, 'Successfully loaded and transformed case file.');
        } catch (error) {
            logger.error({ caseId, file, error: error.message }, 'Error loading or parsing case file.');
            // Optionally store a placeholder to prevent crashes downstream
            loadedCases[caseId] = { id: caseId, originalData: { error: `Failed to load ${file}` }, case_metadata: { title: `Error loading ${caseId}` } };
        }
    }
});

export function getAllCasesData() {
    return loadedCases;
}

export function getCaseById(caseId) {
    return loadedCases[caseId];
}
