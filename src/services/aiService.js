import OpenAI from 'openai';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

function buildPrompt(caseData, conversationHistory, newQuestion, willEndCurrentResponse) {
  const patient = caseData.patient_profile || caseData.patient_persona || {};
  const historyString = conversationHistory.map(entry => `${entry.role}: ${entry.content}`).join('\n');
  const endInstructions = willEndCurrentResponse
    ? "\n\nIMPORTANT: The clinician has diagnosed the patient and is admitting them to the hospital. Express trust, relief, and bring the conversation to a natural close."
    : "";

  let personaDescription = `You are ${patient.name || 'the patient'}, a ${patient.age || 'unknown'}-year-old.`;
  if (patient.speaks_for) {
    personaDescription = `You are the ${patient.speaks_for} of ${patient.name}, a ${patient.age || 'unknown'}-year-old. You are speaking on their behalf.`;
    if (patient.patient_is_present) {
      personaDescription += ` The patient is in the room with you. You can ask them simple questions if appropriate, but you should answer most questions yourself.`;
    }
  }

  return `
    ${personaDescription}
    Role Guidelines: Respond from your assigned persona. Only reveal info when asked. Never self-diagnose. Maintain a ${caseData.response_rules?.emotional_tone || patient.emotional_tone || 'concerned'} tone.
    Background: ${patient.case_notes || patient.background_story || 'No additional notes'}
    Conversation History:
    ${historyString}
    Clinician's latest question: "${newQuestion}"
    ${endInstructions}
    Your response (1-2 sentences):
  `;
}

export async function getPatientResponseStream(caseData, conversationHistory, newQuestion, sessionId, res, willEndCurrentResponse) {
  const log = logger.child({ service: 'aiService', function: 'getPatientResponseStream', sessionId });
  const prompt = buildPrompt(caseData, conversationHistory, newQuestion, willEndCurrentResponse);
  let fullResponse = '';
  let sessionShouldBeMarkedEnded = false;

  try {
    log.info('Requesting patient response stream from AI.');
    const stream = await openai.chat.completions.create({
      model: 'openai/gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
      max_tokens: 100,
      stream: true,
    });

    const patient = caseData.patient_profile || caseData.patient_persona || {};
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        const chunkData = { type: 'chunk', content, role: 'Patient', name: patient.name };
        
        // Include speaks_for information if present
        if (patient.speaks_for) {
          chunkData.speaks_for = patient.speaks_for;
        }
        
        res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
      }
    }
    log.info('Successfully streamed patient response.');

    if (fullResponse) {
      const patient = caseData.patient_profile || caseData.patient_persona || {};
      const historyEntry = { 
        role: 'Patient', 
        name: patient.name,
        content: fullResponse, 
        timestamp: new Date() 
      };
      
      // Add speaks_for information if present
      if (patient.speaks_for) {
        historyEntry.speaks_for = patient.speaks_for;
      }
      
      conversationHistory.push(historyEntry);
    }

    if (willEndCurrentResponse) {
      sessionShouldBeMarkedEnded = true;
      log.info('Signaling session should end after this response.');
      res.write(`data: ${JSON.stringify({ type: 'session_end', content: "SESSION_END" })}\n\n`);
    }
  } catch (error) {
    log.error(error, 'Error calling OpenRouter stream API.');
    res.write(`data: ${JSON.stringify({ type: 'error', content: "An error occurred with the AI service." })}\n\n`);
  } finally {
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
  return { fullResponse, sessionShouldBeMarkedEnded };
}

function parseEvaluationMetrics(evaluationText, log) {
  const metrics = {
    history_taking_rating: "Not Available",
    risk_factor_assessment_rating: "Not Available",
    differential_diagnosis_questioning_rating: "Not Available",
    communication_and_empathy_rating: "Not Available",
    clinical_urgency_rating: "Not Available",
    overall_diagnosis_accuracy: "Not Available",
    evaluation_summary: "Not Available",
    overall_score: null,
    performance_label: "Not Available"
  };

  if (!evaluationText || typeof evaluationText !== 'string') {
    log.warn('Evaluation text is null or not a string, returning default metrics.');
    return metrics;
  }

  const ratingRegex = (criterion) => new RegExp(`${criterion}: \\(Rating: (Excellent|Very good|Good|Fair|Poor)\\)`);
  let match;

  match = evaluationText.match(ratingRegex("History Taking"));
  if (match) metrics.history_taking_rating = match[1];

  match = evaluationText.match(ratingRegex("Risk Factor Assessment"));
  if (match) metrics.risk_factor_assessment_rating = match[1];

  match = evaluationText.match(ratingRegex("Differential Diagnosis Questioning"));
  if (match) metrics.differential_diagnosis_questioning_rating = match[1];

  match = evaluationText.match(ratingRegex("Communication and Empathy"));
  if (match) metrics.communication_and_empathy_rating = match[1];

  match = evaluationText.match(ratingRegex("Clinical Urgency"));
  if (match) metrics.clinical_urgency_rating = match[1];

  const summaryRegex = /Summary & Recommendations:\s*([\s\S]*?)(?=Overall Performance Score:|$)/;
  match = evaluationText.match(summaryRegex);
  if (match) {
    const summaryContent = match[1].trim();
    metrics.evaluation_summary = summaryContent;
    if (summaryContent.toLowerCase().includes("diagnosis was reached") || summaryContent.toLowerCase().includes("correctly identified")) {
      metrics.overall_diagnosis_accuracy = "Reached";
    } else if (summaryContent.toLowerCase().includes("diagnosis was missed") || summaryContent.toLowerCase().includes("failed to identify")) {
      metrics.overall_diagnosis_accuracy = "Missed";
    } else if (summaryContent.toLowerCase().includes("partially reached") || summaryContent.toLowerCase().includes("partially identified")) {
      metrics.overall_diagnosis_accuracy = "Partially Reached";
    } else {
      metrics.overall_diagnosis_accuracy = "Undetermined";
    }
  }

  const scoreRegex = /Overall Performance Score:\s*(\d{1,3})\s*%/;
  match = evaluationText.match(scoreRegex);
  if (match) metrics.overall_score = parseInt(match[1], 10);

  const labelRegex = /Performance Label:\s*(Excellent|Very good|Good|Fair|Poor)/;
  match = evaluationText.match(labelRegex);
  if (match) metrics.performance_label = match[1];

  log.info({ parsedMetrics: metrics }, 'Parsed evaluation metrics from text.');
  return metrics;
}

export async function getEvaluation(caseData, conversationHistory, parentLog) {
  // Use the provided parentLog or create a new logger instance
  const log = parentLog ? 
    parentLog.child({ service: 'aiService', function: 'getEvaluation' }) : 
    logger.child({ service: 'aiService', function: 'getEvaluation' });
  const { clinical_dossier, evaluation_criteria, patient_persona } = caseData;
  const hiddenDiagnosis = clinical_dossier?.hidden_diagnosis;
  const patientName = patient_persona?.name || "the patient";

  if (!hiddenDiagnosis || !evaluation_criteria) {
    log.error("Evaluation cannot be performed: Missing hidden diagnosis or evaluation criteria.");
    return {
      evaluationText: "Evaluation data is missing from the case file.",
      extractedMetrics: parseEvaluationMetrics(null, log)
    };
  }

  // Check if evaluation_criteria is a Map, if not convert it to one
  const criteriaMap = evaluation_criteria instanceof Map ?
    evaluation_criteria :
    new Map(Object.entries(evaluation_criteria));
  
  log.info(`Evaluation criteria type: ${evaluation_criteria instanceof Map ? 'Map' : typeof evaluation_criteria}`);

  const historyString = conversationHistory.map(entry => `${entry.role}: ${entry.content}`).join('\n');
  const evaluationPrompt = `
    You are an expert medical educator evaluating a clinician's performance with a simulated patient.
    Hidden Diagnosis: ${hiddenDiagnosis}.
    Conversation:
    --- START ---
    ${historyString}
    --- END ---

    Evaluate based on these criteria:
    1. History Taking: ${criteriaMap.get('History_Taking') || criteriaMap.get('history_taking') || 'Did the clinician take a complete history?'}
    2. Risk Factor Assessment: ${criteriaMap.get('Risk_Factor_Assessment') || criteriaMap.get('risk_factor_assessment') || 'Did the clinician assess risk factors?'}
    3. Differential Diagnosis Questioning: ${criteriaMap.get('Differential_Diagnosis_Questioning') || criteriaMap.get('differential_diagnosis_questioning') || 'Did the clinician explore differential diagnoses?'}
    4. Communication and Empathy: ${criteriaMap.get('Communication_and_Empathy') || criteriaMap.get('communication_empathy') || 'How was the clinician\'s communication and empathy?'}
    5. Clinical Urgency: ${criteriaMap.get('Clinical_Urgency') || criteriaMap.get('clinical_urgency') || 'Did the clinician recognize the urgency of the case?'}

    For each, rate as Excellent, Very Good, Good, Fair, or Poor, with examples.
    Conclude with a "Summary & Recommendations", stating if the diagnosis was reached.
    Provide an "Overall Performance Score: [0-100]%" and a "Performance Label: [Excellent/Very good/Good/Fair/Poor]" based on these thresholds: 85-100: Excellent, 75-84: Very good, 65-74: Good, 50-64: Fair, <50: Poor.

    Format exactly as follows:
    SESSION END
    Thank you for completing the simulation. Here is an evaluation of your performance based on the case of ${patientName}.
    Hidden Diagnosis: ${hiddenDiagnosis}
    Evaluation of Your Performance:
    1. History Taking: (Rating: [Rating])
    [Assessment]
    2. Risk Factor Assessment: (Rating: [Rating])
    [Assessment]
    3. Differential Diagnosis Questioning: (Rating: [Rating])
    [Assessment]
    4. Communication and Empathy: (Rating: [Rating])
    [Assessment]
    5. Clinical Urgency: (Rating: [Rating])
    [Assessment]
    Summary & Recommendations:
    [Summary]
    Overall Performance Score: [Score]%
    Performance Label: [Label]
  `;

  try {
    log.info('Requesting evaluation from AI.');
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4o',
      messages: [{ role: 'system', content: evaluationPrompt }],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const evaluationText = response.choices[0]?.message?.content || "Could not generate evaluation.";
    log.info('Successfully received evaluation from AI.');
    const extractedMetrics = parseEvaluationMetrics(evaluationText, log);

    return { evaluationText, extractedMetrics };

  } catch (error) {
    log.error(error, "Error calling OpenAI for evaluation.");
    return {
      evaluationText: "An error occurred while generating the evaluation.",
      extractedMetrics: parseEvaluationMetrics(null, log)
    };
  }
}