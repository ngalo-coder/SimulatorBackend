import { v4 as uuidv4 } from 'uuid';
// Import the new streaming function
import { getPatientResponseStream } from '../services/aiService.js';
import { getAllCasesData, getCaseById } from '../services/caseService.js'; // Import case service functions

const sessions = new Map();
// const cases = {}; // Cases are now managed by caseService

// Load all cases from the /cases directory into memory on startup
// This logic is now in caseService.js

export function startSimulation(req, res) {
    const { caseId } = req.body;
    const caseInfo = getCaseById(caseId); // Use caseService

    if (!caseId || !caseInfo) {
        return res.status(404).json({ error: 'Case not found' });
    }

    const sessionId = uuidv4();
    // caseData for session should be the original, rich data for AI context
    // but initial_prompt might come from transformed metadata or be generated
    const caseDataForSession = caseInfo.originalData; // Used for AI context
    const transformedMetadata = caseInfo.case_metadata; // Used for prompt generation requiring specific field names

    // Generate initialPrompt using the guide's logic
    let initialPrompt = "Welcome to the simulation. How can I help you?"; // Default
    if (transformedMetadata.chief_complaint && transformedMetadata.patient_age && transformedMetadata.patient_gender) {
        initialPrompt = `Hello, I'm a ${transformedMetadata.patient_age}-year-old ${String(transformedMetadata.patient_gender).toLowerCase()} and I'm here because ${String(transformedMetadata.chief_complaint).toLowerCase()}.`;
        if (transformedMetadata.clinical_context) {
            initialPrompt += ` ${String(transformedMetadata.clinical_context.toLowerCase())}.`;
        }
    } else {
        // Fallback if essential fields for the detailed prompt are missing
        // Use a generic prompt from original data if available
        initialPrompt = caseDataForSession.initial_prompt || transformedMetadata.initial_prompt || "Hello, I'm here for my appointment.";
        console.warn(`[simulationController] Missing some fields in transformedMetadata for detailed initialPrompt for case ${caseId}. Used fallback.`);
    }
    
    const conversationHistory = [
        {
            role: "patient", // As per guide's session structure example
            content: initialPrompt,
            timestamp: new Date().toISOString()
        }
    ];

    sessions.set(sessionId, {
        caseId: caseId,
        caseData: caseDataForSession,
        transformedMetadata: transformedMetadata,
        history: conversationHistory, // Initialize with the patient's first statement
        startTime: new Date().toISOString(),
        questionCount: 0,
        isComplete: false
    });

    console.log(`Session started: ${sessionId} for case: ${caseId}. Initial prompt: "${initialPrompt}"`);

    res.json({
        sessionId: sessionId,
        initialPrompt: initialPrompt,
    });
}

// THIS FUNCTION IS COMPLETELY REWRITTEN
export async function handleAsk(req, res) {
    // We now get data from query parameters because EventSource (on the frontend) uses GET
    const { sessionId, question } = req.query;

    if (!sessionId || !question) {
        return res.status(400).json({ error: 'sessionId and question are required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    // caseData here refers to the original data stored for the session, needed for AI context
    const { caseData, history, transformedMetadata } = session;

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Send headers immediately

    // Update history before starting the stream
    history.push({ role: 'Clinician', content: question });
    
    // Call the new streaming function, passing the response object `res`
    // This function will now control writing to and ending the response.
    await getPatientResponseStream(caseData, history, question, res);

    // After the stream is done, we need to save the AI's full response to history.
    // The front-end will need to send the complete message back in a final call,
    // or we can accumulate it here. For simplicity, we won't accumulate it on the backend
    // in this example to keep the focus on streaming. A more robust solution would.
}

export function getAllCases(req, res) {
    const allCases = getAllCasesData();
    // The /api/simulation/cases endpoint expects a structure like:
    // { "caseId1": { "case_metadata": { ... } }, "caseId2": { "case_metadata": { ... } } }
    const responseCases = {};
    for (const caseId in allCases) {
        if (Object.hasOwnProperty.call(allCases, caseId)) {
            responseCases[caseId] = {
                case_metadata: allCases[caseId].case_metadata // Use the transformed metadata
            };
        }
    }
    // console.log("[simulationController] Sending responseCases for /cases:", JSON.stringify(responseCases, null, 2));
    res.json(responseCases);
}