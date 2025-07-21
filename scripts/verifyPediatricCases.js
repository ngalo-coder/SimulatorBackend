import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from '../src/models/CaseModel.js';
import connectDB from '../src/config/db.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
await connectDB();

async function verifyPediatricCases() {
  try {
    console.log('🔍 PEDIATRIC CASES VERIFICATION');
    console.log('=' .repeat(50));
    
    // Find all pediatric cases
    const pediatricCases = await Case.find({
      'patient_persona.is_pediatric': true
    });
    
    console.log(`📊 Found ${pediatricCases.length} pediatric cases in database\n`);
    
    if (pediatricCases.length === 0) {
      console.log('ℹ️  No pediatric cases found.');
      console.log('💡 Run setupPediatricFeature.js to add guardian information to existing cases.');
      return;
    }
    
    console.log('📋 PEDIATRIC CASES SUMMARY:');
    console.log('-'.repeat(50));
    
    pediatricCases.forEach((caseDoc, index) => {
      const caseId = caseDoc.case_metadata?.case_id || caseDoc._id;
      const title = caseDoc.case_metadata?.title || 'Untitled Case';
      const patientName = caseDoc.patient_persona?.name || 'Unknown Patient';
      const patientAge = caseDoc.patient_persona?.age || 'Unknown Age';
      const guardian = caseDoc.patient_persona?.guardian;
      
      console.log(`\n${index + 1}. ${caseId} - ${title}`);
      console.log(`   Patient: ${patientName} (${patientAge} years old)`);
      
      if (guardian) {
        console.log(`   ✅ Guardian: ${guardian.name} (${guardian.relationship})`);
        console.log(`   📝 Emotional State: ${guardian.emotional_state}`);
        console.log(`   💼 Occupation: ${guardian.occupation}`);
        console.log(`   🗣️  Communication Style: ${guardian.communication_style}`);
        
        // Check if initial prompt has been updated
        const promptStartsWithGuardian = caseDoc.initial_prompt && 
          (caseDoc.initial_prompt.includes(guardian.name) || 
           caseDoc.initial_prompt.includes(`I'm ${guardian.name}`) ||
           caseDoc.initial_prompt.includes(`${guardian.relationship}`));
           
        if (promptStartsWithGuardian) {
          console.log(`   ✅ Initial prompt updated for guardian`);
        } else {
          console.log(`   ⚠️  Initial prompt may need updating`);
        }
      } else {
        console.log(`   ❌ No guardian information found`);
      }
    });
    
    // Summary statistics
    const casesWithGuardians = pediatricCases.filter(c => c.patient_persona?.guardian);
    const casesWithUpdatedPrompts = pediatricCases.filter(c => {
      const guardian = c.patient_persona?.guardian;
      return guardian && c.initial_prompt && 
        (c.initial_prompt.includes(guardian.name) || 
         c.initial_prompt.includes(`I'm ${guardian.name}`));
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('📈 VERIFICATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`📊 Total pediatric cases: ${pediatricCases.length}`);
    console.log(`👨‍👩‍👧‍👦 Cases with guardian info: ${casesWithGuardians.length}`);
    console.log(`📝 Cases with updated prompts: ${casesWithUpdatedPrompts.length}`);
    
    const completionRate = pediatricCases.length > 0 ? 
      Math.round((casesWithGuardians.length / pediatricCases.length) * 100) : 0;
    
    console.log(`✅ Setup completion rate: ${completionRate}%`);
    
    if (completionRate === 100) {
      console.log('\n🎉 All pediatric cases are properly configured!');
      console.log('🚀 Your pediatric guardian feature is ready to use.');
    } else if (completionRate > 0) {
      console.log('\n⚠️  Some pediatric cases need attention.');
      console.log('💡 Run setupPediatricFeature.js to complete the setup.');
    } else {
      console.log('\n❌ No pediatric cases have guardian information.');
      console.log('💡 Run setupPediatricFeature.js to add guardian information.');
    }
    
    console.log('\n🔄 To test the feature:');
    console.log('   1. Start your application');
    console.log('   2. Select a pediatric case');
    console.log('   3. Notice guardian information in the chat interface');
    console.log('   4. Observe AI responding as the guardian');
    
  } catch (error) {
    console.error('❌ Error verifying pediatric cases:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the verification
verifyPediatricCases();