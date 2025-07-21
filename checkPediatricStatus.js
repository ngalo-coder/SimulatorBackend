import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from './src/models/CaseModel.js';
import connectDB from './src/config/db.js';

dotenv.config();
await connectDB();

console.log('🔍 Checking pediatric case status...\n');

// Check for VP-PED-BASIC-002 specifically
const case002 = await Case.findOne({'case_metadata.case_id': 'VP-PED-BASIC-002'});
if (case002) {
  console.log('✅ Found VP-PED-BASIC-002:');
  console.log('   Patient:', case002.patient_persona?.name);
  console.log('   Age:', case002.patient_persona?.age);
  console.log('   Is pediatric flag:', case002.patient_persona?.is_pediatric);
  console.log('   Guardian exists:', !!case002.patient_persona?.guardian);
  if (case002.patient_persona?.guardian) {
    console.log('   Guardian name:', case002.patient_persona.guardian.name);
    console.log('   Guardian relationship:', case002.patient_persona.guardian.relationship);
    console.log('   Guardian emotional state:', case002.patient_persona.guardian.emotional_state);
  }
} else {
  console.log('❌ VP-PED-BASIC-002 not found in database');
}

console.log('\n📊 Database summary:');

// Check all pediatric cases by age/specialty
const allPediatricCases = await Case.find({
  $or: [
    { 'patient_persona.age': { $lt: 18 } },
    { 'case_metadata.specialty': 'Pediatrics' }
  ]
});
console.log('   Pediatric cases (by age/specialty):', allPediatricCases.length);

// Check cases with is_pediatric flag
const flaggedPediatricCases = await Case.find({
  'patient_persona.is_pediatric': true
});
console.log('   Cases with is_pediatric flag:', flaggedPediatricCases.length);

// List all pediatric case IDs
if (allPediatricCases.length > 0) {
  console.log('\n📋 Pediatric cases found:');
  allPediatricCases.forEach(c => {
    console.log(`   - ${c.case_metadata?.case_id}: ${c.patient_persona?.name} (${c.patient_persona?.age}y) - Guardian: ${c.patient_persona?.guardian ? '✅' : '❌'}`);
  });
}

await mongoose.connection.close();
console.log('\n🔌 Database connection closed');