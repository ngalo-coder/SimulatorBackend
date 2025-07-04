// import fs from 'fs'; // No longer needed for case loading
// import path from 'path'; // No longer needed for case loading
// import { fileURLToPath } from 'url'; // No longer needed for case loading
// import { v4 as uuidv4 } from 'uuid'; // No longer using uuid for session IDs from this controller directly
import { getPatientResponseStream, getEvaluation } from '../services/aiService.js';
import Case from '../models/CaseModel.js'; // Import Mongoose Case Model
import Session from '../models/SessionModel.js'; // Import Mongoose Session Model

// const __filename = fileURLToPath(import.meta.url); // Not needed if not using __dirname for cases
// const __dirname = path.dirname(__filename); // Not needed if not using path for cases

// const sessions = new Map(); // REMOVED: No longer using in-memory map for sessions
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

// GET /cases - List all case metadata, now with filtering
export async function getCases(req, res) {
  try {
    const { program_area, specialized_area } = req.query;
    const query = {};

    if (program_area) {
      query['case_metadata.program_area'] = program_area;
    }
    if (specialized_area) {
      // If specialized_area is 'None' or an empty string from query,
      // we might want to specifically query for null or empty.
      // For now, assuming a direct match or it's omitted.
      // If specialized_area is "null" as a string, we'd query for actual null.
      if (specialized_area === "null" || specialized_area === "None" || specialized_area === "") {
        query['case_metadata.specialized_area'] = { $in: [null, ""] };
      } else {
        query['case_metadata.specialized_area'] = specialized_area;
      }
    }

    // Fetch only necessary fields from case_metadata for the list
    const casesFromDB = await Case.find(query)
      .select('case_metadata.case_id case_metadata.title case_metadata.difficulty case_metadata.program_area case_metadata.specialized_area case_metadata.tags case_metadata.estimated_duration_min')
      .lean(); // .lean() returns plain JS objects, good for sending in response

    const caseList = casesFromDB.map(c => ({
      case_id: c.case_metadata.case_id,
      title: c.case_metadata.title,
      difficulty: c.case_metadata.difficulty,
      program_area: c.case_metadata.program_area,
      specialized_area: c.case_metadata.specialized_area,
      estimated_duration_min: c.case_metadata.estimated_duration_min,
      tags: c.case_metadata.tags,
    }));
    res.json(caseList);
  } catch (error) {
    console.error('Error fetching cases with filters:', error);
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

    // The call to aiService.createSession is removed as aiService should not maintain its own session map.
    // If aiService needs caseData for other initialization, it should be passed directly when its methods are called.

    // In-memory session map population is now removed.
    // sessions.set(mongoSessionId, sessionDataForMemory); // REMOVED

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

  try {
    const session = await Session.findById(sessionId).populate('case_ref');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.sessionEnded) {
      return res.status(403).json({
        error: 'Simulation has ended. Please start a new session.',
        // Consider if a summary is still relevant or if evaluation should be fetched
      });
    }

    if (!session.case_ref) {
        console.error(`Session ${sessionId} is missing case_ref.`);
        return res.status(500).json({ error: 'Internal server error: Case data missing for session.' });
    }

    const caseData = session.case_ref.toObject(); // Get plain object for case data

    // Add clinician's question to history
    session.history.push({ role: 'Clinician', content: question, timestamp: new Date() });
    // Note: We will save the session after the AI response is also added.

    let willEndAfterResponse = false; // Local flag for this request/response cycle
    const diagnosisTriggers = [
      'heart attack', 'myocardial infarction', 'emergency',
      'admit', 'admitted', 'treatment', 'ward', 'emergency care'
    ];
    const lowerQuestion = question.toLowerCase();

    if (diagnosisTriggers.some(trigger => lowerQuestion.includes(trigger))) {
      willEndAfterResponse = true;
      // If this flag needs to be persisted in DB immediately, update session model and save here.
      // session.willEndAfterResponse = true; // Example if field existed in SessionModel
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Modify getPatientResponseStream or use a wrapper to capture the full AI response
    // For now, we assume getPatientResponseStream is modified or a new service is used
    // that allows us to get the full response for saving, while still streaming.
    // This is a simplified representation of how it might work if getPatientResponseStream
    // internally updates the session history after full response is collected.
    // A more robust way would be for getPatientResponseStream to take a callback
    // that it calls with the full response text once available.

    // Let's make a placeholder for how history update would work post-streaming.
    // The actual implementation of capturing full response from stream
    // while streaming needs careful handling in aiService.getPatientResponseStream.
    // For this step, we'll simulate this by calling it, then imagine we got the full response.

    // The current `getPatientResponseStream` in `aiService.js` has a side effect:
    // `session.history.push({ role: 'Patient', content: fullResponse });`
    // This was fine for in-memory, but for MongoDB, we need to ensure `session` object
    // here is the one that gets this push and then is saved.

    // To correctly handle this:
    // 1. `getPatientResponseStream` should be adapted. It currently takes `history` as a parameter.
    //    It should operate on a copy or be aware it's a Mongoose subdocument array.
    // 2. The `session.save()` should happen *after* `getPatientResponseStream` has finished
    //    and the AI's response has been pushed to `session.history`.

    // Simulating the flow:
    // `getPatientResponseStream` will internally push to the history array it receives.
    // Since `session.history` is passed, it will be updated by `getPatientResponseStream`.

    // The `aiService.getPatientResponseStream` is expected to handle adding the AI response to the history array
    // and potentially updating the session's `sessionEnded` status if `willEndAfterResponse` is true.
    // It will need the Mongoose `session` object to do this and then save it.
    // OR, `handleAsk` can manage this.

    // Let's adjust the call to getPatientResponseStream and handle history saving here.
    // We'll need to modify getPatientResponseStream to return the full response.
    // This is a significant change to aiService. For now, let's assume aiService
    // is refactored to support this.

    // Placeholder for what getPatientResponseStream should do:
    // It streams to `res`, and also returns the full response string.
    // This is a conceptual change for getPatientResponseStream

    // For now, to make minimal changes to getPatientResponseStream's signature,
    // we rely on its existing side-effect of pushing to the history array.
    // We then save the session. This implies getPatientResponseStream must correctly
    // handle the Mongoose array.

    await getPatientResponseStream(
        caseData,
        session.history, // Pass the Mongoose array directly
        question,
        sessionId, // session._id.toString()
        res,
        willEndAfterResponse // Pass this flag to aiService
    );

    // After the stream has finished and getPatientResponseStream has pushed the AI's response
    // to session.history (and potentially updated session.sessionEnded if willEndAfterResponse was true), save.
    // This relies on getPatientResponseStream's internal logic in aiService.js to update these.
    // Specifically, aiService.js's getPatientResponseStream has:
    //   `sessionInMemory.history.push({ role: 'Patient', content: fullResponse });`
    //   `if (sessionInMemory.willEndAfterResponse) { sessionInMemory.sessionEnded = true; ... }`
    // This `sessionInMemory` was from its own map. Now it needs to operate on the passed `session` Mongoose object.
    // This change to aiService is implied by this refactoring.
    // Assuming aiService.getPatientResponseStream is updated to:
    //    - take `willEndAfterResponse` as a parameter.
    //    - push to the `history` array it receives.
    //    - if `willEndAfterResponse` is true, set `session.sessionEnded = true` on the mongoose session object.

    // If `willEndAfterResponse` was true, `getPatientResponseStream` (or logic within it) should have set `session.sessionEnded = true`.
    // We save the session which now includes the clinician's question and
    // the patient's response (pushed into session.history by getPatientResponseStream).
    // Also, update sessionEnded status based on the flag returned from aiService.
    const { sessionShouldBeMarkedEnded } = await getPatientResponseStream(
        caseData,
        session.history, // Pass the Mongoose array directly
        question,
        sessionId, // session._id.toString()
        res,
        willEndAfterResponse // Pass this flag to aiService
    );

    if (sessionShouldBeMarkedEnded) {
        session.sessionEnded = true;
        console.log(`Session ${sessionId} marked as ended in DB based on AI response flow.`);
    }

    await session.save();
    console.log(`Session ${sessionId} updated in DB after AI response.`);

  } catch (error) {
    console.error(`Error in handleAsk for sessionId ${sessionId}:`, error);
    // Ensure response isn't already sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to handle request' });
    } else {
      // If headers already sent (i.e., during streaming), we can't send JSON error.
      // We might just end the response or log.
      console.error('Headers already sent, cannot send JSON error to client.');
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
}

// POST /end - End a simulation session
export async function endSession(req, res) {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const session = await Session.findById(sessionId).populate('case_ref');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.case_ref) {
        console.error(`Session ${sessionId} for endSession is missing case_ref.`);
        return res.status(500).json({ error: 'Internal server error: Case data missing for session evaluation.' });
    }

    // Prevent re-evaluating an already ended session if evaluation already exists,
    // though typically UI might prevent calling /end on an ended session.
    // If session.sessionEnded is true but no evaluation, we proceed to generate it.
    if (session.sessionEnded && session.evaluation) {
        console.log(`Session ${sessionId} was already ended and evaluated. Returning existing evaluation.`);
        return res.json({
            sessionEnded: true,
            evaluation: session.evaluation,
            history: session.history
        });
    }

    const caseData = session.case_ref.toObject(); // For aiService.getEvaluation

    const evaluationText = await getEvaluation(caseData, session.history);

    session.evaluation = evaluationText;
    session.sessionEnded = true;
    await session.save();

    console.log(`Session ${sessionId} ended, evaluation generated and saved to DB.`);

    res.json({
      sessionEnded: true,
      evaluation: session.evaluation,
      history: session.history
    });

  } catch (error) {
    console.error(`Error in endSession for sessionId ${sessionId}:`, error);
    res.status(500).json({ error: 'Failed to end session or generate evaluation' });
  }
}

// GET /case-categories - List all unique program and specialized areas
export async function getCaseCategories(req, res) {
  try {
    const programAreas = await Case.distinct('case_metadata.program_area');

    // Fetch distinct specialized areas and filter out null/empty values
    const specializedAreasRaw = await Case.distinct('case_metadata.specialized_area');
    const specializedAreas = specializedAreasRaw.filter(area => area && area.trim() !== '');

    res.json({
      program_areas: programAreas.sort(), // Sort for consistent ordering
      specialized_areas: specializedAreas.sort() // Sort for consistent ordering
    });

  } catch (error) {
    console.error('Error fetching case categories:', error);
    res.status(500).json({ error: 'Failed to fetch case categories' });
  }
}