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