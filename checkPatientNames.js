import mongoose from 'mongoose';
import Case from './src/models/CaseModel.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkPatientNames() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get all cases and check their patient names
        const cases = await Case.find({}).limit(10);
        
        console.log(`\n📋 Found ${cases.length} cases in database:`);
        
        cases.forEach((caseDoc, index) => {
            console.log(`\n${index + 1}. Case ID: ${caseDoc.case_metadata?.case_id || 'No ID'}`);
            console.log(`   Title: ${caseDoc.case_metadata?.title || 'No Title'}`);
            console.log(`   Patient Name: ${caseDoc.patient_persona?.name || '❌ NO NAME'}`);
            console.log(`   Patient Age: ${caseDoc.patient_persona?.age || 'No Age'}`);
            console.log(`   Patient Gender: ${caseDoc.patient_persona?.gender || 'No Gender'}`);
        });

        // Check if we have any cases without patient names
        const casesWithoutNames = await Case.find({
            $or: [
                { 'patient_persona.name': { $exists: false } },
                { 'patient_persona.name': null },
                { 'patient_persona.name': '' }
            ]
        });

        if (casesWithoutNames.length > 0) {
            console.log(`\n⚠️  Found ${casesWithoutNames.length} cases without patient names:`);
            casesWithoutNames.forEach(caseDoc => {
                console.log(`   - ${caseDoc.case_metadata?.case_id}: ${caseDoc.case_metadata?.title}`);
            });
        } else {
            console.log('\n✅ All cases have patient names!');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

checkPatientNames();