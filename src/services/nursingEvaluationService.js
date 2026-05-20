import { getEvaluation as getBaseEvaluation } from './aiService.js';
import logger from '../config/logger.js';

/**
 * Parse nursing-specific evaluation metrics from evaluation text
 */
function parseNursingEvaluationMetrics(evaluationText, log) {
  const metrics = {
    // Core nursing competencies
    assessment_skills_rating: 'Not Available',
    nursing_diagnosis_accuracy: 'Not Available',
    care_planning_effectiveness: 'Not Available',
    intervention_selection_rating: 'Not Available',
    patient_education_quality: 'Not Available',
    communication_empathy_rating: 'Not Available',
    safety_protocols_adherence: 'Not Available',
    documentation_quality: 'Not Available',
    
    // Nursing process evaluation
    nursing_process_completeness: 'Not Available',
    critical_thinking_rating: 'Not Available',
    clinical_judgment_rating: 'Not Available',
    
    // Patient safety metrics
    fall_prevention_measures: 'Not Available',
    infection_control_compliance: 'Not Available',
    medication_safety_practices: 'Not Available',
    pain_management_effectiveness: 'Not Available',
    
    evaluation_summary: 'Not Available',
    overall_nursing_score: null,
    performance_label: 'Not Available',
    nursing_diagnosis_accuracy_percentage: null
  };

  if (!evaluationText || typeof evaluationText !== 'string') {
    log.warn('Evaluation text is null or not a string, returning default nursing metrics.');
    return metrics;
  }

  // Parse nursing-specific ratings
  const ratingRegex = (criterion) =>
    new RegExp(`${criterion}: \\(Rating: (Excellent|Very good|Good|Fair|Poor)\\)`);
  let match;

  match = evaluationText.match(ratingRegex('Assessment Skills'));
  if (match) metrics.assessment_skills_rating = match[1];

  match = evaluationText.match(ratingRegex('Nursing Diagnosis Accuracy'));
  if (match) metrics.nursing_diagnosis_accuracy = match[1];

  match = evaluationText.match(ratingRegex('Care Planning Effectiveness'));
  if (match) metrics.care_planning_effectiveness = match[1];

  match = evaluationText.match(ratingRegex('Intervention Selection'));
  if (match) metrics.intervention_selection_rating = match[1];

  match = evaluationText.match(ratingRegex('Patient Education Quality'));
  if (match) metrics.patient_education_quality = match[1];

  match = evaluationText.match(ratingRegex('Communication and Empathy'));
  if (match) metrics.communication_empathy_rating = match[1];

  match = evaluationText.match(ratingRegex('Safety Protocols Adherence'));
  if (match) metrics.safety_protocols_adherence = match[1];

  match = evaluationText.match(ratingRegex('Documentation Quality'));
  if (match) metrics.documentation_quality = match[1];

  // Parse nursing process metrics
  match = evaluationText.match(ratingRegex('Nursing Process Completeness'));
  if (match) metrics.nursing_process_completeness = match[1];

  match = evaluationText.match(ratingRegex('Critical Thinking'));
  if (match) metrics.critical_thinking_rating = match[1];

  match = evaluationText.match(ratingRegex('Clinical Judgment'));
  if (match) metrics.clinical_judgment_rating = match[1];

  // Parse safety metrics
  match = evaluationText.match(ratingRegex('Fall Prevention Measures'));
  if (match) metrics.fall_prevention_measures = match[1];

  match = evaluationText.match(ratingRegex('Infection Control Compliance'));
  if (match) metrics.infection_control_compliance = match[1];

  match = evaluationText.match(ratingRegex('Medication Safety Practices'));
  if (match) metrics.medication_safety_practices = match[1];

  match = evaluationText.match(ratingRegex('Pain Management Effectiveness'));
  if (match) metrics.pain_management_effectiveness = match[1];

  // Parse summary and overall scores
  const summaryRegex = /Nursing Evaluation Summary:\s*([\s\S]*?)(?=Overall Nursing Score:|$)/;
  match = evaluationText.match(summaryRegex);
  if (match) {
    metrics.evaluation_summary = match[1].trim();
  }

  const scoreRegex = /Overall Nursing Score:\s*(\d{1,3})\s*%/;
  match = evaluationText.match(scoreRegex);
  if (match) metrics.overall_nursing_score = parseInt(match[1], 10);

  const labelRegex = /Performance Label:\s*(Excellent|Very good|Good|Fair|Poor)/;
  match = evaluationText.match(labelRegex);
  if (match) metrics.performance_label = match[1];

  const accuracyRegex = /Nursing Diagnosis Accuracy:\s*(\d{1,3})\s*%/;
  match = evaluationText.match(accuracyRegex);
  if (match) metrics.nursing_diagnosis_accuracy_percentage = parseInt(match[1], 10);

  log.info({ parsedNursingMetrics: metrics }, 'Parsed nursing evaluation metrics from text.');
  return metrics;
}

/**
 * Generate nursing-specific evaluation prompt
 */
function buildNursingEvaluationPrompt(caseData, conversationHistory, hiddenDiagnosis, criteriaMap) {
  const patientName = caseData.patient_persona?.name || 'the patient';
  const historyString = conversationHistory
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join('\n');

  return `
You are an expert nursing educator evaluating a nurse's performance with a simulated patient.
Hidden Diagnosis: ${hiddenDiagnosis}.
Conversation:
--- START ---
${historyString}
--- END ---

Evaluate based on these nursing competencies:

1. Assessment Skills: ${
  criteriaMap.get('Assessment_Skills') ||
  criteriaMap.get('assessment_skills') ||
  'Completeness and accuracy of patient assessment, including vital signs, physical assessment, and comprehensive data collection.'
}

2. Nursing Diagnosis Accuracy: ${
  criteriaMap.get('Nursing_Diagnosis_Accuracy') ||
  criteriaMap.get('nursing_diagnosis_accuracy') ||
  'Accuracy in identifying appropriate nursing diagnoses based on assessment data, using NANDA terminology when applicable.'
}

3. Care Planning Effectiveness: ${
  criteriaMap.get('Care_Planning_Effectiveness') ||
  criteriaMap.get('care_planning_effectiveness') ||
  'Development of comprehensive, individualized care plans with appropriate goals and outcomes.'
}

4. Intervention Selection: ${
  criteriaMap.get('Intervention_Selection') ||
  criteriaMap.get('intervention_selection') ||
  'Appropriate selection and implementation of nursing interventions based on identified diagnoses and patient needs.'
}

5. Patient Education Quality: ${
  criteriaMap.get('Patient_Education_Quality') ||
  criteriaMap.get('patient_education_quality') ||
  'Effectiveness in providing patient education, including clarity, appropriateness, and patient understanding.'
}

6. Communication and Empathy: ${
  criteriaMap.get('Communication_and_Empathy') ||
  criteriaMap.get('communication_empathy') ||
  'Therapeutic communication, empathy, active listening, and building rapport with the patient.'
}

7. Safety Protocols Adherence: ${
  criteriaMap.get('Safety_Protocols_Adherence') ||
  criteriaMap.get('safety_protocols_adherence') ||
  'Adherence to patient safety protocols, including fall prevention, infection control, and medication safety.'
}

8. Documentation Quality: ${
  criteriaMap.get('Documentation_Quality') ||
  criteriaMap.get('documentation_quality') ||
  'Accuracy, completeness, and timeliness of documentation following nursing standards.'
}

9. Nursing Process Completeness: ${
  criteriaMap.get('Nursing_Process_Completeness') ||
  criteriaMap.get('nursing_process_completeness') ||
  'Thorough application of the nursing process: assessment, diagnosis, planning, implementation, and evaluation.'
}

10. Critical Thinking: ${
  criteriaMap.get('Critical_Thinking') ||
  criteriaMap.get('critical_thinking') ||
  'Demonstration of critical thinking skills in clinical decision-making and problem-solving.'
}

11. Clinical Judgment: ${
  criteriaMap.get('Clinical_Judgment') ||
  criteriaMap.get('clinical_judgment') ||
  'Quality of clinical judgment in prioritizing care and making appropriate decisions.'
}

For each competency, rate as Excellent, Very Good, Good, Fair, or Poor, with specific examples from the conversation.

Include specific evaluation of:
- Fall prevention measures implemented
- Infection control compliance
- Medication safety practices
- Pain management effectiveness

Conclude with a "Nursing Evaluation Summary" that includes:
- Strengths in nursing care delivery
- Areas for improvement in clinical practice
- Specific recommendations for enhancing nursing skills
- Evaluation of nursing diagnosis accuracy (provide percentage)

Provide an "Overall Nursing Score: [0-100]%" and a "Performance Label: [Excellent/Very good/Good/Fair/Poor]" based on these thresholds:
90-100: Excellent (Exceptional nursing care),
80-89: Very good (Strong nursing practice with minor areas for improvement),
70-79: Good (Competent nursing care with some areas needing development),
60-69: Fair (Basic nursing skills with significant gaps),
<60: Poor (Needs substantial improvement in nursing practice).

Format exactly as follows:
NURSING EVALUATION
Thank you for completing the nursing simulation. Here is a comprehensive evaluation of your nursing performance based on the case of ${patientName}.
Hidden Diagnosis: ${hiddenDiagnosis}

NURSING COMPETENCIES EVALUATION:
1. Assessment Skills: (Rating: [Rating])
[Detailed assessment with examples]

2. Nursing Diagnosis Accuracy: (Rating: [Rating])
[Detailed assessment with examples]

3. Care Planning Effectiveness: (Rating: [Rating])
[Detailed assessment with examples]

4. Intervention Selection: (Rating: [Rating])
[Detailed assessment with examples]

5. Patient Education Quality: (Rating: [Rating])
[Detailed assessment with examples]

6. Communication and Empathy: (Rating: [Rating])
[Detailed assessment with examples]

7. Safety Protocols Adherence: (Rating: [Rating])
[Detailed assessment with examples]

8. Documentation Quality: (Rating: [Rating])
[Detailed assessment with examples]

9. Nursing Process Completeness: (Rating: [Rating])
[Detailed assessment with examples]

10. Critical Thinking: (Rating: [Rating])
[Detailed assessment with examples]

11. Clinical Judgment: (Rating: [Rating])
[Detailed assessment with examples]

PATIENT SAFETY EVALUATION:
- Fall Prevention Measures: (Rating: [Rating])
- Infection Control Compliance: (Rating: [Rating])
- Medication Safety Practices: (Rating: [Rating])
- Pain Management Effectiveness: (Rating: [Rating])

Nursing Evaluation Summary:
[Comprehensive analysis of nursing performance]

Nursing Diagnosis Accuracy: [Accuracy]%

Overall Nursing Score: [Score]%
Performance Label: [Label]

KEY RECOMMENDATIONS FOR NURSING PRACTICE:
[3-5 specific, actionable recommendations for improving nursing skills]
  `;
}

/**
 * Main function to get nursing-specific evaluation
 */
export async function getNursingEvaluation(caseData, conversationHistory, parentLog) {
  const log = parentLog
    ? parentLog.child({ service: 'nursingEvaluationService', function: 'getNursingEvaluation' })
    : logger.child({ service: 'nursingEvaluationService', function: 'getNursingEvaluation' });

  const { clinical_dossier, evaluation_criteria, nursing_diagnoses } = caseData;
  const hiddenDiagnosis = clinical_dossier?.hidden_diagnosis;

  if (!hiddenDiagnosis || !evaluation_criteria) {
    log.error('Nursing evaluation cannot be performed: Missing hidden diagnosis or evaluation criteria.');
    return {
      evaluationText: 'Evaluation data is missing from the case file.',
      extractedMetrics: parseNursingEvaluationMetrics(null, log),
    };
  }

  // Check if this is a nursing-focused case
  const isNursingCase = nursing_diagnoses && nursing_diagnoses.length > 0;
  if (!isNursingCase) {
    log.info('Case does not contain nursing diagnoses, using standard evaluation.');
    return getBaseEvaluation(caseData, conversationHistory, parentLog);
  }

  // Convert evaluation criteria to Map if needed
  const criteriaMap = evaluation_criteria instanceof Map
    ? evaluation_criteria
    : new Map(Object.entries(evaluation_criteria));

  const evaluationPrompt = buildNursingEvaluationPrompt(caseData, conversationHistory, hiddenDiagnosis, criteriaMap);

  try {
    log.info('Requesting nursing-specific evaluation from AI.');
    // Import OpenAI client from aiService
    const { openai } = await import('./aiService.js');
    
    const response = await openai.chat.completions.create({
      model: 'deepseek/deepseek-v3-0324:free',
      messages: [{ role: 'system', content: evaluationPrompt }],
      temperature: 0.4,
      max_tokens: 2500,
    });

    const evaluationText = response.choices[0]?.message?.content || 'Could not generate nursing evaluation.';
    log.info('Successfully received nursing-specific evaluation from AI.');
    const extractedMetrics = parseNursingEvaluationMetrics(evaluationText, log);

    return { evaluationText, extractedMetrics };
  } catch (error) {
    log.error(error, 'Error calling OpenAI for nursing evaluation.');
    return {
      evaluationText: 'An error occurred while generating the nursing evaluation.',
      extractedMetrics: parseNursingEvaluationMetrics(null, log),
    };
  }
}

export default {
  getNursingEvaluation,
  parseNursingEvaluationMetrics
};