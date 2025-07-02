import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
// Import the new streaming function
import { getPatientResponseStream } from '../services/aiService.js';

// ES module __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessions = new Map();
const cases = {};

// Load all cases from the /cases directory into memory on startup
const casesDir = path.join(__dirname, '..', '..', 'cases');
fs.readdirSync(casesDir).forEach(file => {
    if (file.endsWith('.json')) {
        const caseId = path.basename(file, '.json');
        const caseData = JSON.parse(fs.readFileSync(path.join(casesDir, file), 'utf-8'));
        cases[caseId] = caseData;
    }
});

export function startSimulation(req, res) {
    const { caseId } = req.body;
    if (!caseId || !cases[caseId]) {
        return res.status(404).json({ error: 'Case not found' });
    }

    const sessionId = uuidv4();
    const caseData = cases[caseId];
    
    sessions.set(sessionId, {
        caseData: caseData,
        history: [], // Start with an empty conversation history
    });

    console.log(`Session started: ${sessionId} for case: ${caseId}`);

    res.json({
        sessionId: sessionId,
        initialPrompt: caseData.initial_prompt,
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

    const { caseData, history } = session;

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