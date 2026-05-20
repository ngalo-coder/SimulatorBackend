import OpenAI from 'openai';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

dotenv.config();

// Initialize OpenAI client with OpenRouter configuration
const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error(
    '❌ No API key found. Please set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.'
  );
  throw new Error('Missing API key for AI service');
}

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
});

function buildPrompt(caseData, conversationHistory, newQuestion, willEndCurrentResponse) {
  const patient = caseData.patient_profile || caseData.patient_persona || {};
  const clinical_dossier = caseData.clinical_dossier || {};
  const historyString = conversationHistory
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join('\n');
  const endInstructions = willEndCurrentResponse
    ? '\n\nIMPORTANT: The clinician has diagnosed the patient and is admitting them to the hospital. Express trust, relief, and bring the conversation to a natural close.'
    : '';

  // Build comprehensive medical history section
  let medicalHistory = `Chief Complaint: ${patient.chief_complaint || 'Not specified'}\n\n`;

  // History of Presenting Illness
  if (clinical_dossier.history_of_presenting_illness) {
    const hpi = clinical_dossier.history_of_presenting_illness;
    medicalHistory += `History of Presenting Illness:\n`;
    if (hpi.onset) medicalHistory += `- Onset: ${hpi.onset}\n`;
    if (hpi.location) medicalHistory += `- Location: ${hpi.location}\n`;
    if (hpi.radiation) medicalHistory += `- Radiation: ${hpi.radiation}\n`;
    if (hpi.character) medicalHistory += `- Character: ${hpi.character}\n`;
    if (hpi.severity) medicalHistory += `- Severity: ${hpi.severity}/10\n`;
    if (hpi.timing_and_duration) medicalHistory += `- Timing/Duration: ${hpi.timing_and_duration}\n`;
    if (hpi.exacerbating_factors) medicalHistory += `- Exacerbating Factors: ${hpi.exacerbating_factors}\n`;
    if (hpi.relieving_factors) medicalHistory += `- Relieving Factors: ${hpi.relieving_factors}\n`;
    if (hpi.associated_symptoms && hpi.associated_symptoms.length > 0) {
      medicalHistory += `- Associated Symptoms: ${hpi.associated_symptoms.join(', ')}\n`;
    }
    medicalHistory += '\n';
  }

  // Past Medical History
  if (clinical_dossier.past_medical_history && clinical_dossier.past_medical_history.length > 0) {
    medicalHistory += `Past Medical History: ${clinical_dossier.past_medical_history.join(', ')}\n`;
  }

  // Medications
  if (clinical_dossier.medications && clinical_dossier.medications.length > 0) {
    medicalHistory += `Current Medications: ${clinical_dossier.medications.join(', ')}\n`;
  }

  // Allergies
  if (clinical_dossier.allergies && clinical_dossier.allergies.length > 0) {
    medicalHistory += `Allergies: ${clinical_dossier.allergies.join(', ')}\n`;
  }

  // Surgical History
  if (clinical_dossier.surgical_history && clinical_dossier.surgical_history.length > 0) {
    medicalHistory += `Surgical History: ${clinical_dossier.surgical_history.join(', ')}\n`;
  }

  // Family History
  if (clinical_dossier.family_history && clinical_dossier.family_history.length > 0) {
    medicalHistory += `Family History: ${clinical_dossier.family_history.join(', ')}\n`;
  }

  // Social History
  if (clinical_dossier.social_history) {
    const social = clinical_dossier.social_history;
    medicalHistory += `Social History:\n`;
    if (social.smoking_status) medicalHistory += `- Smoking: ${social.smoking_status}\n`;
    if (social.alcohol_use) medicalHistory += `- Alcohol: ${social.alcohol_use}\n`;
    if (social.substance_use) medicalHistory += `- Substance Use: ${social.substance_use}\n`;
    if (social.diet_and_exercise) medicalHistory += `- Diet/Exercise: ${social.diet_and_exercise}\n`;
    if (social.living_situation) medicalHistory += `- Living Situation: ${social.living_situation}\n`;
  }

  // Review of Systems
  if (clinical_dossier.review_of_systems) {
    const ros = clinical_dossier.review_of_systems;
    medicalHistory += `Review of Systems:\n`;
    if (ros.comment) medicalHistory += `- General: ${ros.comment}\n`;
    if (ros.positive && ros.positive.length > 0) {
      medicalHistory += `- Positive: ${ros.positive.join(', ')}\n`;
    }
    if (ros.negative && ros.negative.length > 0) {
      medicalHistory += `- Negative: ${ros.negative.join(', ')}\n`;
    }
  }

  let personaDescription = `You are ${patient.name || 'the patient'}, a ${
    patient.age || 'unknown'
  }-year-old.`;
  if (patient.speaks_for) {
    personaDescription = `You are the ${patient.speaks_for} of ${patient.name}, a ${
      patient.age || 'unknown'
    }-year-old. You are speaking on their behalf.`;
    if (patient.patient_is_present) {
      personaDescription += ` The patient is in the room with you. You can ask them simple questions if appropriate, but you should answer most questions yourself.`;
    }
  }

  return `
    ${personaDescription}
    Role Guidelines: Respond from your assigned persona. Only reveal info when asked. Never self-diagnose. Maintain a ${
      caseData.response_rules?.emotional_tone || patient.emotional_tone || 'concerned'
    } tone.
    Background: ${patient.case_notes || patient.background_story || 'No additional notes'}
    
    COMPLETE MEDICAL HISTORY:
    ${medicalHistory}

    Conversation History:
    ${historyString}
    Clinician's latest question: "${newQuestion}"
    ${endInstructions}
    
    RESPONSE GUIDELINES:
    1. Respond naturally and authentically as the patient would
    2. Only reveal information when asked by the clinician
    3. Never self-diagnose or suggest treatments
    4. Maintain a ${patient.emotional_tone || 'concerned'} emotional tone throughout
    5. Refer to your medical history when answering questions about symptoms or history
    6. If unsure about something, say "I'm not sure" or "I don't remember"
    7. Keep responses concise (1-2 sentences typically)

    Your response:
  `;
}

export async function getPatientResponseStream(
  caseData,
  conversationHistory,
  newQuestion,
  sessionId,
  res,
  willEndCurrentResponse
) {
    // Debug logging
    console.log('🔄 Starting patient response stream:', {
        sessionId,
        question: newQuestion,
        hasConversationHistory: Array.isArray(conversationHistory) && conversationHistory.length > 0,
        caseDataKeys: Object.keys(caseData || {}),
        willEndCurrentResponse
    });
  const log = logger.child({
    service: 'aiService',
    function: 'getPatientResponseStream',
    sessionId,
  });

  // Debug: Log caseData structure
  console.log('🔍 CaseData structure:', {
    hasPatientPersona: !!caseData.patient_persona,
    hasPatientProfile: !!caseData.patient_profile,
    patientPersonaName: caseData.patient_persona?.name,
    patientProfileName: caseData.patient_profile?.name,
  });

  const prompt = buildPrompt(caseData, conversationHistory, newQuestion, willEndCurrentResponse);
  let fullResponse = '';
  let sessionShouldBeMarkedEnded = false;

  try {
    log.info('Requesting patient response stream from AI.');
    const stream = await openai.chat.completions.create({
      model: 'meta-llama/llama-3-8b-instruct',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
      stream: true,
    });

    const patient = caseData.patient_profile || caseData.patient_persona || {};

    // Debug: Log patient data to see what's available
    console.log('🔍 Patient data in streaming:', {
      name: patient.name,
      speaks_for: patient.speaks_for,
      age: patient.age,
      keys: Object.keys(patient),
    });

    console.log('🔄 Starting to process streaming chunks...');
    let chunkCount = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        chunkCount++;
        fullResponse += content;

        console.log(`📦 Processing chunk ${chunkCount}: "${content}"`);

        const chunkData = {
          type: 'chunk',
          content,
          role: 'Patient',
          name: patient.name || 'Patient',
        };

        // Include speaks_for information if present
        if (patient.speaks_for) {
          chunkData.speaks_for = patient.speaks_for;
        }

        const dataToSend = `data: ${JSON.stringify(chunkData)}\n\n`;
        console.log(`📤 Sending chunk data: ${dataToSend.substring(0, 100)}...`);
        res.write(dataToSend);
      }
    }

    console.log(`✅ Finished processing ${chunkCount} chunks. Total response length: ${fullResponse.length}`);
    log.info('Successfully streamed patient response.');

    if (fullResponse) {
      const patient = caseData.patient_profile || caseData.patient_persona || {};
      const historyEntry = {
        role: 'Patient',
        name: patient.name || 'Patient',
        content: fullResponse,
        timestamp: new Date(),
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
      res.write(`data: ${JSON.stringify({ type: 'session_end', content: 'SESSION_END' })}\n\n`);
    }
  } catch (error) {
    console.error('❌ Error in AI streaming:', error);
    log.error(error, 'Error calling OpenRouter stream API.');
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content: `An error occurred with the AI service: ${error.message}`,
      })}\n\n`
    );
  } finally {
    console.log('🔚 Ending streaming response');
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
  return { fullResponse, sessionShouldBeMarkedEnded };
}

function parseEvaluationMetrics(evaluationText, log) {
  const metrics = {
    history_taking_rating: 'Fair',
    risk_factor_assessment_rating: 'Fair',
    differential_diagnosis_questioning_rating: 'Fair',
    communication_and_empathy_rating: 'Fair',
    clinical_urgency_rating: 'Fair',
    overall_diagnosis_accuracy: 'Undetermined',
    evaluation_summary: 'Evaluation could not be parsed from AI response.',
    overall_score: null,
    performance_label: 'Fair',
  };

  if (!evaluationText || typeof evaluationText !== 'string') {
    log.warn('Evaluation text is null or not a string, returning default metrics.');
    return metrics;
  }

  const ratingRegex = (criterion) =>
    new RegExp(`${criterion}: \\(Rating: (Excellent|Very good|Good|Fair|Poor)\\)`);
  let match;

  match = evaluationText.match(ratingRegex('History Taking'));
  if (match) metrics.history_taking_rating = match[1];

  match = evaluationText.match(ratingRegex('Risk Factor Assessment'));
  if (match) metrics.risk_factor_assessment_rating = match[1];

  match = evaluationText.match(ratingRegex('Differential Diagnosis Questioning'));
  if (match) metrics.differential_diagnosis_questioning_rating = match[1];

  match = evaluationText.match(ratingRegex('Communication and Empathy'));
  if (match) metrics.communication_and_empathy_rating = match[1];

  match = evaluationText.match(ratingRegex('Clinical Urgency'));
  if (match) metrics.clinical_urgency_rating = match[1];

  const summaryRegex = /Summary & Recommendations:\s*([\s\S]*?)(?=Overall Performance Score:|$)/;
  match = evaluationText.match(summaryRegex);
  if (match) {
    const summaryContent = match[1].trim();
    metrics.evaluation_summary = summaryContent;
    if (
      summaryContent.toLowerCase().includes('diagnosis was reached') ||
      summaryContent.toLowerCase().includes('correctly identified')
    ) {
      metrics.overall_diagnosis_accuracy = 'Reached';
    } else if (
      summaryContent.toLowerCase().includes('diagnosis was missed') ||
      summaryContent.toLowerCase().includes('failed to identify')
    ) {
      metrics.overall_diagnosis_accuracy = 'Missed';
    } else if (
      summaryContent.toLowerCase().includes('partially reached') ||
      summaryContent.toLowerCase().includes('partially identified')
    ) {
      metrics.overall_diagnosis_accuracy = 'Partially Reached';
    } else {
      metrics.overall_diagnosis_accuracy = 'Undetermined';
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
  const log = parentLog
    ? parentLog.child({ service: 'aiService', function: 'getEvaluation' })
    : logger.child({ service: 'aiService', function: 'getEvaluation' });
  const { clinical_dossier, evaluation_criteria, patient_persona } = caseData;
  const hiddenDiagnosis = clinical_dossier?.hidden_diagnosis;
  const patientName = patient_persona?.name || 'the patient';

  if (!hiddenDiagnosis || !evaluation_criteria) {
    log.error('Evaluation cannot be performed: Missing hidden diagnosis or evaluation criteria.');
    return {
      evaluationText: 'Evaluation data is missing from the case file.',
      extractedMetrics: parseEvaluationMetrics(null, log),
    };
  }

  // Check if evaluation_criteria is a Map, if not convert it to one
  const criteriaMap =
    evaluation_criteria instanceof Map
      ? evaluation_criteria
      : new Map(Object.entries(evaluation_criteria));

  log.info(
    `Evaluation criteria type: ${
      evaluation_criteria instanceof Map ? 'Map' : typeof evaluation_criteria
    }`
  );

  const historyString = conversationHistory
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join('\n');
  // Enhanced evaluation prompt with clinical reasoning focus
  const evaluationPrompt = `
    You are an expert medical educator evaluating a clinician's performance with a simulated patient.
    Hidden Diagnosis: ${hiddenDiagnosis}.
    Conversation:
    --- START ---
    ${historyString}
    --- END ---

    Evaluate based on these clinical reasoning competencies:
    1. History Taking: ${
      criteriaMap.get('History_Taking') ||
      criteriaMap.get('history_taking') ||
      'Completeness and relevance of history gathered, including onset, location, character, severity, timing, exacerbating/relieving factors, and associated symptoms.'
    }
    2. Risk Factor Assessment: ${
      criteriaMap.get('Risk_Factor_Assessment') ||
      criteriaMap.get('risk_factor_assessment') ||
      'Identification and exploration of relevant risk factors, past medical history, family history, and social determinants of health.'
    }
    3. Differential Diagnosis Generation: ${
      criteriaMap.get('Differential_Diagnosis_Generation') ||
      criteriaMap.get('differential_diagnosis_generation') ||
      'Ability to generate appropriate differential diagnoses, prioritize possibilities, and consider rare but serious conditions.'
    }
    4. Diagnostic Reasoning: ${
      criteriaMap.get('Diagnostic_Reasoning') ||
      criteriaMap.get('diagnostic_reasoning') ||
      'Logical progression from history to differential diagnosis, appropriate test selection, and interpretation of findings.'
    }
    5. Clinical Decision Making: ${
      criteriaMap.get('Clinical_Decision_Making') ||
      criteriaMap.get('clinical_decision_making') ||
      'Appropriateness of diagnostic tests ordered, treatment decisions, and management plan based on available information.'
    }
    6. Communication and Empathy: ${
      criteriaMap.get('Communication_and_Empathy') ||
      criteriaMap.get('communication_empathy') ||
      "Patient-centered communication, empathy, rapport building, and clear explanation of findings and plans."
    }
    7. Clinical Urgency Recognition: ${
      criteriaMap.get('Clinical_Urgency_Recognition') ||
      criteriaMap.get('clinical_urgency_recognition') ||
      'Recognition of time-sensitive conditions, appropriate escalation, and emergency management when needed.'
    }

    For each competency, rate as Excellent, Very Good, Good, Fair, or Poor, with specific examples from the conversation.
    Provide detailed feedback on clinical reasoning patterns, cognitive biases, and areas for improvement.

    Conclude with a "Clinical Reasoning Analysis" that includes:
    - Pattern recognition strengths and weaknesses
    - Hypothesis-driven questioning assessment
    - Diagnostic accuracy and efficiency
    - Management decision appropriateness
    - Specific learning recommendations

    State whether the correct diagnosis was reached, partially reached, or missed.

    Provide an "Overall Clinical Reasoning Score: [0-100]%" and a "Performance Label: [Excellent/Very good/Good/Fair/Poor]" based on these thresholds:
    90-100: Excellent (Masterful clinical reasoning),
    80-89: Very good (Strong clinical reasoning with minor gaps),
    70-79: Good (Adequate clinical reasoning with some areas for improvement),
    60-69: Fair (Basic clinical reasoning with significant gaps),
    <60: Poor (Needs substantial improvement in clinical reasoning).

    Format exactly as follows:
    SESSION END
    Thank you for completing the simulation. Here is a comprehensive evaluation of your clinical reasoning performance based on the case of ${patientName}.
    Hidden Diagnosis: ${hiddenDiagnosis}
    
    CLINICAL REASONING EVALUATION:
    1. History Taking: (Rating: [Rating])
    [Detailed assessment with examples]
    
    2. Risk Factor Assessment: (Rating: [Rating])
    [Detailed assessment with examples]
    
    3. Differential Diagnosis Generation: (Rating: [Rating])
    [Detailed assessment with examples]
    
    4. Diagnostic Reasoning: (Rating: [Rating])
    [Detailed assessment with examples]
    
    5. Clinical Decision Making: (Rating: [Rating])
    [Detailed assessment with examples]
    
    6. Communication and Empathy: (Rating: [Rating])
    [Detailed assessment with examples]
    
    7. Clinical Urgency Recognition: (Rating: [Rating])
    [Detailed assessment with examples]
    
    CLINICAL REASONING ANALYSIS:
    [Comprehensive analysis of reasoning patterns, cognitive processes, and decision-making quality]
    
    DIAGNOSTIC ACCURACY: [Reached/Partially Reached/Missed]
    
    Overall Clinical Reasoning Score: [Score]%
    Performance Label: [Label]
    
    KEY RECOMMENDATIONS:
    [3-5 specific, actionable recommendations for improving clinical reasoning skills]
  `;

  try {
    log.info('Requesting comprehensive clinical reasoning evaluation from AI.');
    const response = await openai.chat.completions.create({
      model: 'meta-llama/llama-3-8b-instruct',
      messages: [{ role: 'system', content: evaluationPrompt }],
      temperature: 0.4, // Lower temperature for more consistent evaluations
      max_tokens: 2000, // Increased tokens for detailed evaluation
    });

    const evaluationText =
      response.choices[0]?.message?.content || 'Could not generate evaluation.';
    log.info('Successfully received comprehensive clinical reasoning evaluation from AI.');
    const extractedMetrics = parseEvaluationMetrics(evaluationText, log);

    return { evaluationText, extractedMetrics };
  } catch (error) {
    log.error(error, 'Error calling OpenAI for comprehensive evaluation.');
    return {
      evaluationText: 'An error occurred while generating the comprehensive evaluation.',
      extractedMetrics: parseEvaluationMetrics(null, log),
    };
  }
}
