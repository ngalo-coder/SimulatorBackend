import axios from 'axios';

const apiUrl = 'http://localhost:3000/api/cases/categories';

async function testAPI() {
  try {
    console.log(`Making request to ${apiUrl}...\n`);
    const response = await axios.get(apiUrl);
    
    console.log('Response Status:', response.status);
    console.log('\nResponse Headers:', Object.keys(response.headers));
    console.log('\nResponse Data:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.data?.specialties) {
      console.log('\n✓ specialties found at: response.data.data.specialties');
      console.log('Specialties:', response.data.data.specialties);
    } else if (response.data.specialties) {
      console.log('\n✓ specialties found at: response.data.specialties');
      console.log('Specialties:', response.data.specialties);
    } else {
      console.log('\n❌ specialties NOT found in response!');
      console.log('Available keys:', Object.keys(response.data));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();
