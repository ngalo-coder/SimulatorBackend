import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Helper to fill the template with case data
function fillCaseTemplate(caseData, conversationHistory, newQuestion) {
  const tagsList = (caseData.case_metadata?.tags || []).map(tag => `"${tag}"`).join(', ');
  const interactionFlow = (caseData.interaction_flow || [])
    .map(flow => `{
      "condition": "${flow.condition}",
      "response": "${flow.response}"
    }`)
    .join(',\n    ');

  return `
{
  "version": "1.0",
  "description": "Virtual Patient Simulation: ${caseData.case_metadata?.title || ''}",
  "system_instruction": "You are an AI-simulated patient interacting with a clinician. Your responses must follow clinical realism. Only reveal patient history if asked. You do not give medical opinions. Wait for the clinician's questions before responding. Never state the diagnosis.",
  "case_metadata": {
    "case_id": "${caseData.case_metadata?.case_id || ''}",
    "title": "${caseData.case_metadata?.title || ''}",
    "difficulty": "${caseData.case_metadata?.difficulty || ''}",
    "estimated_duration_min": ${caseData.case_metadata?.estimated_duration_min || 0},
    "tags": [${tagsList}]
  },
  "patient_profile": {
    "name": "${caseData.patient_profile?.name || ''}",
    "age": ${caseData.patient_profile?.age || 0},
    "gender": "${caseData.patient_profile?.gender || ''}",
    "occupation": "${caseData.patient_profile?.occupation || ''}",
    "chief_complaint": "${caseData.patient_profile?.chief_complaint || ''}",
    "hidden_diagnosis": "${caseData.patient_profile?.hidden_diagnosis || ''}",
    "case_notes": "${caseData.patient_profile?.case_notes || ''}"
  },
  "initial_prompt": "You are now interacting with a virtual patient named ${caseData.patient_profile?.name || ''}. Begin by asking your clinical questions.",
  "response_rules": {
    "disclosure_logic": "Only reveal symptoms, history, or findings if the clinician asks a relevant question. Do not volunteer information.",
    "emotional_tone": "${caseData.response_rules?.emotional_tone || ''}",
    "invalid_input_response": "I'm not sure I understand. Could you ask that another way?"
  },
  "interaction_flow": [
    ${interactionFlow}
  ],
  "end_session_trigger": {
    "condition": "${caseData.end_session_trigger?.condition || ''}",
    "response": "${caseData.end_session_trigger?.response || ''}"
  },
  "evaluation_criteria": {
    "History Taking": "${caseData.evaluation_criteria?.['History Taking'] || ''}",
    "Differential Diagnosis": "${caseData.evaluation_criteria?.['Differential Diagnosis'] || ''}",
    "Clinical Reasoning": "${caseData.evaluation_criteria?.['Clinical Reasoning'] || ''}",
    "Management Plan": "${caseData.evaluation_criteria?.['Management Plan'] || ''}",
    "Communication": "${caseData.evaluation_criteria?.['Communication'] || ''}"
  },
  "conversation_history": ${JSON.stringify(conversationHistory)},
  "clinician_question": "${newQuestion}"
}
  `.trim();
}

export async function getPatientResponseStream(caseData, conversationHistory, newQuestion, res) {
  const prompt = fillCaseTemplate(caseData, conversationHistory, newQuestion);

  try {
    const stream = await openai.chat.completions.create({
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 150,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
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