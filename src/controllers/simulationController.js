import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getPatientResponse } from '../services/aiService.js';

// ES module __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory storage for active sessions. In a larger app, use a database like Redis.
const sessions = new Map();

// Load all cases from the /cases directory into memory on startup
const cases = {};
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

export async function handleAsk(req, res) {
    const { sessionId, question } = req.body;
    if (!sessionId || !question) {
        return res.status(400).json({ error: 'sessionId and question are required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const { caseData, history } = session;

    // Check for end session trigger
    const endTrigger = caseData.end_session_trigger;
    if (question.toLowerCase().includes(endTrigger.condition)) {
        console.log(`Session ended: ${sessionId}`);
        sessions.delete(sessionId); // Clean up the session
        return res.json({
            response: endTrigger.response,
            isFinal: true,
            evaluation: caseData.evaluation_criteria
        });
    }

    const aiResponse = await getPatientResponse(caseData, history, question);

    // Update history
    history.push({ role: 'Clinician', content: question });
    history.push({ role: 'Patient', content: aiResponse });
    
    // Update the session in our map
    sessions.set(sessionId, { caseData, history });

    res.json({
        response: aiResponse,
        isFinal: false,
    });
}