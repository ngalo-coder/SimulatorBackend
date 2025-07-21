import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from '../src/models/CaseModel.js';
import connectDB from '../src/config/db.js';

// Load environment variables
dotenv.config();

console.log('🏥 PEDIATRIC GUARDIAN FEATURE SETUP');
console.log('=' .repeat(50));
console.log('This script will update your existing database to support');
console.log('the pediatric guardian feature by:');
console.log('1. Adding guardian information to pediatric cases');
console.log('2. Updating initial prompts to reflect guardian responses');
console.log('3. Adding pediatric-specific evaluation criteria');
console.log('=' .repeat(50));
console.log('');

// Connect to MongoDB
await connectDB();

// Guardian profiles for different types of pediatric cases
const guardianProfiles = {
  // For very young children (0-5 years)
  youngChild: [
    {
      name: "Jennifer Smith",
      relationship: "mother",
      age: 28,
      occupation: "Nurse",
      emotional_state: "very worried but medically informed",
      background_info: "First-time mother, works in healthcare so has medical knowledge but still anxious about her child",
      communication_style: "detailed and asks specific medical questions, wants to understand everything"
    },
    {
      name: "Michael Johnson",
      relationship: "father",
      age: 32,
      occupation: "Teacher",
      emotional_state: "concerned and protective",
      background_info: "Experienced father of two, calm but vigilant about children's health",
      communication_style: "straightforward, asks practical questions about care and recovery"
    },
    {
      name: "Maria Rodriguez",
      relationship: "mother",
      age: 25,
      occupation: "Store Manager",
      emotional_state: "anxious and seeking reassurance",
      background_info: "Young mother, relies on family support, wants clear explanations",
      communication_style: "needs reassurance, asks about what to expect and when to worry"
    }
  ],
  
  // For school-age children (6-12 years)
  schoolAge: [
    {
      name: "David Chen",
      relationship: "father",
      age: 38,
      occupation: "Engineer",
      emotional_state: "analytical but worried",
      background_info: "Methodical parent who researches medical conditions, wants detailed explanations",
      communication_style: "asks detailed questions, wants to understand the science behind the diagnosis"
    },
    {
      name: "Lisa Thompson",
      relationship: "mother",
      age: 35,
      occupation: "Marketing Manager",
      emotional_state: "concerned and organized",
      background_info: "Busy working mother, efficient communicator, wants clear action plans",
      communication_style: "focused on practical next steps, timeline for recovery, and impact on school"
    },
    {
      name: "Robert Williams",
      relationship: "father",
      age: 41,
      occupation: "Construction Foreman",
      emotional_state: "protective and direct",
      background_info: "Hands-on father, prefers simple explanations, very protective of his children",
      communication_style: "direct questions, wants to know if child will be okay, prefers simple terms"
    }
  ],
  
  // For teenagers (13-17 years)
  teenager: [
    {
      name: "Amanda Davis",
      relationship: "mother",
      age: 45,
      occupation: "School Principal",
      emotional_state: "concerned but respectful of teen's autonomy",
      background_info: "Experienced with teenagers, balances concern with respect for child's independence",
      communication_style: "asks about involving the teenager in decisions, concerned about privacy"
    },
    {
      name: "James Wilson",
      relationship: "father",
      age: 48,
      occupation: "Accountant",
      emotional_state: "worried but trying to stay calm for teen",
      background_info: "Father of three teenagers, understands adolescent psychology",
      communication_style: "asks about long-term effects, impact on teen's activities and future"
    },
    {
      name: "Patricia Brown",
      relationship: "grandmother",
      age: 62,
      occupation: "Retired Teacher",
      emotional_state: "very protective and experienced",
      background_info: "Primary caregiver for grandchild, experienced with child-rearing",
      communication_style: "asks thorough questions, wants to understand everything, very protective"
    }
  ]
};

// Function to get appropriate guardian based on child's age
function getGuardianForAge(age) {
  const profiles = guardianProfiles;
  
  if (age <= 5) {
    return profiles.youngChild[Math.floor(Math.random() * profiles.youngChild.length)];
  } else if (age <= 12) {
    return profiles.schoolAge[Math.floor(Math.random() * profiles.schoolAge.length)];
  } else {
    return profiles.teenager[Math.floor(Math.random() * profiles.teenager.length)];
  }
}

// Function to generate appropriate guardian name based on patient name
function generateGuardianName(patientName, relationship) {
  // Extract last name from patient name if possible
  const nameParts = patientName.split(' ');
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : 'Smith';
  
  const firstNames = {
    mother: ['Sarah', 'Jennifer', 'Lisa', 'Maria', 'Amanda', 'Patricia', 'Michelle', 'Karen', 'Susan'],
    father: ['Michael', 'David', 'Robert', 'James', 'John', 'William', 'Christopher', 'Daniel', 'Matthew'],
    grandmother: ['Patricia', 'Barbara', 'Susan', 'Dorothy', 'Helen', 'Nancy', 'Betty', 'Ruth', 'Carol'],
    grandfather: ['Robert', 'William', 'James', 'Charles', 'George', 'Frank', 'Edward', 'Henry', 'Walter']
  };
  
  const firstName = firstNames[relationship] 
    ? firstNames[relationship][Math.floor(Math.random() * firstNames[relationship].length)]
    : 'Guardian';
    
  return `${firstName} ${lastName}`;
}

// Function to generate guardian-appropriate initial prompts
function generateGuardianPrompt(caseDoc) {
  const patient = caseDoc.patient_persona;
  const guardian = patient.guardian;
  const chiefComplaint = patient.chief_complaint || 'not feeling well';
  const patientName = patient.name || 'my child';
  const patientAge = patient.age;
  
  // Different prompt styles based on guardian's emotional state
  const promptTemplates = {
    'very worried but medically informed': `Hello doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I work in healthcare myself, but I'm really concerned about ${patientName}. My ${patientAge}-year-old has been ${chiefComplaint.toLowerCase()}, and I'm worried this might be something serious. Can you help us figure out what's going on?`,
    
    'concerned and protective': `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I'm really concerned about my ${patientAge}-year-old. ${patientName} has been ${chiefComplaint.toLowerCase()}, and I just want to make sure they're going to be okay. What do you need to know?`,
    
    'anxious and seeking reassurance': `Hi doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I'm really scared because my ${patientAge}-year-old has been ${chiefComplaint.toLowerCase()}. I don't know what to do and I'm hoping you can tell me they're going to be alright. Please help us.`,
    
    'analytical but worried': `Hello doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I've been observing my ${patientAge}-year-old carefully, and they have been experiencing ${chiefComplaint.toLowerCase()}. I've documented the symptoms and timeline. What additional information do you need to make a diagnosis?`,
    
    'concerned and organized': `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I've brought my ${patientAge}-year-old in because they have been ${chiefComplaint.toLowerCase()}. I have all their medical records with me. What's our next step to figure this out?`,
    
    'protective and direct': `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. My child has been ${chiefComplaint.toLowerCase()} and I need to know what's wrong. Is ${patientName} going to be okay?`,
    
    'concerned but respectful of teen\'s autonomy': `Hello doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. ${patientName} is ${patientAge} and has been ${chiefComplaint.toLowerCase()}. I want to be involved in their care, but I also respect that they're old enough to be part of these conversations. How should we proceed?`,
    
    'worried but trying to stay calm for teen': `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. ${patientName} is ${patientAge} and has been ${chiefComplaint.toLowerCase()}. I'm trying to stay calm for them, but I'm quite worried. Can you help us understand what might be going on?`,
    
    'very protective and experienced': `Doctor, I'm ${guardian.name}, ${patientName}'s ${guardian.relationship}. I've raised many children, and I know when something isn't right. ${patientName} is ${patientAge} and has been ${chiefComplaint.toLowerCase()}. I've seen this kind of thing before, and I'm concerned. What are you going to do to help them?`
  };
  
  // Get appropriate prompt for this guardian's emotional state
  return promptTemplates[guardian.emotional_state] || promptTemplates['concerned and protective'];
}

async function setupPediatricFeature() {
  try {
    console.log('🔍 STEP 1: Searching for existing pediatric cases...\n');
    
    // Find all cases where patient age is less than 18 or specialty is Pediatrics
    const pediatricCases = await Case.find({
      $or: [
        { 'patient_persona.age': { $lt: 18 } },
        { 'case_metadata.specialty': 'Pediatrics' },
        { 'case_metadata.specialty': 'Paediatrics' }
      ]
    });
    
    console.log(`📊 Found ${pediatricCases.length} potential pediatric cases\n`);
    
    if (pediatricCases.length === 0) {
      console.log('ℹ️  No pediatric cases found in your database.');
      console.log('💡 Make sure you have cases with:');
      console.log('   - Patient age less than 18, OR');
      console.log('   - Specialty set to "Pediatrics"');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    console.log('🔄 STEP 2: Adding guardian information to pediatric cases...\n');
    
    for (const caseDoc of pediatricCases) {
      const caseId = caseDoc.case_metadata?.case_id || caseDoc._id;
      const patientName = caseDoc.patient_persona?.name || 'Patient';
      const patientAge = caseDoc.patient_persona?.age;
      
      console.log(`Processing: ${caseId} - ${caseDoc.case_metadata?.title}`);
      console.log(`Patient: ${patientName}, Age: ${patientAge}`);
      
      // Skip if already has guardian information
      if (caseDoc.patient_persona?.guardian) {
        console.log(`⏭️  Already has guardian information, skipping...\n`);
        skippedCount++;
        continue;
      }
      
      // Skip if patient age is not available or is adult
      if (!patientAge || patientAge >= 18) {
        console.log(`⏭️  Not a pediatric case (age: ${patientAge}), skipping...\n`);
        skippedCount++;
        continue;
      }
      
      // Get appropriate guardian profile for this age
      const guardianTemplate = getGuardianForAge(patientAge);
      
      // Create guardian with appropriate name
      const guardian = {
        ...guardianTemplate,
        name: generateGuardianName(patientName, guardianTemplate.relationship)
      };
      
      console.log(`👨‍👩‍👧‍👦 Adding guardian: ${guardian.name} (${guardian.relationship})`);
      
      // Update the case with guardian information
      await Case.updateOne(
        { _id: caseDoc._id },
        {
          $set: {
            'patient_persona.guardian': guardian,
            'patient_persona.is_pediatric': true,
            'patient_persona.pediatric_threshold': 18,
            'evaluation_criteria.Guardian_Interaction': 'Did the clinician appropriately interact with the guardian as the primary historian and decision-maker for the pediatric patient?'
          }
        }
      );
      
      console.log(`✅ Updated case ${caseId}\n`);
      updatedCount++;
    }
    
    console.log('🔄 STEP 3: Updating initial prompts to reflect guardian responses...\n');
    
    // Get updated cases with guardian information
    const casesWithGuardians = await Case.find({
      'patient_persona.is_pediatric': true,
      'patient_persona.guardian': { $exists: true }
    });
    
    let promptsUpdated = 0;
    
    for (const caseDoc of casesWithGuardians) {
      const caseId = caseDoc.case_metadata?.case_id || caseDoc._id;
      
      // Generate new guardian-appropriate initial prompt
      const newPrompt = generateGuardianPrompt(caseDoc);
      
      console.log(`📝 Updating prompt for ${caseId}...`);
      
      // Update the case with new initial prompt
      await Case.updateOne(
        { _id: caseDoc._id },
        {
          $set: {
            'initial_prompt': newPrompt
          }
        }
      );
      
      promptsUpdated++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PEDIATRIC GUARDIAN FEATURE SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log(`✅ Cases updated with guardian info: ${updatedCount}`);
    console.log(`✅ Initial prompts updated: ${promptsUpdated}`);
    console.log(`⏭️  Cases skipped: ${skippedCount}`);
    console.log(`📊 Total cases processed: ${pediatricCases.length}`);
    
    if (updatedCount > 0) {
      console.log('\n📋 What was added to each pediatric case:');
      console.log('   • Guardian name, relationship, and background');
      console.log('   • Guardian emotional state and communication style');
      console.log('   • Age-appropriate guardian responses');
      console.log('   • Updated initial prompts from guardian perspective');
      console.log('   • Pediatric-specific evaluation criteria');
      console.log('   • is_pediatric flag and threshold settings');
      
      console.log('\n🚀 Ready to test the pediatric guardian feature!');
      console.log('\n🔄 Next steps:');
      console.log('   1. Restart your application');
      console.log('   2. Navigate to case selection');
      console.log('   3. Look for pediatric cases (patients under 18)');
      console.log('   4. Start a pediatric simulation');
      console.log('   5. Notice the guardian information display');
      console.log('   6. Observe AI responding as the guardian');
      console.log('   7. Try asking questions like:');
      console.log('      - "Tell me about your child\'s symptoms"');
      console.log('      - "When did this start?"');
      console.log('      - "What are you most worried about?"');
      console.log('      - "Has your child had this before?"');
      
      console.log('\n💡 The AI will now respond as the parent/guardian instead of the child,');
      console.log('   making pediatric simulations much more realistic!');
    } else {
      console.log('\n💡 No pediatric cases were updated. This could mean:');
      console.log('   • All pediatric cases already have guardian information');
      console.log('   • No cases in your database have patients under 18');
      console.log('   • No cases have specialty set to "Pediatrics"');
    }
    
  } catch (error) {
    console.error('❌ Error setting up pediatric feature:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the setup
setupPediatricFeature();