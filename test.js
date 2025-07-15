import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001';

async function runTest() {
  try {
    // Start a new session
    const startResponse = await axios.post(`${API_BASE_URL}/api/simulation/start`, {
      caseId: 'VP-ABD-002',
    });
    const { sessionId } = startResponse.data;
    console.log(`Session started with ID: ${sessionId}`);

    // Ask a question
    await axios.get(`${API_BASE_URL}/api/simulation/ask`, {
      params: {
        sessionId,
        question: 'What is your diagnosis?',
      },
    });
    console.log('Question asked.');

    // End the session
    const endResponse = await axios.post(`${API_BASE_URL}/api/simulation/end`, {
      sessionId,
    });
    console.log('Session ended successfully.');
    console.log('Evaluation:', endResponse.data.evaluation);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

runTest();
