const Case = require('../models/Case');
const Session = require('../models/Session');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
    'X-Title': 'Simuatech',
  },
});
exports.startSession = async (req, res) => {
    const { caseId, userId = 'anonymous' } = req.body;
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) return res.status(404).json({ error: 'Case not found' });

    const session = new Session({ userId, caseId, conversation: [] });
    await session.save();

    // Generate initial greeting from AI patient
    // Use a prompt that explicitly positions the user as the doctor
    const greeting = await getPatientResponse(caseDoc, [], "The doctor enters the room. As the patient, introduce yourself and describe your main problem to the doctor.");
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

    const last10 = session.conversation.slice(-10);
    const reply = await getPatientResponse(session.caseId, last10, question);
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
    session.assessment = await generateAssessment(session, session.caseId);
    await session.save();

    res.json({ assessment: session.assessment });
};

async function getPatientResponse(caseDoc, history, userQuestion) {
    // Build conversation history.
    // The "patient" messages in our DB store are the AI's replies as the patient.
    // For the OpenAI API, the AI plays the assistant role, but we need to
    // strongly reinforce that the assistant IS the patient, NOT a doctor.
    const historyMessages = history.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
    }));

    // Inject a reminder before the last user message so the AI stays in patient character.
    // This prevents the AI from slipping into a doctor/examiner role over time.
    const patientReminder = {
        role: 'system',
        content: `Remember: You are the PATIENT, not the doctor. You are ${caseDoc.patientProfile.age || 'a certain age'} years old, ${caseDoc.patientProfile.gender || 'unspecified gender'}. Your chief complaint is: "${caseDoc.patientProfile.chiefComplaint || 'N/A'}". Answer the doctor's questions as the patient. Do NOT role-play as the doctor, do NOT evaluate the doctor's questions, do NOT provide a diagnosis. You are the patient seeking medical help.`
    };

    const messages = [
        { role: 'system', content: caseDoc.patientSystemPrompt },
        ...historyMessages,
        patientReminder,
        { role: 'user', content: userQuestion }
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

