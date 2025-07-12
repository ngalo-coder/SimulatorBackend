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
    ? "\n\nIMPORTANT: The clinician has diagnosed you and is admitting you to the hospital. Express trust, relief, and bring the conversation to a natural close."
    : "";
  
  return `
    You are ${patient.name || 'the patient'}, a ${patient.age || 'unknown'}-year-old.
    Role Guidelines: Respond as the patient. Only reveal info when asked. Never self-diagnose. Maintain a ${caseData.response_rules?.emotional_tone || patient.emotional_tone || 'concerned'} tone.
    Background: ${patient.case_notes || patient.background_story || 'No additional notes'}
    Conversation History:
    ${historyString}
    Clinician's latest question: "${newQuestion}"
    ${endInstructions}
    Your response as the patient (1-2 sentences):
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

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
      }
    }
    log.info('Successfully streamed patient response.');

    if (fullResponse) {
      conversationHistory.push({ role: 'Patient', content: fullResponse, timestamp: new Date() });
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

  const ratingRegex = (criterion) => new RegExp(`${criterion}: \\(Rating: (Good|Needs Improvement|Needs Significant Improvement)\\)`);
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

  const labelRegex = /Performance Label:\s*(Excellent|Very Good|Good|Needs Improvement|Poor)/;
  match = evaluationText.match(labelRegex);
  if (match) metrics.performance_label = match[1];

  log.info({ parsedMetrics: metrics }, 'Parsed evaluation metrics from text.');
  return metrics;
}

export async function getEvaluation(caseData, conversationHistory, parentLog) {
  const log = parentLog.child({ service: 'aiService', function: 'getEvaluation' });
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

  const historyString = conversationHistory.map(entry => `${entry.role}: ${entry.content}`).join('\n');
  const evaluationPrompt = `
    You are an expert medical educator evaluating a clinician's performance with a simulated patient.
    Hidden Diagnosis: ${hiddenDiagnosis}.
    Conversation:
    --- START ---
    ${historyString}
    --- END ---

    Evaluate based on these criteria:
    1. History Taking: ${evaluation_criteria.History_Taking || evaluation_criteria.history_taking}
    2. Risk Factor Assessment: ${evaluation_criteria.Risk_Factor_Assessment || evaluation_criteria.risk_factor_assessment}
    3. Differential Diagnosis Questioning: ${evaluation_criteria.Differential_Diagnosis_Questioning || evaluation_criteria.differential_diagnosis_questioning}
    4. Communication and Empathy: ${evaluation_criteria.Communication_and_Empathy || evaluation_criteria.communication_empathy}
    5. Clinical Urgency: ${evaluation_criteria.Clinical_Urgency || evaluation_criteria.clinical_urgency}

    For each, rate as Good, Needs Improvement, or Needs Significant Improvement, with examples.
    Conclude with a "Summary & Recommendations", stating if the diagnosis was reached.
    Provide an "Overall Performance Score: [0-100]%" and a "Performance Label: [Excellent/Very Good/Good/Needs Improvement/Poor]" based on these thresholds: 90-100: Excellent, 80-89: Very Good, 70-79: Good, 60-69: Needs Improvement, <60: Poor.

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