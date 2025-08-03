import { getPatientResponseStream, getEvaluation } from './aiService.js';
import Case from '../models/CaseModel.js';
import Session from '../models/SessionModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import axios from 'axios';

export async function getCases(queryParams) {
    const { program_area, specialty, specialized_area, page = 1, limit = 20 } = queryParams;
    const query = {};

    if (program_area) query['case_metadata.program_area'] = program_area;
    if (specialty) query['case_metadata.specialty'] = specialty;
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

    const formattedCases = casesFromDB.map(c => ({
        id: c.case_metadata?.case_id,
        title: c.case_metadata?.title.replace(/ with.*$/, ''),
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

    return {
        cases: formattedCases,
        currentPage: pageNum,
        totalPages: Math.ceil(totalCases / limitNum),
        totalCases: totalCases,
    };
}

export async function startSimulation(caseId) {
    let caseDataFromDB = await Case.findOne({ 'case_metadata.case_id': caseId });

    if (!caseDataFromDB) {
        throw { status: 404, message: 'Case not found' };
    }

    const newSession = new Session({
        case_ref: caseDataFromDB._id,
        original_case_id: caseDataFromDB.case_metadata.case_id,
        history: [],
    });

    await newSession.save();
    
    // Extract patient information for the frontend
    const patientPersona = caseDataFromDB.patient_persona;
    const patientName = patientPersona?.name || 'Virtual Patient';
    const speaksFor = patientPersona?.speaks_for;
    
    return {
        sessionId: newSession._id.toString(),
        initialPrompt: caseDataFromDB.initial_prompt,
        patientName: patientName,
        speaks_for: speaksFor
    };
}

export async function handleAsk(sessionId, question, res) {
    const session = await Session.findById(sessionId).populate('case_ref');
    if (!session) {
        throw { status: 404, message: 'Session not found' };
    }
    if (session.sessionEnded) {
        throw { status: 403, message: 'Simulation has ended.' };
    }
    if (!session.case_ref) {
        throw { status: 500, message: 'Internal server error: Case data missing.' };
    }

    const caseData = session.case_ref.toObject();
    session.history.push({ role: 'Clinician', content: question, timestamp: new Date() });

    const diagnosisTriggers = ['heart attack', 'myocardial infarction', 'emergency', 'admit', 'admitted', 'treatment', 'ward', 'emergency care'];
    const willEndAfterResponse = diagnosisTriggers.some(trigger => question.toLowerCase().includes(trigger));

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
    }

    await session.save();
}

export async function endSession(sessionId, user, headers) {
    const session = await Session.findById(sessionId).populate('case_ref');
    if (!session) {
        throw { status: 404, message: 'Session not found' };
    }
    if (!session.case_ref) {
        throw { status: 500, message: 'Internal server error: Case data missing.' };
    }
    if (session.sessionEnded && session.evaluation) {
        return { sessionEnded: true, evaluation: session.evaluation, history: session.history };
    }

    const caseData = session.case_ref.toObject();
    const { evaluationText, extractedMetrics } = await getEvaluation(caseData, session.history);

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

    if (user && user._id) {
        try {
            const progressData = {
                userId: user._id,
                caseId: session.case_ref._id,
                performanceMetricsId: performanceRecord._id
            };
            await axios.post(`${process.env.API_BASE_URL || 'http://localhost:5001'}/api/progress/update`, progressData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': headers.authorization
                }
            });
        } catch (progressError) {
            // Log the error but don't fail the request
            console.error('Error updating clinician progress, but session ended successfully', progressError);
        }
    }

    return {
        sessionEnded: true,
        evaluation: evaluationText,
        history: session.history
    };
}

export async function getCaseCategories(program_area) {
    const programAreas = await Case.distinct('case_metadata.program_area');
    const specialtyQuery = program_area ? { 'case_metadata.program_area': program_area } : {};
    const specialtiesRaw = await Case.distinct('case_metadata.specialty', specialtyQuery);
    const specialties = specialtiesRaw.filter(specialty => specialty && specialty.trim() !== '');
    const specializedAreasRaw = await Case.distinct('case_metadata.specialized_area');
    const specializedAreas = specializedAreasRaw.filter(area => area && area.trim() !== '');

    return {
        program_areas: programAreas.sort(),
        specialties: specialties.sort(),
        specialized_areas: specializedAreas.sort()
    };
}

export async function getPerformanceMetricsBySession(sessionId) {
    const metrics = await PerformanceMetrics.findOne({ session_ref: sessionId })
        .populate('case_ref', 'case_metadata.case_id case_metadata.title');
    if (!metrics) {
        throw { status: 404, message: 'Performance metrics not found for this session.' };
    }
    return metrics;
}

export async function getPerformanceMetricsByUser(userId) {
    const metrics = await PerformanceMetrics.find({ user_ref: userId })
        .populate('case_ref', 'case_metadata.case_id case_metadata.title')
        .populate('session_ref', 'original_case_id createdAt')
        .sort({ evaluated_at: -1 });

    if (!metrics || metrics.length === 0) {
        throw { status: 404, message: 'No performance metrics found for this user.' };
    }
    return metrics;
}
