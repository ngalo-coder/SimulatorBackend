import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const casesDir = path.join(__dirname, '..', '..', 'cases'); // Adjust path to go up two levels from services/
const loadedCases = {};

/**
 * Converts camelCase string to snake_case.
 * @param {string} str The input string.
 * @returns {string} The snake_case string.
 */
function toSnakeCase(str) {
    if (!str) return str;
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Transforms the raw case data loaded from a JSON file
 * to the structure expected by the frontend, particularly for case_metadata.
 * @param {object} rawCaseData The raw data from the JSON file.
 * @param {string} caseId The ID of the case.
 * @returns {object} The transformed case data.
 */
function transformCaseData(rawJsonFileContent, caseIdFromFile) {
    // rawJsonFileContent is the entire object parsed from the JSON file.
    // The guide's example for a case file (cases/VP-ABD-001.json) has a top-level "case_metadata" object.
    // However, our existing case files have "case_metadata" as one key among others like "version", "patient_profile".

    const sourceDataForMetadata = rawJsonFileContent.case_metadata || {}; // This is the object like { case_id:"VP-ABD-001", title:"...", ...}
    const patientProfile = rawJsonFileContent.patient_profile || {};

    // Mapping from PatientCase interface fields to where they might be in our current JSON structure
    const transformed = {
        id: caseIdFromFile, // from file name, or sourceDataForMetadata.case_id
        title: sourceDataForMetadata.title,
        description: rawJsonFileContent.description, // Description is top-level in our current files
        category: sourceDataForMetadata.category, // Assuming category is in case_metadata
        difficulty: sourceDataForMetadata.difficulty,
        estimated_time: sourceDataForMetadata.estimated_time || sourceDataForMetadata.estimatedTime || sourceDataForMetadata.estimated_duration_min, // Handle variations
        tags: sourceDataForMetadata.tags,
        specialty: sourceDataForMetadata.specialty,
        level: sourceDataForMetadata.level,
        duration: sourceDataForMetadata.duration || sourceDataForMetadata.estimated_time || sourceDataForMetadata.estimatedTime || sourceDataForMetadata.estimated_duration_min, // Reuse estimated time if duration is missing
        learning_objectives: sourceDataForMetadata.learning_objectives || sourceDataForMetadata.learningObjectives,
        clinical_context: sourceDataForMetadata.clinical_context || sourceDataForMetadata.clinicalContext,
        patient_age: patientProfile.age || sourceDataForMetadata.patient_age || sourceDataForMetadata.patientAge,
        patient_gender: patientProfile.gender || sourceDataForMetadata.patient_gender || sourceDataForMetadata.patientGender,
        chief_complaint: patientProfile.chief_complaint || sourceDataForMetadata.chief_complaint || sourceDataForMetadata.chiefComplaint,
        presenting_symptoms: sourceDataForMetadata.presenting_symptoms || sourceDataForMetadata.presentingSymptoms,
        // Fields from the guide's example `cases/VP-ABD-001.json` that might be useful for AI context later,
        // but are not strictly part of the PatientCase interface shown for the /cases endpoint.
        // These should be part of `originalData` if needed.
        // patient_background: sourceDataForMetadata.patient_background,
        // key_history_points: sourceDataForMetadata.key_history_points,
        // evaluation_criteria: sourceDataForMetadata.evaluation_criteria
    };

    // Ensure minimum fields
    if (!transformed.title) transformed.title = "Untitled Case";
    if (!transformed.description) transformed.description = `Case ID: ${caseIdFromFile}`; // Use caseId if description is missing
    if (!transformed.category) transformed.category = "General";
    if (!transformed.difficulty) transformed.difficulty = "Intermediate";

    // Remove undefined fields to keep the output clean
    Object.keys(transformed).forEach(key => {
        if (transformed[key] === undefined) {
            delete transformed[key];
        }
    });

    // console.log(`[caseService] Transformed metadata for ${caseIdFromFile}:`, JSON.stringify(transformed, null, 2));
    return {
        id: caseIdFromFile,
        originalData: rawJsonFileContent, // Store the complete original content
        case_metadata: transformed // This is the object that aligns with PatientCase and snake_case needs
    };
}

fs.readdirSync(casesDir).forEach(file => {
    if (file.endsWith('.json')) {
        const caseId = path.basename(file, '.json');
        // console.log(`[caseService] Loading file: ${file}`);
        try {
            const rawCaseContent = JSON.parse(fs.readFileSync(path.join(casesDir, file), 'utf-8'));
            const transformationResult = transformCaseData(rawCaseContent, caseId);
            loadedCases[caseId] = transformationResult;
            // console.log(`[caseService] Stored transformed data for ${caseId}:`, JSON.stringify(transformationResult.case_metadata, null, 2));
        } catch (error) {
            console.error(`[caseService] Error loading or parsing case file ${file}:`, error);
            // Store raw data if transformation fails, so it doesn't break other parts if one file is problematic.
            const rawContentOnError = fs.readFileSync(path.join(casesDir, file), 'utf-8');
            try {
                loadedCases[caseId] = { id: caseId, originalData: JSON.parse(rawContentOnError), case_metadata: { title: `Error loading ${caseId}` } };
            } catch {
                 loadedCases[caseId] = { id: caseId, originalData: {error: "Could not parse file"}, case_metadata: { title: `Error parsing ${caseId}` } };
            }
        }
    }
});

export function getAllCasesData() {
    return loadedCases;
}

export function getCaseById(caseId) {
    return loadedCases[caseId];
}
