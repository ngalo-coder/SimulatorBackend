const Case = require('../models/Case');
const Session = require('../models/Session');
const OpenAI = require('openai');

function getOpenAI() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === '') {
    return null;
  }
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
      'X-Title': 'Simuatech',
    },
  });
}

exports.startSession = async (req, res) => {
    const { caseId, userId = 'anonymous' } = req.body;
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) return res.status(404).json({ error: 'Case not found' });

    const session = new Session({ userId, caseId, conversation: [] });
    await session.save();

    // Generate initial greeting from AI patient
    let greeting = '';
    try {
      greeting = await getPatientResponse(caseDoc, [], "The doctor enters the room. As the patient, introduce yourself and describe your main problem to the doctor.");
    } catch (err) {
      console.warn('⚠️ Failed to generate AI greeting:', err.message);
      // Fallback greeting when AI is unavailable
      greeting = `Hello Doctor, my name is ${caseDoc.patientName}. I'm ${caseDoc.patientProfile.age || '...'} years old. ${caseDoc.patientProfile.chiefComplaint ? `My main problem is ${caseDoc.patientProfile.chiefComplaint}.` : 'I need your help.'}`;
    }
    session.conversation.push({ role: 'patient', content: greeting });
    await session.save();

    res.json({ sessionId: session._id, greeting });
};

exports.chat = async (req, res) => {
    const { sessionId, question } = req.body;
    const session = await Session.findById(sessionId).populate('caseId');
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.conversation.push({ role: 'user', content: question });
    await session.save();

    let reply = '';
    try {
      const last10 = session.conversation.slice(-10);
      reply = await getPatientResponse(session.caseId, last10, question);
    } catch (err) {
      console.warn('⚠️ Failed to generate AI reply:', err.message);
      reply = `I'm sorry Doctor, I don't quite understand. Could you please rephrase that? My name is ${session.caseId.patientName} and I came because ${session.caseId.patientProfile.chiefComplaint || "I'm not feeling well"}.`;
    }
    session.conversation.push({ role: 'patient', content: reply });
    await session.save();

    res.json({ reply });
};

exports.endSimulation = async (req, res) => {
    const { sessionId, diagnosis, endedManually } = req.body;
    const session = await Session.findById(sessionId).populate('caseId');
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.userDiagnosis = diagnosis;
    session.endedManually = endedManually;

    try {
      session.assessment = await generateAssessment(session, session.caseId);
    } catch (err) {
      console.warn('⚠️ Failed to generate AI assessment:', err.message);
      session.assessment = {
        grade: 'Pass',
        score: 70,
        feedback: `The doctor interviewed the patient. The correct diagnosis was: ${session.caseId.patientProfile.correctDiagnosis}. The doctor's diagnosis was: ${diagnosis || 'not submitted'}.`,
        strengths: ['Initiated the consultation', 'Gathered patient history'],
        weaknesses: ['Unable to provide AI-powered assessment - API key missing or invalid']
      };
    }
    await session.save();

    res.json({ assessment: session.assessment });
};

async function getPatientResponse(caseDoc, history, userQuestion) {
    const openai = getOpenAI();
    if (!openai) {
      throw new Error('OpenRouter API key not configured');
    }

    // Build conversation history with explicit role labels.
    // The AI assistant is always the PATIENT; the user is the DOCTOR.
    // Prefix each message with its role context to prevent role confusion.
    const historyMessages = history.map(m => {
        const role = m.role === 'user' ? 'user' : 'assistant';
        const prefix = m.role === 'user'
            ? '[The DOCTOR asks me:]'
            : '[I, the PATIENT, reply:]';
        return { role, content: `${prefix} ${m.content}` };
    });

    // Inject a strong reminder before the last user message so the AI stays strictly in patient character.
    const patientReminder = {
        role: 'system',
        content: `⚠️ CRITICAL REMINDER: You are the PATIENT, NOT the doctor. NEVER act as a doctor. NEVER diagnose yourself. NEVER evaluate the doctor's questions. NEVER give medical advice or treatment suggestions. You are ${caseDoc.patientProfile.age || 'a certain age'} years old, ${caseDoc.patientProfile.gender || 'unspecified gender'}. Your chief complaint is: "${caseDoc.patientProfile.chiefComplaint || 'N/A'}". Describe only your symptoms, feelings, and history as the patient. Answer naturally but remember you are seeking help.`
    };

    const messages = [
        { role: 'system', content: caseDoc.patientSystemPrompt },
        ...historyMessages,
        patientReminder,
        { role: 'user', content: `[The DOCTOR asks me:] ${userQuestion}` }
    ];

    const completion = await openai.chat.completions.create({
        model: 'openai/gpt-3.5-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 150
    });
    return completion.choices[0].message.content;
}

async function generateAssessment(session, caseDoc) {
    const openai = getOpenAI();
    if (!openai) {
      throw new Error('OpenRouter API key not configured');
    }

    const conversationText = session.conversation.map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = `
You are a clinical educator. Evaluate the doctor's performance.

Case: ${caseDoc.title}
Correct diagnosis: ${caseDoc.patientProfile.correctDiagnosis}
User's diagnosis: ${session.userDiagnosis || "(none submitted)"}
Conversation:
${conversationText}

Return a JSON object with exactly these fields:
{
  "grade": "Honors|High Pass|Pass|Fail",
  "score": 0-100,
  "feedback": "Short paragraph",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"]
}

Return ONLY valid JSON, no markdown formatting, no code fences.`;
    const completion = await openai.chat.completions.create({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
    });
    const text = completion.choices[0].message.content.trim();
    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(jsonStr);
}

