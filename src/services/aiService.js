// aiService.js
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// In-memory session tracking
const sessions = new Map();

export function createSession(sessionId, caseData) {
  sessions.set(sessionId, {
    caseData,
    history: [],
    sessionEnded: false,
  });
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

function fillCaseTemplate(caseData, conversationHistory, newQuestion) {
  const tagsList = (caseData.case_metadata?.tags || []).map(tag => `"${tag}"`).join(', ');
  return JSON.stringify({
    version: "1.0",
    description: `Virtual Patient Simulation: ${caseData.case_metadata?.title || ''}`,
    system_instruction:
      "You are an AI-simulated patient interacting with a clinician. Your responses must follow clinical realism. Only reveal patient history if asked. You do not give medical opinions. Wait for the clinician's questions before responding. Never state the diagnosis.",
    case_metadata: {
      case_id: caseData.case_metadata?.case_id || '',
      title: caseData.case_metadata?.title || '',
      difficulty: caseData.case_metadata?.difficulty || '',
      estimated_duration_min: caseData.case_metadata?.estimated_duration_min || 0,
      tags: caseData.case_metadata?.tags || [],
    },
    patient_profile: caseData.patient_profile,
    initial_prompt: `You are now interacting with a virtual patient named ${caseData.patient_profile?.name}. Begin by asking your clinical questions.`,
    response_rules: {
      disclosure_logic: "Only reveal symptoms, history, or findings if the clinician asks a relevant question. Do not volunteer information.",
      emotional_tone: caseData.response_rules?.emotional_tone || '',
      invalid_input_response: "I'm not sure I understand. Could you ask that another way?",
    },
    interaction_flow: caseData.interaction_flow || [],
    end_session_trigger: caseData.end_session_trigger || {},
    evaluation_criteria: caseData.evaluation_criteria || {},
    conversation_history: conversationHistory,
    clinician_question: newQuestion,
  });
}

export async function getPatientResponseStream(caseData, conversationHistory, newQuestion, sessionId, res) {
  const prompt = fillCaseTemplate(caseData, conversationHistory, newQuestion);
  const session = sessions.get(sessionId);

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

        // Check for session end trigger
        if (content.toLowerCase().includes("what do you think is going on")) {
          session.sessionEnded = true;
        }
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
