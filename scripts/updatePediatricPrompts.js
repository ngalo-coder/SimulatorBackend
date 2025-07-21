import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from '../src/models/CaseModel.js';
import connectDB from '../src/config/db.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
await connectDB();

// Function to generate guardian-appropriate initial prompts
function generateGuardianPrompt(caseDoc) {
  const patient = caseDoc.patient_persona;
  const guardian = patient.guardian;
  const chiefComplaint = patient.chief_complaint || 'not feeling well';
  const patientName = patient.name || 'my child';
  const patientAge = patient.age;
  
  // Different prompt styles based on guardian's emotional state and communication style
  const promptTemplates = {
    'very worried but medically informed': [
      `Hello doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I work in healthcare myself, but I'm really concerned about ${patientName}. ${getAgeAppropriateDescription(patientAge)} has been ${chiefComplaint.toLowerCase()}, and I'm worried this might be something serious. Can you help us figure out what's going on?`,
      `Hi doctor, I'm ${guardian.name}. I'm ${patientName}'s ${guardian.relationship} and I work as a ${guardian.occupation}. Even with my medical background, I'm quite worried about ${patientName}. ${getAgeAppropriateDescription(patientAge)} has been experiencing ${chiefComplaint.toLowerCase()}. What do you think could be causing this?`
    ],
    
    'concerned and protective': [
      `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I'm really concerned about ${getAgeAppropriateDescription(patientAge)}. ${getAgeAppropriateDescription(patientAge, true)} has been ${chiefComplaint.toLowerCase()}, and I just want to make sure ${getAgeAppropriateDescription(patientAge, true)} is going to be okay. What do you need to know?`,
      `Hello, I'm ${guardian.name}. ${patientName} is my ${getChildRelationship(guardian.relationship)} and I'm very worried. ${getAgeAppropriateDescription(patientAge, true)} has been ${chiefComplaint.toLowerCase()}. As ${getAgeAppropriateDescription(patientAge, true)} ${guardian.relationship}, I need to understand what's happening.`
    ],
    
    'anxious and seeking reassurance': [
      `Hi doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I'm really scared because ${getAgeAppropriateDescription(patientAge)} has been ${chiefComplaint.toLowerCase()}. I don't know what to do and I'm hoping you can tell me ${getAgeAppropriateDescription(patientAge, true)} is going to be alright. Please help us.`,
      `Doctor, I'm ${guardian.name}. I'm so worried about my ${getChildRelationship(guardian.relationship)} ${patientName}. ${getAgeAppropriateDescription(patientAge, true)} has been ${chiefComplaint.toLowerCase()} and I'm scared something is really wrong. Can you please examine ${getAgeAppropriateDescription(patientAge, true)} and tell me what's happening?`
    ],
    
    'analytical but worried': [
      `Hello doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I've been observing ${getAgeAppropriateDescription(patientAge)} carefully, and ${getAgeAppropriateDescription(patientAge, true)} has been experiencing ${chiefComplaint.toLowerCase()}. I've documented the symptoms and timeline. What additional information do you need to make a diagnosis?`,
      `Hi, I'm ${guardian.name}. ${patientName} is my ${getChildRelationship(guardian.relationship)}. I work as a ${guardian.occupation}, so I tend to be methodical about these things. ${getAgeAppropriateDescription(patientAge, true)} has been ${chiefComplaint.toLowerCase()}, and I'd like to understand the possible causes and diagnostic approach.`
    ],
    
    'concerned and organized': [
      `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I've brought ${getAgeAppropriateDescription(patientAge)} in because ${getAgeAppropriateDescription(patientAge, true)} has been ${chiefComplaint.toLowerCase()}. I have all ${getAgeAppropriateDescription(patientAge, true)} medical records with me. What's our next step to figure this out?`,
      `Hello, I'm ${guardian.name}. ${patientName} is my ${getChildRelationship(guardian.relationship)} and I'm concerned about ${getAgeAppropriateDescription(patientAge, true)} condition. ${getAgeAppropriateDescription(patientAge, true)} has been ${chiefComplaint.toLowerCase()}. I need to understand what we're dealing with and what the treatment plan will be.`
    ],
    
    'protective and direct': [
      `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. My ${getChildRelationship(guardian.relationship)} has been ${chiefComplaint.toLowerCase()} and I need to know what's wrong with ${getAgeAppropriateDescription(patientAge, true)}. Is ${getAgeAppropriateDescription(patientAge, true)} going to be okay?`,
      `Hi, I'm ${guardian.name}. ${patientName} is my ${getChildRelationship(guardian.relationship)} and ${getAgeAppropriateDescription(patientAge, true)} has been ${chiefComplaint.toLowerCase()}. I just want to know - is this serious? What do we need to do to help ${getAgeAppropriateDescription(patientAge, true)}?`
    ],
    
    'concerned but respectful of teen\'s autonomy': [
      `Hello doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. ${patientName} is ${patientAge} and has been ${chiefComplaint.toLowerCase()}. I want to be involved in ${getAgeAppropriateDescription(patientAge, true)} care, but I also respect that ${getAgeAppropriateDescription(patientAge, true)} is old enough to be part of these conversations. How should we proceed?`,
      `Hi, I'm ${guardian.name}. My ${getChildRelationship(guardian.relationship)} ${patientName} is ${patientAge} and has been experiencing ${chiefComplaint.toLowerCase()}. I'm concerned, but I also want to make sure ${getAgeAppropriateDescription(patientAge, true)} feels comfortable being part of this discussion about ${getAgeAppropriateDescription(patientAge, true)} health.`
    ],
    
    'worried but trying to stay calm for teen': [
      `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. ${patientName} is ${patientAge} and has been ${chiefComplaint.toLowerCase()}. I'm trying to stay calm for ${getAgeAppropriateDescription(patientAge, true)}, but I'm quite worried. Can you help us understand what might be going on?`,
      `Hello, I'm ${guardian.name}. My ${getChildRelationship(guardian.relationship)} ${patientName} is ${patientAge} and has been ${chiefComplaint.toLowerCase()}. I don't want to alarm ${getAgeAppropriateDescription(patientAge, true)}, but I'm concerned about these symptoms. What do you think?`
    ],
    
    'very protective and experienced': [
      `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I've raised many children, and I know when something isn't right. ${patientName} is ${patientAge} and has been ${chiefComplaint.toLowerCase()}. I've seen this kind of thing before, and I'm concerned. What are you going to do to help ${getAgeAppropriateDescription(patientAge, true)}?`,
      `Hello, I'm ${guardian.name}. I'm ${patientName}'s ${guardian.relationship} and primary caregiver. ${getAgeAppropriateDescription(patientAge, true)} has been ${chiefComplaint.toLowerCase()}, and with my experience, I can tell this needs attention. What's your assessment?`
    ]
  };
  
  // Get appropriate prompts for this guardian's emotional state
  const statePrompts = promptTemplates[guardian.emotional_state] || promptTemplates['concerned and protective'];
  
  // Return a random prompt from the appropriate category
  return statePrompts[Math.floor(Math.random() * statePrompts.length)];
}

// Helper function to get age-appropriate descriptions
function getAgeAppropriateDescription(age, pronoun = false) {
  if (pronoun) {
    if (age <= 2) return 'he/she';
    if (age <= 5) return 'he/she';
    if (age <= 12) return 'he/she';
    return 'he/she';
  }
  
  if (age <= 2) return `my ${age}-year-old baby`;
  if (age <= 5) return `my ${age}-year-old`;
  if (age <= 12) return `my ${age}-year-old child`;
  return `my ${age}-year-old`;
}

// Helper function to get child relationship term
function getChildRelationship(guardianRelationship) {
  switch (guardianRelationship) {
    case 'mother':
    case 'father':
      return 'child';
    case 'grandmother':
    case 'grandfather':
      return 'grandchild';
    case 'guardian':
      return 'child';
    default:
      return 'child';
  }
}

async function updatePediatricPrompts() {
  try {
    console.log('🔍 Searching for pediatric cases with guardian information...\n');
    
    // Find all pediatric cases that have guardian information
    const pediatricCases = await Case.find({
      'patient_persona.is_pediatric': true,
      'patient_persona.guardian': { $exists: true }
    });
    
    console.log(`📊 Found ${pediatricCases.length} pediatric cases with guardian information\n`);
    
    if (pediatricCases.length === 0) {
      console.log('ℹ️  No pediatric cases with guardian information found.');
      console.log('💡 Run updatePediatricCases.js first to add guardian information to existing cases.');
      return;
    }
    
    let updatedCount = 0;
    
    for (const caseDoc of pediatricCases) {
      const caseId = caseDoc.case_metadata?.case_id || caseDoc._id;
      const patientName = caseDoc.patient_persona?.name || 'Patient';
      const guardianName = caseDoc.patient_persona?.guardian?.name || 'Guardian';
      
      console.log(`\n🔄 Processing case: ${caseId} - ${caseDoc.case_metadata?.title}`);
      console.log(`   Patient: ${patientName}`);
      console.log(`   Guardian: ${guardianName} (${caseDoc.patient_persona.guardian.relationship})`);
      
      // Generate new guardian-appropriate initial prompt
      const newPrompt = generateGuardianPrompt(caseDoc);
      
      console.log(`   📝 Updating initial prompt...`);
      console.log(`   💬 New prompt: "${newPrompt.substring(0, 100)}..."`);
      
      // Update the case with new initial prompt
      const updateResult = await Case.updateOne(
        { _id: caseDoc._id },
        {
          $set: {
            'initial_prompt': newPrompt
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`   ✅ Successfully updated prompt for case ${caseId}`);
        updatedCount++;
      } else {
        console.log(`   ❌ Failed to update prompt for case ${caseId}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 PROMPT UPDATE SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Prompts updated: ${updatedCount}`);
    console.log(`📊 Total cases processed: ${pediatricCases.length}`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 Successfully updated initial prompts for pediatric cases!');
      console.log('\n📋 What was updated:');
      console.log('   • Initial prompts now reflect guardian speaking');
      console.log('   • Prompts match guardian\'s emotional state');
      console.log('   • Age-appropriate language and concerns');
      console.log('   • Guardian relationship and communication style');
      
      console.log('\n🔄 Next steps:');
      console.log('   1. Restart your application');
      console.log('   2. Start a pediatric simulation');
      console.log('   3. Notice the initial message is from the guardian');
      console.log('   4. Observe guardian-appropriate responses throughout');
    }
    
  } catch (error) {
    console.error('❌ Error updating pediatric prompts:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
updatePediatricPrompts();