import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getPatientResponseStream } from '../services/aiService.js';

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

// GET /cases - List all case metadata
export function getCases(req, res) {
    const caseList = Object.values(cases).map(c => ({
        case_id: c.case_metadata?.case_id,
        title: c.case_metadata?.title,
        difficulty: c.case_metadata?.difficulty,
        estimated_duration_min: c.case_metadata?.estimated_duration_min,
        tags: c.case_metadata?.tags,
    }));
    res.json(caseList);
}

export function startSimulation(req, res) {
    const { caseId } = req.body;
    if (!caseId || !cases[caseId]) {
        return res.status(404).json({ error: 'Case not found' });
    }

    const sessionId = uuidv4();
    const caseData = cases[caseId];
    
    sessions.set(sessionId, {
        caseData: caseData,
        history: [],
    });

    console.log(`Session started: ${sessionId} for case: ${caseId}`);

    res.json({
        sessionId: sessionId,
        initialPrompt: caseData.initial_prompt,
    });
}

export async function handleAsk(req, res) {
  const sessionId = req.body?.sessionId || req.query?.sessionId;
  const question = req.body?.question || req.query?.question;

  if (!sessionId || !question) {
    return res.status(400).json({ error: 'sessionId and question are required' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { caseData, history } = session;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  history.push({ role: 'Clinician', content: question });

  await getPatientResponseStream(caseData, history, question, res);
}
