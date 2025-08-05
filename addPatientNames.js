import mongoose from 'mongoose';
import Case from './src/models/CaseModel.js';
import dotenv from 'dotenv';

dotenv.config();

// Sample patient names for different demographics
const patientNames = {
    male: [
        'David Otieno', 'Michael Johnson', 'James Wilson', 'Robert Brown', 'William Davis',
        'John Smith', 'Christopher Miller', 'Daniel Garcia', 'Matthew Rodriguez', 'Anthony Martinez'
    ],
    female: [
        'Sarah Johnson', 'Emily Rodriguez', 'Lisa Thompson', 'Maria Garcia', 'Jennifer Davis',
        'Jessica Wilson', 'Ashley Brown', 'Amanda Miller', 'Stephanie Martinez', 'Michelle Anderson'
    ]
};

function getRandomPatientName(gender, age) {
    const genderKey = gender?.toLowerCase() === 'female' ? 'female' : 'male';
    const names = patientNames[genderKey];
    return names[Math.floor(Math.random() * names.length)];
}

async function addPatientNames() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find cases without patient names
        const casesWithoutNames = await Case.find({
            $or: [
                { 'patient_persona.name': { $exists: false } },
                { 'patient_persona.name': null },
                { 'patient_persona.name': '' }
            ]
        });

        console.log(`\n📋 Found ${casesWithoutNames.length} cases without patient names`);

        if (casesWithoutNames.length === 0) {
            console.log('✅ All cases already have patient names!');
            return;
        }

        let updatedCount = 0;

        for (const caseDoc of casesWithoutNames) {
            const patientName = getRandomPatientName(
                caseDoc.patient_persona?.gender,
                caseDoc.patient_persona?.age
            );

            await Case.updateOne(
                { _id: caseDoc._id },
                { 'patient_persona.name': patientName }
            );

            console.log(`✅ Updated case ${caseDoc.case_metadata?.case_id}: Added patient name "${patientName}"`);
            updatedCount++;
        }

        console.log(`\n🎉 Successfully updated ${updatedCount} cases with patient names!`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

addPatientNames();