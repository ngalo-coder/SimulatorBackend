import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getPatientResponseStream, createSession, getEvaluation } from '../services/aiService.js'; // Added getEvaluation

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

// POST /start - Start a simulation session
export function startSimulation(req, res) {
  const { caseId } = req.body;
  if (!caseId || !cases[caseId]) {
    return res.status(404).json({ error: 'Case not found' });
  }

  const sessionId = uuidv4();
  const caseData = cases[caseId];

  const sessionData = {
    caseData,
    history: [],
    sessionEnded: false,
    willEndAfterResponse: false
  };
  
  sessions.set(sessionId, sessionData);
  createSession(sessionId, caseData);

  console.log(`Session started: ${sessionId} for case: ${caseId}`);

  res.json({
    sessionId,
    initialPrompt: caseData.initial_prompt,
  });
}

// GET /ask - Stream simulation response
export async function handleAsk(req, res) {
  const sessionId = req.query.sessionId;
  const question = req.query.question;

  if (!sessionId || !question) {
    return res.status(400).json({ error: 'sessionId and question are required' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.sessionEnded) {
    return res.status(403).json({ 
      error: 'Simulation has ended. Please start a new session.',
      summary: "The session concluded with the patient being admitted for emergency care."
    });
  }

  const { caseData, history } = session;

  // Add clinician's question to history
  history.push({ role: 'Clinician', content: question });

  // Check for diagnosis
  const diagnosisTriggers = [
    'heart attack', 'myocardial infarction', 'emergency', 
    'admit', 'admitted', 'treatment', 'ward', 'emergency care'
  ];
  const lowerQuestion = question.toLowerCase();
  
  if (diagnosisTriggers.some(trigger => lowerQuestion.includes(trigger))) {
    session.willEndAfterResponse = true;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  await getPatientResponseStream(caseData, history, question, sessionId, res);
}

// POST /end - End a simulation session
export async function endSession(req, res) { // Made function async
  const { sessionId } = req.body;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  session.sessionEnded = true;
  
  // Generate detailed evaluation
  const evaluation = await getEvaluation(session.caseData, session.history);
  
  const patientName = session.caseData?.patient_persona?.name ||
                      session.caseData?.patient_profile?.name ||
                      "the patient"; // Fallback for patient name

  // The getEvaluation function is expected to return the full formatted string.
  // If it only returns the core evaluation content, we might need to wrap it here.
  // For now, assuming getEvaluation returns the complete desired output.

  console.log(`Session ${sessionId} ended. Evaluation generated.`);

  res.json({
    sessionEnded: true,
    evaluation: evaluation, // Send the detailed evaluation
    history: session.history // Still useful to send history for review
  });
}