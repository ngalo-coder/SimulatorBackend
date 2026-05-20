import mongoose from 'mongoose';
import { getPatientResponseStream, getEvaluation } from './aiService.js';
import { getNursingEvaluation } from './nursingEvaluationService.js';
import Case from '../models/CaseModel.js';
import Session from '../models/SessionModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import CaseService from './caseService.js';
import LaboratorySimulationService from './LaboratorySimulationService.js';
import RadiologySimulationService from './RadiologySimulationService.js';
import PharmacySimulationService from './PharmacySimulationService.js';
import { updateProgressAfterCase } from './clinicianProgressService.js';
import StudentProgressService from './StudentProgressService.js';

export const getCases = CaseService.getCases.bind(CaseService);

export async function startSimulation(caseId) {
    let caseDataFromDB = await Case.findOne({ 'case_metadata.case_id': caseId });

    if (!caseDataFromDB) {
        throw { status: 404, message: 'Case not found' };
    }

    const history = [];
    if (caseDataFromDB.initial_prompt) {
        history.push({ role: 'Patient', content: caseDataFromDB.initial_prompt, timestamp: new Date() });
    }

    const newSession = new Session({
        case_ref: caseDataFromDB._id,
        original_case_id: caseDataFromDB.case_metadata.case_id,
        history: history,
    });

    await newSession.save();
    
    // Extract patient information for the frontend
    const patientPersona = caseDataFromDB.patient_persona;
    const patientName = patientPersona?.name || 'Virtual Patient';
    // If speaks_for isn't explicitly set and we have a valid name, the patient speaks for themselves
    const speaksFor = patientPersona?.speaks_for || (patientName !== 'Virtual Patient' ? patientName : 'Self');
    
    return {
        sessionId: newSession._id.toString(),
        initialPrompt: caseDataFromDB.initial_prompt,
        patientName: patientName,
        speaks_for: speaksFor
    };
}

// Start a retake session for a previously attempted case
export async function startRetakeSession(caseId, previousSessionId, retakeReason, improvementFocusAreas, user) {
    let caseDataFromDB = await Case.findOne({ 'case_metadata.case_id': caseId });
    
    if (!caseDataFromDB) {
        throw { status: 404, message: 'Case not found' };
    }

    // Get previous session if provided
    let previousSession = null;
    let attemptNumber = 1;
    
    if (previousSessionId) {
        previousSession = await Session.findById(previousSessionId);
        if (!previousSession) {
            throw { status: 404, message: 'Previous session not found' };
        }
        
        // Get the highest attempt number for this case by this user
        const latestAttempt = await Session.findOne({
            user: user.id,
            case_ref: caseDataFromDB._id
        }).sort({ retake_attempt_number: -1 });
        
        attemptNumber = latestAttempt ? latestAttempt.retake_attempt_number + 1 : 2;
    } else {
        // Find the last session for this case by user to determine attempt number
        const lastSession = await Session.findOne({
            user: user.id,
            case_ref: caseDataFromDB._id
        }).sort({ createdAt: -1 });
        
        if (lastSession) {
            attemptNumber = lastSession.retake_attempt_number + 1;
        }
    }

    const history = [];
    if (caseDataFromDB.initial_prompt) {
        history.push({ role: 'Patient', content: caseDataFromDB.initial_prompt, timestamp: new Date() });
    }

    // Create new retake session
    const newSession = new Session({
        case_ref: caseDataFromDB._id,
        original_case_id: caseDataFromDB.case_metadata.case_id,
        user: user.id,
        history: history,
        is_retake: true,
        retake_attempt_number: attemptNumber,
        previous_session_ref: previousSessionId || null,
        retake_reason: retakeReason || 'self_improvement',
        improvement_focus_areas: improvementFocusAreas || []
    });

    await newSession.save();

    // Extract patient information for the frontend
    const patientPersona = caseDataFromDB.patient_persona;
    const patientName = patientPersona?.name || 'Virtual Patient';
    // If speaks_for isn't explicitly set and we have a valid name, the patient speaks for themselves
    // This ensures consistency between regular and retake sessions
    const speaksFor = patientPersona?.speaks_for || (patientName !== 'Virtual Patient' ? patientName : 'Self');

    return {
        sessionId: newSession._id.toString(),
        initialPrompt: caseDataFromDB.initial_prompt,
        patientName: patientName,
        speaks_for: speaksFor,
        isRetake: true,
        attemptNumber: attemptNumber
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
    session.history.push({
        role: 'Clinician',
        content: question,
        timestamp: new Date()
    });

    // Check if this is a laboratory case
    const isLaboratoryCase = caseData.case_metadata?.specialty?.toLowerCase() === 'laboratory';
    
    if (isLaboratoryCase) {
        // Parse the question as a laboratory action
        try {
            const action = JSON.parse(question);
            if (action.type && action.data) {
                const response = await LaboratorySimulationService.processLaboratoryAction(session, action);
                session.history.push({
                    role: 'System',
                    content: JSON.stringify(response),
                    timestamp: new Date()
                });
                await session.save();
                res.write(JSON.stringify(response));
                res.end();
                return;
            }
        } catch (error) {
            // If JSON parsing fails, treat as regular question
            console.log('Question is not a laboratory action, proceeding with regular handling');
        }
    }

    // Check if this is a radiology case
    const isRadiologyCase = caseData.case_metadata?.specialty?.toLowerCase() === 'radiology';
    
    if (isRadiologyCase) {
        // Parse the question as a radiology action
        try {
            const action = JSON.parse(question);
            if (action.type && action.data) {
                const response = await RadiologySimulationService.processRadiologyAction(session, action);
                session.history.push({
                    role: 'System',
                    content: JSON.stringify(response),
                    timestamp: new Date()
                });
                await session.save();
                res.write(JSON.stringify(response));
                res.end();
                return;
            }
        } catch (error) {
            // If JSON parsing fails, treat as regular question
            console.log('Question is not a radiology action, proceeding with regular handling');
        }
    }

    // Check if this is a pharmacy case
    const isPharmacyCase = caseData.case_metadata?.specialty?.toLowerCase() === 'pharmacy';
    
    if (isPharmacyCase) {
        // Parse the question as a pharmacy action
        try {
            const action = JSON.parse(question);
            if (action.type && action.data) {
                const response = await PharmacySimulationService.processPharmacyAction(session, action);
                session.history.push({
                    role: 'System',
                    content: JSON.stringify(response),
                    timestamp: new Date()
                });
                await session.save();
                res.write(JSON.stringify(response));
                res.end();
                return;
            }
        } catch (error) {
            // If JSON parsing fails, treat as regular question
            console.log('Question is not a pharmacy action, proceeding with regular handling');
        }
    }

    const willEndAfterResponse = CaseService.shouldEndSession(question);

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

export async function endSession(sessionId, user) {
    console.log(`endSession called with sessionId: ${sessionId}, user: ${JSON.stringify(user)}`);
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        console.error('Invalid session ID:', sessionId);
        throw { status: 400, message: 'Invalid session ID' };
    }

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();
    
    try {
        console.log('Transaction started, finding session...');
        const session = await Session.findById(sessionId).populate('case_ref').session(dbSession);
        if (!session) {
            console.error('Session not found for ID:', sessionId);
            throw { status: 404, message: 'Session not found' };
        }
        if (!session.case_ref) {
            console.error('Case data missing for session:', sessionId);
            throw { status: 500, message: 'Case data missing' };
        }
        
        if (session.sessionEnded && session.evaluation) {
            console.log('Session already ended, returning existing evaluation.');
            await dbSession.commitTransaction();
            dbSession.endSession();
            return { sessionEnded: true, evaluation: session.evaluation, history: session.history };
        }

        const caseData = session.case_ref.toObject();
        console.log('Case data loaded:', caseData.case_metadata?.case_id);
        
        let evaluationResult;
        try {
            console.log('Starting evaluation...');
            // Use nursing evaluation for nursing cases, standard evaluation for others
            if (caseData.nursing_diagnoses && caseData.nursing_diagnoses.length > 0) {
                evaluationResult = await getNursingEvaluation(caseData, session.history);
            } else {
                evaluationResult = await getEvaluation(caseData, session.history);
            }
            console.log('Evaluation completed successfully.');
        } catch (aiError) {
            console.error('AI evaluation failed, using fallback evaluation:', aiError);
            evaluationResult = generateFallbackEvaluation(caseData, session.history);
        }
        
        const { evaluationText, extractedMetrics } = evaluationResult;
        console.log('Evaluation result extracted.');

        const performanceRecord = new PerformanceMetrics({
            session_ref: session._id,
            case_ref: session.case_ref._id,
            user_ref: user?.id || user?._id,
            metrics: extractedMetrics,
            evaluation_summary: extractedMetrics.evaluation_summary,
            raw_evaluation_text: evaluationText,
        });
        console.log('Performance record created.');

        session.evaluation = evaluationText;
        session.sessionEnded = true;

        await Promise.all([
            session.save({ session: dbSession }),
            performanceRecord.save({ session: dbSession })
        ]);
        console.log('Session and performance record saved.');

        // Update progress within the same transaction
        const userId = user?.id || user?._id;
        if (userId) {
            console.log('Updating clinician progress...');
            await updateProgressAfterCase(userId, session.case_ref._id, performanceRecord._id, dbSession);
            console.log('Clinician progress updated.');

            // Also update student progress within the same transaction
            console.log('Updating student progress...');
            const caseDetails = await Case.findById(session.case_ref._id).session(dbSession);
            const attemptData = {
                caseId: session.case_ref._id,
                caseTitle: caseDetails?.case_metadata?.title || 'Unknown Case',
                attemptNumber: session.retake_attempt_number || 1,
                startTime: session.createdAt,
                endTime: new Date(),
                duration: Math.floor((new Date() - session.createdAt) / 1000), // in seconds
                score: performanceRecord.metrics.overall_score || 0,
                status: 'completed',
                detailedMetrics: performanceRecord.metrics,
                feedback: performanceRecord.evaluation_summary,
                sessionId: session._id
            };
            await StudentProgressService.recordCaseAttempt(userId, attemptData, dbSession);
            console.log('Student progress updated.');
        }

        await dbSession.commitTransaction();
        dbSession.endSession(); // End session immediately after commit
        console.log('Transaction committed and session ended.');

        return {
            sessionEnded: true,
            evaluation: evaluationText,
            history: session.history
        };
    } catch (error) {
        console.error('Error in endSession:', error);
        await dbSession.abortTransaction();
        dbSession.endSession(); // End session on error too
        throw error;
    }
}

function generateFallbackEvaluation(caseData, history) {
    const evaluationText = `Session completed. AI evaluation service is currently unavailable. Please check your API keys or try again later. For now, your progress has been saved, and you can review the conversation history.`;
    const extractedMetrics = {
        history_taking_rating: 'Fair',
        risk_factor_assessment_rating: 'Fair',
        differential_diagnosis_questioning_rating: 'Fair',
        communication_and_empathy_rating: 'Fair',
        clinical_urgency_rating: 'Fair',
        overall_diagnosis_accuracy: 'Undetermined',
        evaluation_summary: 'AI service unavailable - using fallback evaluation',
        overall_score: null,
        performance_label: 'Fair',
    };
    return { evaluationText, extractedMetrics };
}

export const getCaseCategories = CaseService.getCaseCategories.bind(CaseService);

export async function getPerformanceMetricsBySession(sessionId) {
    const metrics = await PerformanceMetrics.findOne({ session_ref: sessionId })
        .populate('case_ref', 'case_metadata.case_id case_metadata.title');
    if (!metrics) {
        throw { status: 404, message: 'Performance metrics not found for this session.' };
    }
    return metrics;
}

// Get retake sessions for a specific case and user
export async function getCaseRetakeSessions(caseId, userId) {
    const caseDoc = await Case.findOne({ 'case_metadata.case_id': caseId });
    if (!caseDoc) {
        throw { status: 404, message: 'Case not found' };
    }

    const retakeSessions = await Session.find({
        user: userId,
        case_ref: caseDoc._id,
        is_retake: true
    })
    .populate('case_ref', 'case_metadata.title case_metadata.specialty')
    .populate('evaluation_ref', 'metrics.overall_score metrics.performance_label evaluated_at')
    .sort({ retake_attempt_number: 1 });

    return retakeSessions;
}

// Calculate improvement metrics between two sessions
export async function calculateImprovementMetrics(currentSessionId, previousSessionId) {
    const currentSession = await Session.findById(currentSessionId).populate('evaluation_ref');
    const previousSession = await Session.findById(previousSessionId).populate('evaluation_ref');
    
    if (!currentSession || !previousSession) {
        throw { status: 404, message: 'Session not found' };
    }

    if (!currentSession.evaluation_ref || !previousSession.evaluation_ref) {
        throw { status: 400, message: 'Sessions must have evaluations to compare' };
    }

    const improvementMetrics = {
        improvement_score: 0,
        areas_improved: [],
        areas_needing_work: []
    };

    // Calculate overall improvement score
    const previousScore = previousSession.evaluation_ref.metrics.overall_score || 0;
    const currentScore = currentSession.evaluation_ref.metrics.overall_score || 0;
    improvementMetrics.improvement_score = currentScore - previousScore;

    // Compare individual metrics
    const metricsToCompare = [
        'history_taking_rating',
        'risk_factor_assessment_rating',
        'differential_diagnosis_questioning_rating',
        'communication_and_empathy_rating',
        'clinical_urgency_rating'
    ];

    for (const metric of metricsToCompare) {
        const prevMetric = previousSession.evaluation_ref.metrics[metric];
        const currMetric = currentSession.evaluation_ref.metrics[metric];

        if (prevMetric && currMetric) {
            // Convert ratings to numerical scores for comparison
            const ratingScores = {
                'Excellent': 5,
                'Very Good': 4,
                'Good': 3,
                'Fair': 2,
                'Poor': 1,
                'Not Assessed': 0
            };

            const prevScore = ratingScores[prevMetric] || 0;
            const currScore = ratingScores[currMetric] || 0;

            if (currScore > prevScore) {
                improvementMetrics.areas_improved.push({
                    metric,
                    previous_score: prevScore,
                    current_score: currScore,
                    improvement: currScore - prevScore
                });
            } else if (currScore < prevScore) {
                improvementMetrics.areas_needing_work.push({
                    metric,
                    score: currScore,
                    recommendation: `Focus on improving ${metric.replace(/_/g, ' ')}`
                });
            }
        }
    }

    // Update the current session with improvement metrics
    currentSession.improvement_score = improvementMetrics.improvement_score;
    currentSession.areas_improved = improvementMetrics.areas_improved;
    currentSession.areas_needing_work = improvementMetrics.areas_needing_work;
    await currentSession.save();

    return improvementMetrics;
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
