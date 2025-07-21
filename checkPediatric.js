import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from './src/models/CaseModel.js';
import connectDB from './src/config/db.js';

dotenv.config();
await connectDB();

// Check for VP-PED-BASIC-002 specifically
const case002 = await Case.findOne({ 'case_metadata.case_id': 'VP-PED-BASIC-002' });
if (case002) {
  console.log('Case VP-PED-BASIC-002 found:');
  console.log('Patient age:', case002.patient_persona?.age);
  console.log('Is pediatric:', case002.patient_persona?.is_pediatric);
  console.log('Guardian exists:', !!case002.patient_persona?.guardian);
  if (case002.patient_persona?.guardian) {
    console.log('Guardian name:', case002.patient_persona.guardian.name);
    console.log('Guardian relationship:', case002.patient_persona.guardian.relationship);
  }
} else {
  console.log('Case VP-PED-BASIC-002 not found');
}

// Check all pediatric cases
const pediatricCases = await Case.find({ 'patient_persona.age': { $lt: 18 } });
console.log('\nFound', pediatricCases.length, 'cases with age < 18');

const markedPediatric = await Case.find({ 'patient_persona.is_pediatric': true });
console.log('Found', markedPediatric.length, 'cases marked as pediatric');

await mongoose.connection.close();