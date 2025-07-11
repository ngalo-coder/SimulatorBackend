import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// const sessions = new Map(); // REMOVED - No longer using in-memory sessions here
// export function createSession(sessionId, caseData) { ... } // REMOVED
// export function getSession(sessionId) { ... } // REMOVED

// `willEndCurrentResponse` parameter added, was `willEndAfterResponse` from internal session
function buildPrompt(caseData, conversationHistory, newQuestion, willEndCurrentResponse) {
  const patient = caseData.patient_profile || caseData.patient_persona || {}; // Accommodate both patient_profile and patient_persona
  
  // Build conversation history string
  const historyString = conversationHistory
    .map(entry => `${entry.role}: ${entry.content}`)
    .join('\n');
  
  // Add special instructions if this is the final response
  const endInstructions = willEndCurrentResponse ? // Changed variable name
    "\n\nIMPORTANT: The clinician has diagnosed you and is admitting you to the hospital. " +
    "Express trust in the clinician, show relief that help is coming, and bring the conversation " +
    "to a natural close with a final statement." : "";
  
  // System instruction for the patient role
  return `
    You are ${patient.name || 'the patient'}, a ${patient.age || 'unknown'}-year-old patient 
    experiencing ${patient.chief_complaint || 'symptoms'}. You are talking to a clinician.
    
    Role Guidelines:
    1. You are the PATIENT, not the doctor
    2. Only reveal information when asked directly
    3. Never diagnose yourself or suggest treatments
    4. Respond naturally as a patient would
    5. Maintain a ${caseData.response_rules?.emotional_tone || patient.emotional_tone || 'concerned'} tone
    
    Background: ${patient.case_notes || patient.background_story || 'No additional notes'}
    
    Conversation History:
    ${historyString}
    
    Clinician's latest question: "${newQuestion}"
    ${endInstructions}
    
    Your response as the patient (1-2 sentences):
  `;
}

// `sessionId` is kept for logging but not for fetching session state from this service.
// `willEndCurrentResponse` (previously willEnd from internal session) is now passed directly.
export async function getPatientResponseStream(
  caseData,
  conversationHistory, // This is the Mongoose session.history array
  newQuestion,
  sessionId, // Retained for logging context primarily
  res,
  willEndCurrentResponse // Flag from controller
) {
  // const session = sessions.get(sessionId); // REMOVED: No internal session map
  // const willEnd = session?.willEndAfterResponse || false; // Now uses willEndCurrentResponse parameter

  const prompt = buildPrompt(caseData, conversationHistory, newQuestion, willEndCurrentResponse);

  let fullResponse = '';
  let sessionShouldBeMarkedEnded = false;

  try {
    const stream = await openai.chat.completions.create({
      model: 'openai/gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
      max_tokens: 100,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
      }
    }

    // Add patient response to the passed conversationHistory array (Mongoose session.history)
    // The controller (handleAsk) will be responsible for saving the session document.
    if (fullResponse) {
      conversationHistory.push({ role: 'Patient', content: fullResponse, timestamp: new Date() });
    }

    // If this response cycle is meant to end the session, set the flag.
    // The controller will use this to update the session document in DB.
    if (willEndCurrentResponse) {
      sessionShouldBeMarkedEnded = true;
      console.log(`AI service signaling session ${sessionId} should end after this response.`);

      // Send session end event to client (this is a client-side signal)
      res.write(`data: ${JSON.stringify({
        type: 'session_end',
        content: "SESSION_END", // Standardized content for client to recognize
        summary: "The patient interaction is concluding based on diagnosis/admission." // More generic summary
      })}\n\n`);
    }
  } catch (error) {
    console.error(`Error calling OpenRouter stream API for session ${sessionId}:`, error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: "An error occurred with the AI service." })}\n\n`);
  } finally {
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
  // Return necessary info for the controller to update the DB session
  return { fullResponse, sessionShouldBeMarkedEnded };
}

// Helper function to parse metrics from evaluation text
function parseEvaluationMetrics(evaluationText) {
  const metrics = {
    history_taking_rating: "Not Available",
    risk_factor_assessment_rating: "Not Available",
    differential_diagnosis_questioning_rating: "Not Available",
    communication_and_empathy_rating: "Not Available",
    clinical_urgency_rating: "Not Available",
    overall_diagnosis_accuracy: "Not Available",
    evaluation_summary: "Not Available"
  };

  if (!evaluationText || typeof evaluationText !== 'string') {
    return metrics;
  }

  const ratingRegex = (criterion) => new RegExp(`${criterion}: \\(Rating: (Good|Needs Improvement|Needs Significant Improvement)\\)`);

  let match;

  match = evaluationText.match(ratingRegex("History Taking"));
  if (match && match[1]) metrics.history_taking_rating = match[1];

  match = evaluationText.match(ratingRegex("Risk Factor Assessment"));
  if (match && match[1]) metrics.risk_factor_assessment_rating = match[1];

  match = evaluationText.match(ratingRegex("Differential Diagnosis Questioning"));
  if (match && match[1]) metrics.differential_diagnosis_questioning_rating = match[1];

  match = evaluationText.match(ratingRegex("Communication and Empathy"));
  if (match && match[1]) metrics.communication_and_empathy_rating = match[1];

  match = evaluationText.match(ratingRegex("Clinical Urgency"));
  if (match && match[1]) metrics.clinical_urgency_rating = match[1];

  // Extract summary and diagnosis accuracy from "Summary & Recommendations"
  const summaryRegex = /Summary & Recommendations:\s*([\s\S]*)/;
  match = evaluationText.match(summaryRegex);
  if (match && match[1]) {
    const summaryContent = match[1].trim();
    metrics.evaluation_summary = summaryContent; // Store the full summary for now

    // Infer diagnosis accuracy
    if (summaryContent.toLowerCase().includes("diagnosis was reached") || summaryContent.toLowerCase().includes("correctly identified")) {
      metrics.overall_diagnosis_accuracy = "Reached";
    } else if (summaryContent.toLowerCase().includes("diagnosis was missed") || summaryContent.toLowerCase().includes("failed to identify")) {
      metrics.overall_diagnosis_accuracy = "Missed";
    } else if (summaryContent.toLowerCase().includes("partially reached") || summaryContent.toLowerCase().includes("partially identified")) {
      metrics.overall_diagnosis_accuracy = "Partially Reached";
    } else {
      // Fallback if no clear statement, could be improved with more keywords
      metrics.overall_diagnosis_accuracy = "Undetermined";
    }
  }

  return metrics;
}

// New function to get evaluation from the AI
export async function getEvaluation(caseData, conversationHistory) {
  const { clinical_dossier, evaluation_criteria, patient_persona } = caseData; // Added patient_persona
  const hiddenDiagnosis = clinical_dossier?.hidden_diagnosis;
  const patientName = patient_persona?.name || "the patient"; // Get patient name for prompt

  if (!hiddenDiagnosis || !evaluation_criteria) {
    console.error("Evaluation cannot be performed: Missing hidden diagnosis or evaluation criteria in case data.");
    // Return structure consistent with successful operation but indicating failure
    return {
      evaluationText: "Evaluation data is missing from the case file. Cannot generate evaluation.",
      extractedMetrics: parseEvaluationMetrics(null) // Returns default "Not Available" metrics
    };
  }

  const historyString = conversationHistory
    .map(entry => `${entry.role}: ${entry.content}`)
    .join('\n');

  // Construct the prompt for the evaluation AI
  const evaluationPrompt = `
    You are an expert medical educator. Your task is to evaluate a clinician's performance in a simulated patient encounter.
    The simulated case involved a patient with the hidden diagnosis of: ${hiddenDiagnosis}.

    The clinician's conversation with the patient was as follows:
    --- START OF CONVERSATION ---
    ${historyString}
    --- END OF CONVERSATION ---

    Please evaluate the clinician's performance based on the following criteria. Provide a detailed, constructive assessment for each point, formatted exactly as the example below.

    Evaluation Criteria:
    1. History Taking: ${evaluation_criteria.History_Taking || evaluation_criteria.history_taking || 'Assess thoroughness and relevance of questions asked to understand the patient\'s current condition and medical history.'}
    2. Risk Factor Assessment: ${evaluation_criteria.Risk_Factor_Assessment || evaluation_criteria.risk_factor_assessment || 'Assess identification and exploration of relevant risk factors for the potential diagnoses.'}
    3. Differential Diagnosis Questioning: ${evaluation_criteria.Differential_Diagnosis_Questioning || evaluation_criteria.differential_diagnosis_questioning || 'Assess the formulation of appropriate differential diagnoses and systematic questioning to narrow them down.'}
    4. Communication and Empathy: ${evaluation_criteria.Communication_and_Empathy || evaluation_criteria.communication_empathy || 'Assess clarity of communication, active listening, and empathetic engagement with the patient.'}
    5. Clinical Urgency: ${evaluation_criteria.Clinical_Urgency || evaluation_criteria.clinical_urgency || 'Assess recognition of and appropriate response to the severity and urgency of the patient\'s condition.'}

    For each criterion, assess whether the clinician's actions were Good, Needs Improvement, or Needs Significant Improvement. Provide specific examples from the conversation to support your assessment.
    Conclude with an overall "Summary & Recommendations" section, highlighting key strengths and areas for development, and explicitly stating whether the likely diagnosis of "${hiddenDiagnosis}" was reached or missed.

    Desired Output Format:
    SESSION END
    Thank you for completing the simulation. Here is an evaluation of your performance based on the case of ${patientName}.
    Hidden Diagnosis: ${hiddenDiagnosis}
    Evaluation of Your Performance:
    1. History Taking: (Rating: [Good/Needs Improvement/Needs Significant Improvement])
    [Your detailed assessment for History Taking, referencing conversation specifics]
    2. Risk Factor Assessment: (Rating: [Good/Needs Improvement/Needs Significant Improvement])
    [Your detailed assessment for Risk Factor Assessment, referencing conversation specifics]
    3. Differential Diagnosis Questioning: (Rating: [Good/Needs Improvement/Needs Significant Improvement])
    [Your detailed assessment for Differential Diagnosis Questioning, referencing conversation specifics]
    4. Communication and Empathy: (Rating: [Good/Needs Improvement/Needs Significant Improvement])
    [Your detailed assessment for Communication and Empathy, referencing conversation specifics]
    5. Clinical Urgency: (Rating: [Good/Needs Improvement/Needs Significant Improvement])
    [Your detailed assessment for Clinical Urgency, referencing conversation specifics]
    Summary & Recommendations:
    [Your overall summary and recommendations, explicitly stating if the diagnosis of "${hiddenDiagnosis}" was reached or missed.]
  `;
  // Note: Updated prompt to use patient_persona.name and ensure evaluation_criteria keys are flexible (e.g. History_Taking or history_taking)
  // Also explicitly asked to state if the hidden diagnosis was reached or missed in the summary.

  try {
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4o', // Or another powerful model suitable for evaluation
      messages: [{ role: 'system', content: evaluationPrompt }],
      temperature: 0.5, // Lower temperature for more deterministic evaluation
      max_tokens: 1500, // Allow for a detailed evaluation
    });

    const evaluationText = response.choices[0]?.message?.content || "Could not generate evaluation.";
    const extractedMetrics = parseEvaluationMetrics(evaluationText);

    return { evaluationText, extractedMetrics };

  } catch (error) {
    console.error("Error calling OpenAI for evaluation:", error);
    return {
      evaluationText: "An error occurred while generating the evaluation.",
      extractedMetrics: parseEvaluationMetrics(null) // Default metrics on error
    };
  }
}