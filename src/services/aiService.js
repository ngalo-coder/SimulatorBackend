import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const sessions = new Map();

export function createSession(sessionId, caseData) {
  sessions.set(sessionId, {
    caseData,
    history: [],
    sessionEnded: false,
    willEndAfterResponse: false
  });
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

function buildPrompt(caseData, conversationHistory, newQuestion, willEndAfterResponse) {
  const patient = caseData.patient_profile || {};
  
  // Build conversation history string
  const historyString = conversationHistory
    .map(entry => `${entry.role}: ${entry.content}`)
    .join('\n');
  
  // Add special instructions if this is the final response
  const endInstructions = willEndAfterResponse ? 
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
    5. Maintain a ${caseData.response_rules?.emotional_tone || 'concerned'} tone
    
    Background: ${patient.case_notes || 'No additional notes'}
    
    Conversation History:
    ${historyString}
    
    Clinician's latest question: "${newQuestion}"
    ${endInstructions}
    
    Your response as the patient (1-2 sentences):
  `;
}

export async function getPatientResponseStream(caseData, conversationHistory, newQuestion, sessionId, res) {
  const session = sessions.get(sessionId);
  const willEnd = session?.willEndAfterResponse || false;
  
  const prompt = buildPrompt(caseData, conversationHistory, newQuestion, willEnd);

  try {
    const stream = await openai.chat.completions.create({
      model: 'openai/gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
      max_tokens: 100,
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
      }
    }

    // Add patient response to history
    if (session) {
      session.history.push({ role: 'Patient', content: fullResponse });

      // End session if this was the final response
      if (session.willEndAfterResponse) {
        session.sessionEnded = true;
        console.log(`Session ${sessionId} ended after diagnosis`);
        
        // Send session end event
        res.write(`data: ${JSON.stringify({ 
          type: 'session_end', 
          content: "SESSION_END",
          summary: "The patient has been admitted for emergency care."
        })}\n\n`);
      }
    }
  } catch (error) {
    console.error("Error calling OpenRouter stream API:", error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: "An error occurred with the AI service." })}\n\n`);
  } finally {
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
}

// New function to get evaluation from the AI
export async function getEvaluation(caseData, conversationHistory) {
  const { clinical_dossier, evaluation_criteria } = caseData;
  const hiddenDiagnosis = clinical_dossier?.hidden_diagnosis;

  if (!hiddenDiagnosis || !evaluation_criteria) {
    console.error("Evaluation cannot be performed: Missing hidden diagnosis or evaluation criteria in case data.");
    return "Evaluation data is missing from the case file. Cannot generate evaluation.";
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
    1. History Taking: ${evaluation_criteria.History_Taking}
    2. Risk Factor Assessment: ${evaluation_criteria.Risk_Factor_Assessment}
    3. Differential Diagnosis Questioning: ${evaluation_criteria.Differential_Diagnosis_Questioning}
    4. Communication and Empathy: ${evaluation_criteria.Communication_and_Empathy}
    5. Clinical Urgency: ${evaluation_criteria.Clinical_Urgency}

    For each criterion, assess whether the clinician's actions were Good, Needs Improvement, or Needs Significant Improvement. Provide specific examples from the conversation to support your assessment.
    Conclude with an overall "Summary & Recommendations" section, highlighting key strengths and areas for development, and explicitly stating whether the likely diagnosis was reached or missed.

    Desired Output Format:
    SESSION END
    Thank you for completing the simulation. Here is an evaluation of your performance based on the case of [Patient Name from case data if available, otherwise use the hidden diagnosis name].
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
    [Your overall summary and recommendations]
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4o', // Or another powerful model suitable for evaluation
      messages: [{ role: 'system', content: evaluationPrompt }],
      temperature: 0.5, // Lower temperature for more deterministic evaluation
      max_tokens: 1500, // Allow for a detailed evaluation
    });
    return response.choices[0]?.message?.content || "Could not generate evaluation.";
  } catch (error) {
    console.error("Error calling OpenAI for evaluation:", error);
    return "An error occurred while generating the evaluation.";
  }
}