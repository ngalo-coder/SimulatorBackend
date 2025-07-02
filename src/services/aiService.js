import OpenAI from 'openai';

// Initialize OpenAI client with API key from environment variable
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Formats a key from snake_case or camelCase to a readable Title Case string.
 * e.g., 'past_medical_history' -> 'Past Medical History'
 * @param {string} key The key to format.
 * @returns {string} The formatted title.
 */
function formatTitle(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Recursively formats the clinical information object into a readable text block for the AI prompt.
 * @param {object} infoObject The clinical information object.
 * @returns {string} A formatted string for the AI's "Core Knowledge".
 */
function formatClinicalInfo(infoObject) {
  let formattedString = '';
  for (const key in infoObject) {
    // CRITICAL: Do not reveal the hidden diagnosis to the AI model itself.
    if (key === 'hidden_diagnosis') continue;

    const title = formatTitle(key);
    formattedString += `\n- ${title}:\n`;

    const value = infoObject[key];

    if (Array.isArray(value)) {
      formattedString += value.map(item => `  - ${item}`).join('\n');
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested objects like 'review_of_systems'
      for (const subKey in value) {
        const subTitle = formatTitle(subKey);
        formattedString += `  - ${subTitle}:\n`;
        if (Array.isArray(value[subKey])) {
          formattedString += value[subKey].map(item => `    - ${item}`).join('\n');
        }
      }
    } else {
      // Handle simple string values
      formattedString += `  - ${value}`;
    }
  }
  return formattedString;
}

/**
 * Gets a STREAMED response from the AI patient model and writes it to the response object.
 * @param {object} caseData - The full JSON object for the current case.
 * @param {Array<object>} conversationHistory - The history of the chat.
 * @param {string} newQuestion - The clinician's new question.
 * @param {object} res - The Express response object to write the stream to.
 */
export async function getPatientResponseStream(caseData, conversationHistory, newQuestion, res) {
  const { system_instruction, patient_profile, response_rules, clinical_information_to_disclose } = caseData;

  // Build the "Core Knowledge" prompt section from the clinical data
  const coreKnowledgePrompt = formatClinicalInfo(clinical_information_to_disclose);

  // Build the conversation history string
  const historyString = conversationHistory
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  // Assemble the final, detailed prompt using the new generic structure
  const finalPrompt = `
    ${system_instruction}

    --- YOUR PERSONA ---
    - Name: ${patient_profile.name}
    - Age: ${patient_profile.age}
    - Occupation: ${patient_profile.occupation}
    - Chief Complaint: ${patient_profile.chief_complaint}
    - Emotional Tone: ${patient_profile.emotional_tone}
    - Background: ${patient_profile.background_story || 'Not specified'}

    --- YOUR CORE KNOWLEDGE (SOURCE OF TRUTH) ---
    You possess the following clinical information. Only reveal a piece of information if asked a direct and relevant question about it. If asked about something not on this list (e.g., 'Do you have chest pain?'), you should state that you haven't experienced it or it's not a problem for you.
    ${coreKnowledgePrompt}
    
    --- RESPONSE RULES ---
    - If the user asks an unclear question, respond with: "${response_rules.invalid_input_response}"
    
    --- PREVIOUS CONVERSATION ---
    ${historyString}
    ---

    Clinician: ${newQuestion}
    Patient:
    `;

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.5,
      max_tokens: 150,
      stream: true, // Enable streaming
    });

    // Loop through the stream chunks as they arrive from OpenAI
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        // Write each chunk to the client in the SSE format
        res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
      }
    }
  } catch (error) {
    console.error("Error calling OpenAI stream API:", error);
    // If an error occurs, send an error event
    res.write(`data: ${JSON.stringify({ type: 'error', content: "An error occurred with the AI service." })}\n\n`);
  } finally {
    // When the stream is finished, send a 'done' event and end the response
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
}