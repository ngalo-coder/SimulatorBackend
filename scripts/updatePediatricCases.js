import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from '../src/models/CaseModel.js';
import connectDB from '../src/config/db.js';

// Load environment variables
dotenv.config();

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

async function updatePediatricCases() {
  try {
    console.log('🔍 Searching for existing pediatric cases in the database...\n');
    
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
      console.log('ℹ️  No pediatric cases found to update.');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const caseDoc of pediatricCases) {
      const caseId = caseDoc.case_metadata?.case_id || caseDoc._id;
      const patientName = caseDoc.patient_persona?.name || 'Patient';
      const patientAge = caseDoc.patient_persona?.age;
      
      console.log(`\n🔄 Processing case: ${caseId} - ${caseDoc.case_metadata?.title}`);
      console.log(`   Patient: ${patientName}, Age: ${patientAge}`);
      
      // Skip if already has guardian information
      if (caseDoc.patient_persona?.guardian) {
        console.log(`   ⏭️  Already has guardian information, skipping...`);
        skippedCount++;
        continue;
      }
      
      // Skip if patient age is not available or is adult
      if (!patientAge || patientAge >= 18) {
        console.log(`   ⏭️  Not a pediatric case (age: ${patientAge}), skipping...`);
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
      
      console.log(`   👨‍👩‍👧‍👦 Adding guardian: ${guardian.name} (${guardian.relationship})`);
      
      // Update the case with guardian information
      const updateResult = await Case.updateOne(
        { _id: caseDoc._id },
        {
          $set: {
            'patient_persona.guardian': guardian,
            'patient_persona.is_pediatric': true,
            'patient_persona.pediatric_threshold': 18
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`   ✅ Successfully updated case ${caseId}`);
        updatedCount++;
        
        // Update evaluation criteria to include guardian interaction
        await Case.updateOne(
          { _id: caseDoc._id },
          {
            $set: {
              'evaluation_criteria.Guardian_Interaction': 'Did the clinician appropriately interact with the guardian as the primary historian and decision-maker for the pediatric patient?'
            }
          }
        );
        
      } else {
        console.log(`   ❌ Failed to update case ${caseId}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 UPDATE SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Cases updated: ${updatedCount}`);
    console.log(`⏭️  Cases skipped: ${skippedCount}`);
    console.log(`📊 Total cases processed: ${pediatricCases.length}`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 Successfully updated pediatric cases with guardian information!');
      console.log('\n📋 What was added to each case:');
      console.log('   • Guardian name and relationship');
      console.log('   • Guardian age and occupation');
      console.log('   • Emotional state and communication style');
      console.log('   • Background information');
      console.log('   • is_pediatric flag set to true');
      console.log('   • pediatric_threshold set to 18');
      console.log('   • Guardian interaction evaluation criteria');
      
      console.log('\n🔄 Next steps:');
      console.log('   1. Restart your application');
      console.log('   2. Navigate to case selection');
      console.log('   3. Look for pediatric cases (patients under 18)');
      console.log('   4. Start a pediatric simulation');
      console.log('   5. Notice the guardian information display');
      console.log('   6. Observe AI responding as the guardian');
    }
    
  } catch (error) {
    console.error('❌ Error updating pediatric cases:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
updatePediatricCases();