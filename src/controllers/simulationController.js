import { getPatientResponseStream, getEvaluation } from '../services/aiService.js';
import Case from '../models/CaseModel.js';
import Session from '../models/SessionModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import logger from '../config/logger.js';

// GET /cases - List all case metadata, with filtering and pagination
export async function getCases(req, res) {
  const log = req.log.child({ query: req.query });
  try {
    const { program_area, specialized_area, page = 1, limit = 20 } = req.query;
    const query = {};

    if (program_area) query['case_metadata.program_area'] = program_area;
    if (specialized_area) {
      if (["null", "None", ""].includes(specialized_area)) {
        query['case_metadata.specialized_area'] = { $in: [null, ""] };
      } else {
        query['case_metadata.specialized_area'] = specialized_area;
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const fieldsToSelect = 'case_metadata.case_id case_metadata.title description case_metadata.difficulty case_metadata.estimated_duration_min case_metadata.program_area case_metadata.specialized_area patient_persona.age patient_persona.gender patient_persona.chief_complaint clinical_dossier.history_of_presenting_illness.associated_symptoms case_metadata.tags';

    const [casesFromDB, totalCases] = await Promise.all([
      Case.find(query).select(fieldsToSelect).skip(skip).limit(limitNum).lean(),
      Case.countDocuments(query)
    ]);
    log.info({ count: casesFromDB.length, total: totalCases }, 'Fetched cases from DB.');

    const formattedCases = casesFromDB.map(c => ({
      id: c.case_metadata?.case_id,
      title: c.case_metadata?.title,
      description: c.description,
      category: c.case_metadata?.specialized_area,
      difficulty: c.case_metadata?.difficulty,
      estimated_time: c.case_metadata?.estimated_duration_min ? `${c.case_metadata.estimated_duration_min} minutes` : "N/A",
      program_area: c.case_metadata?.program_area,
      specialized_area: c.case_metadata?.specialized_area,
      patient_age: c.patient_persona?.age,
      patient_gender: c.patient_persona?.gender,
      chief_complaint: c.patient_persona?.chief_complaint,
      presenting_symptoms: c.clinical_dossier?.history_of_presenting_illness?.associated_symptoms || [],
      tags: c.case_metadata?.tags || [],
    }));

    res.json({
      cases: formattedCases,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCases / limitNum),
      totalCases: totalCases,
    });
  } catch (error) {
    log.error(error, 'Error fetching cases with filters.');
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
}

// POST /start - Start a simulation session
export async function startSimulation(req, res) {
  const { caseId } = req.body;
  const log = req.log.child({ caseId });

  if (!caseId) {
    log.warn('Start simulation failed: caseId is required.');
    return res.status(400).json({ error: 'caseId is required' });
  }

  try {
    const caseDataFromDB = await Case.findOne({ 'case_metadata.case_id': caseId });
    if (!caseDataFromDB) {
      log.warn('Case not found.');
      return res.status(404).json({ error: 'Case not found' });
    }

    const plainCaseData = caseDataFromDB.toObject();
    const newSession = new Session({
      case_ref: caseDataFromDB._id,
      original_case_id: caseDataFromDB.case_metadata.case_id,
      history: [],
    });

    await newSession.save();
    const mongoSessionId = newSession._id.toString();
    log.info({ sessionId: mongoSessionId }, 'MongoDB Session started.');

    res.json({
      sessionId: mongoSessionId,
      initialPrompt: plainCaseData.initial_prompt,
    });
  } catch (error) {
    log.error(error, 'Error starting simulation.');
    res.status(500).json({ error: 'Failed to start simulation' });
  }
}

// GET /ask - Stream simulation response
export async function handleAsk(req, res) {
  const { sessionId, question } = req.query;
  const log = req.log.child({ sessionId, question });

  if (!sessionId || !question) {
    log.warn('Handle ask failed: sessionId and question are required.');
    return res.status(400).json({ error: 'sessionId and question are required' });
  }

  try {
    const session = await Session.findById(sessionId).populate('case_ref');
    if (!session) {
      log.warn('Session not found.');
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.sessionEnded) {
      log.info('Attempted to ask a question in an already ended session.');
      return res.status(403).json({ error: 'Simulation has ended.' });
    }
    if (!session.case_ref) {
      log.error('Session is missing case_ref.');
      return res.status(500).json({ error: 'Internal server error: Case data missing.' });
    }

    const caseData = session.case_ref.toObject();
    session.history.push({ role: 'Clinician', content: question, timestamp: new Date() });

    const diagnosisTriggers = ['heart attack', 'myocardial infarction', 'emergency', 'admit', 'admitted', 'treatment', 'ward', 'emergency care'];
    const willEndAfterResponse = diagnosisTriggers.some(trigger => question.toLowerCase().includes(trigger));
    if (willEndAfterResponse) {
      log.info('Diagnosis trigger detected, session will end after response.');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const { sessionShouldBeMarkedEnded } = await getPatientResponseStream(
        caseData,
        session.history,
        question,
        sessionId,
        res,
        willEndAfterResponse
    );

    if (sessionShouldBeMarkedEnded) {
        session.sessionEnded = true;
        log.info('Session marked as ended based on AI response flow.');
    }

    await session.save();
    log.info('Session updated in DB after AI response.');

  } catch (error) {
    log.error(error, 'Error in handleAsk.');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to handle request' });
    } else {
      log.error('Headers already sent, cannot send JSON error to client.');
      if (!res.writableEnded) res.end();
    }
  }
}

// POST /end - End a simulation session
export async function endSession(req, res) {
  const { sessionId } = req.body;
  const log = req.log.child({ sessionId });

  if (!sessionId) {
    log.warn('End session failed: sessionId is required.');
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const session = await Session.findById(sessionId).populate('case_ref');
    if (!session) {
      log.warn('Session not found.');
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!session.case_ref) {
      log.error('Session is missing case_ref for evaluation.');
      return res.status(500).json({ error: 'Internal server error: Case data missing.' });
    }
    if (session.sessionEnded && session.evaluation) {
      log.info('Session was already ended and evaluated. Returning existing evaluation.');
      return res.json({ sessionEnded: true, evaluation: session.evaluation, history: session.history });
    }

    const caseData = session.case_ref.toObject();
    log.info('Generating evaluation.');
    const { evaluationText, extractedMetrics } = await getEvaluation(caseData, session.history, log);

    session.evaluation = evaluationText;
    session.sessionEnded = true;

    const performanceRecord = new PerformanceMetrics({
      session_ref: session._id,
      case_ref: session.case_ref._id,
      metrics: extractedMetrics,
      evaluation_summary: extractedMetrics.evaluation_summary,
      raw_evaluation_text: evaluationText,
    });

    await session.save();
    await performanceRecord.save();
    log.info('Session ended, evaluation and performance metrics saved to DB.');

    res.json({
      sessionEnded: true,
      evaluation: evaluationText,
      history: session.history
    });

  } catch (error) {
    log.error(error, 'Error in endSession.');
    res.status(500).json({ error: 'Failed to end session or generate evaluation' });
  }
}

// GET /case-categories - List all unique program and specialized areas
export async function getCaseCategories(req, res) {
  const log = req.log;
  try {
    const programAreas = await Case.distinct('case_metadata.program_area');
    const specializedAreasRaw = await Case.distinct('case_metadata.specialized_area');
    const specializedAreas = specializedAreasRaw.filter(area => area && area.trim() !== '');
    log.info('Fetched case categories successfully.');
    res.json({
      program_areas: programAreas.sort(),
      specialized_areas: specializedAreas.sort()
    });
  } catch (error) {
    log.error(error, 'Error fetching case categories.');
    res.status(500).json({ error: 'Failed to fetch case categories' });
  }
}

// GET /performance-metrics/:sessionId - Retrieve performance metrics for a given session
export async function getPerformanceMetricsBySession(req, res) {
  const { sessionId } = req.params;
  const log = req.log.child({ sessionId });

  if (!sessionId) {
    log.warn('Get performance metrics failed: sessionId is required.');
    return res.status(400).json({ error: 'sessionId parameter is required' });
  }

  try {
    const metrics = await PerformanceMetrics.findOne({ session_ref: sessionId })
      .populate('case_ref', 'case_metadata.case_id case_metadata.title');
    if (!metrics) {
      log.warn('Performance metrics not found for this session.');
      return res.status(404).json({ error: 'Performance metrics not found for this session.' });
    }
    log.info('Fetched performance metrics successfully.');
    res.json(metrics);
  } catch (error) {
    log.error(error, 'Error fetching performance metrics.');
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
}

// GET /performance-metrics/user/:userId - Retrieve all performance metrics for a user
export async function getPerformanceMetricsByUser(req, res) {
  const { userId } = req.params;
  const log = req.log.child({ userId });

  if (!userId) {
    log.warn('Get user performance metrics failed: userId is required.');
    return res.status(400).json({ error: 'userId parameter is required' });
  }

  try {
    const metrics = await PerformanceMetrics.find({ user_ref: userId })
      .populate('case_ref', 'case_metadata.case_id case_metadata.title')
      .populate('session_ref', 'original_case_id createdAt')
      .sort({ evaluated_at: -1 });

    if (!metrics || metrics.length === 0) {
      log.info('No performance metrics found for this user.');
      return res.status(404).json({ error: 'No performance metrics found for this user.' });
    }
    log.info({ count: metrics.length }, 'Fetched performance metrics for user.');
    res.json(metrics);
  } catch (error) {
    log.error(error, 'Error fetching performance metrics for user.');
    res.status(500).json({ error: 'Failed to fetch performance metrics for user' });
  }
}