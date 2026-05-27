import fetch from 'node-fetch';

async function testAPI() {
  try {
    const url = 'http://localhost:5001/api/simulations/categories';
    console.log(`\nTesting: ${url}\n`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('\nFull Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n=== DIAGNOSTIC ===');
    if (data?.data?.specialties) {
      console.log('✓ specialties found at: response.data.specialties');
      console.log('Specialties:', data.data.specialties);
      
      const hasPharmacy = data.data.specialties.includes('Pharmacy');
      console.log(`✓ "Pharmacy" in list: ${hasPharmacy}`);
    } else {
      console.log('❌ Could not find specialties in response');
      console.log('Available keys in response:', Object.keys(data));
      if (data?.data) {
        console.log('Available keys in response.data:', Object.keys(data.data));
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
