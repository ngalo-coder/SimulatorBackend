// import fs from 'fs'; // No longer needed for case loading
// import path from 'path'; // No longer needed for case loading
// import { fileURLToPath } from 'url'; // No longer needed for case loading
// import { v4 as uuidv4 } from 'uuid'; // No longer using uuid for session IDs from this controller directly
import { getPatientResponseStream, createSession, getEvaluation } from '../services/aiService.js';
import Case from '../models/CaseModel.js'; // Import Mongoose Case Model
import Session from '../models/SessionModel.js'; // Import Mongoose Session Model

// const __filename = fileURLToPath(import.meta.url); // Not needed if not using __dirname for cases
// const __dirname = path.dirname(__filename); // Not needed if not using path for cases

const sessions = new Map(); // This will be replaced in a later step
// const cases = {}; // This is now removed, cases come from DB

// // Load all cases from the /cases directory into memory on startup - REMOVED
// const casesDir = path.join(__dirname, '..', '..', 'cases');
// fs.readdirSync(casesDir).forEach(file => {
//   if (file.endsWith('.json')) {
//     const caseId = path.basename(file, '.json');
//     const caseData = JSON.parse(fs.readFileSync(path.join(casesDir, file), 'utf-8'));
//     cases[caseId] = caseData;
//   }
// });

// GET /cases - List all case metadata
export async function getCases(req, res) {
  try {
    // Fetch only necessary fields from case_metadata for the list
    const casesFromDB = await Case.find({})
      .select('case_metadata.case_id case_metadata.title case_metadata.difficulty case_metadata.program_area case_metadata.specialized_area case_metadata.tags case_metadata.estimated_duration_min')
      .lean(); // .lean() returns plain JS objects, good for sending in response

    const caseList = casesFromDB.map(c => ({
      // Map to the structure expected by the frontend, if necessary
      // Assuming frontend expects fields directly from case_metadata
      case_id: c.case_metadata.case_id,
      title: c.case_metadata.title,
      difficulty: c.case_metadata.difficulty,
      program_area: c.case_metadata.program_area,
      specialized_area: c.case_metadata.specialized_area,
      estimated_duration_min: c.case_metadata.estimated_duration_min, // Ensure this field exists in your schema/data
      tags: c.case_metadata.tags,
    }));
    res.json(caseList);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
}

// POST /start - Start a simulation session
export async function startSimulation(req, res) {
  const { caseId } = req.body;
  if (!caseId) {
    return res.status(400).json({ error: 'caseId is required' });
  }

  try {
    const caseDataFromDB = await Case.findOne({ 'case_metadata.case_id': caseId });

    if (!caseDataFromDB) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Convert Mongoose document to a plain JavaScript object for consistent use
    const plainCaseData = caseDataFromDB.toObject();

    // Create a new session document in MongoDB
    const newSession = new Session({
      case_ref: caseDataFromDB._id, // Link to the Case document's ObjectId
      original_case_id: caseDataFromDB.case_metadata.case_id, // Store the string ID
      history: [], // Initial history is empty
      // sessionEnded defaults to false as per schema
    });

    await newSession.save();
    const mongoSessionId = newSession._id.toString();

    // TEMPORARY: Populate in-memory sessions map for handleAsk and endSession to continue working.
    // This will be removed when those functions are refactored to use MongoDB.
    const sessionDataForMemory = {
      caseData: plainCaseData,
      history: newSession.history, // Initially empty
      sessionEnded: newSession.sessionEnded,
      willEndAfterResponse: false, // This specific flag might need to be part of DB session state later
      _id: mongoSessionId // Storing mongoID for reference
    };
    sessions.set(mongoSessionId, sessionDataForMemory);

    // The call to aiService.createSession is removed as aiService should not maintain its own session map.
    // If aiService needs caseData for other initialization, it should be passed directly when its methods are called.

    console.log(`MongoDB Session started: ${mongoSessionId} for case: ${caseId}`);

    res.json({
      sessionId: mongoSessionId, // Return the MongoDB session ID
      initialPrompt: plainCaseData.initial_prompt,
    });
  } catch (error) {
    console.error(`Error starting simulation for caseId ${caseId}:`, error);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
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