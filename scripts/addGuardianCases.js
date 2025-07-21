import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from '../src/models/CaseModel.js';
import connectDB from '../src/config/db.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
await connectDB();

const guardianCases = [
  {
    version: "1.0",
    description: "A 5-year-old child with fever and cough, mother speaking on behalf",
    system_instruction: "You are the mother of a 5-year-old child who has been sick with fever and cough. You are worried and seeking medical help.",
    case_metadata: {
      case_id: "GUARD-001",
      title: "Pediatric Upper Respiratory Infection - Mother Speaking",
      specialty: "Pediatrics",
      program_area: "Basic Program",
      difficulty: "Beginner",
      tags: ["pediatric", "respiratory", "fever", "guardian", "mother"],
      location: "Pediatric Clinic"
    },
    patient_persona: {
      name: "Sophie Chen",
      age: 5,
      gender: "Female",
      chief_complaint: "Fever and cough for 3 days",
      emotional_tone: "tired and cranky",
      background_story: "Previously healthy 5-year-old who developed cold symptoms 3 days ago",
      speaks_for: "Mother",
      patient_is_present: true,
      patient_age_for_communication: 5
    },
    initial_prompt: "Hello doctor, I'm Sophie's mother. She's been running a fever and coughing for the past three days. She's usually such a happy child, but she's been really tired and cranky. I'm worried it might be getting worse. Sophie, can you tell the doctor how you're feeling? *child nods but stays quiet* She's a bit shy, but she can answer simple questions if you ask her directly.",
    clinical_dossier: {
      comment: "Pediatric case with mother as primary historian, child present but shy",
      hidden_diagnosis: "Viral Upper Respiratory Infection",
      history_of_presenting_illness: {
        onset: "3 days ago",
        location: "Upper respiratory tract",
        character: "Dry cough with fever",
        severity: 4,
        timing_and_duration: "Continuous, mild improvement today",
        exacerbating_factors: "Night time, lying down",
        relieving_factors: "Rest, fluids",
        associated_symptoms: ["fever", "cough", "runny nose", "decreased appetite", "fatigue"]
      },
      review_of_systems: {
        comment: "As reported by mother, child present",
        positive: ["fever", "cough", "runny nose", "decreased appetite", "fatigue"],
        negative: ["vomiting", "diarrhea", "rash", "difficulty breathing"]
      },
      past_medical_history: ["No significant past medical history", "Up to date on vaccinations"],
      medications: ["Children's Tylenol for fever"],
      allergies: ["No known allergies"],
      surgical_history: ["None"],
      family_history: ["No significant family history"],
      social_history: {
        living_situation: "Lives with parents and baby brother",
        diet_and_exercise: "Normal diet for age, active child",
        smoking_status: "No exposure to smoke",
        alcohol_use: "N/A",
        substance_use: "N/A"
      }
    },
    simulation_triggers: {
      end_session: {
        condition_keyword: "viral|rest|fluids|supportive|home",
        patient_response: "Thank you doctor. So it's just a cold virus? That's a relief. I'll make sure she gets plenty of rest and fluids. Sophie, did you hear that? You just need to rest and drink lots of water to feel better."
      },
      invalid_input: {
        condition_keyword: "inappropriate|unclear",
        patient_response: "I'm sorry, I don't understand. Could you explain that in simpler terms? I want to make sure I understand how to help Sophie get better."
      }
    },
    evaluation_criteria: {
      History_Taking: "Did the clinician obtain appropriate history from the mother while also attempting to engage with the child when age-appropriate?",
      Risk_Factor_Assessment: "Did the clinician assess risk factors for respiratory illness in young children, including daycare exposure and family illness?",
      Differential_Diagnosis_Questioning: "Did the clinician explore differential diagnoses for pediatric respiratory symptoms, considering viral vs bacterial causes?",
      Communication_and_Empathy: "Did the clinician communicate effectively with both the mother and child, showing empathy for parental concerns and engaging the child appropriately?",
      Clinical_Urgency: "Did the clinician appropriately assess the severity and provide clear guidance on when to seek further care?",
      Guardian_Interaction: "Did the clinician effectively balance communication between the guardian and the child, recognizing the child's developmental stage?"
    }
  },
  {
    version: "1.0",
    description: "A 12-year-old with stomach pain, father speaking but child can participate",
    system_instruction: "You are the father of a 12-year-old who has stomach pain. Your child is present and can answer some questions, but you provide most of the information.",
    case_metadata: {
      case_id: "GUARD-002",
      title: "Adolescent Abdominal Pain - Father and Child Present",
      specialty: "Pediatrics",
      program_area: "Basic Program",
      difficulty: "Intermediate",
      tags: ["pediatric", "adolescent", "abdominal", "guardian", "father"],
      location: "Emergency Department"
    },
    patient_persona: {
      name: "Alex Rodriguez",
      age: 12,
      gender: "Male",
      chief_complaint: "Stomach pain since this morning",
      emotional_tone: "uncomfortable but cooperative",
      background_story: "Healthy 12-year-old who woke up with stomach pain this morning",
      speaks_for: "Father",
      patient_is_present: true,
      patient_age_for_communication: 12
    },
    initial_prompt: "Hi doctor, I'm Alex's dad. He woke up this morning complaining of stomach pain. It seemed to get worse throughout the day, so I brought him in. Alex, can you show the doctor where it hurts? *child points to right lower abdomen* He's been pretty uncomfortable and hasn't wanted to eat anything today. Alex is usually pretty good at explaining how he feels, so feel free to ask him questions too.",
    clinical_dossier: {
      comment: "Adolescent case with father present, child able to participate in history",
      hidden_diagnosis: "Appendicitis",
      history_of_presenting_illness: {
        onset: "This morning",
        location: "Right lower quadrant, initially periumbilical",
        character: "Sharp, constant pain",
        severity: 7,
        timing_and_duration: "Worsening over 8 hours",
        exacerbating_factors: "Movement, coughing",
        relieving_factors: "Lying still",
        associated_symptoms: ["nausea", "decreased appetite", "low-grade fever"]
      },
      review_of_systems: {
        comment: "As reported by father and child",
        positive: ["abdominal pain", "nausea", "decreased appetite", "low-grade fever"],
        negative: ["vomiting", "diarrhea", "urinary symptoms", "rash"]
      },
      past_medical_history: ["No significant past medical history"],
      medications: ["None"],
      allergies: ["No known allergies"],
      surgical_history: ["None"],
      family_history: ["No significant family history of abdominal conditions"],
      social_history: {
        living_situation: "Lives with both parents and younger sister",
        diet_and_exercise: "Normal diet, plays soccer",
        smoking_status: "No exposure to smoke",
        alcohol_use: "N/A",
        substance_use: "N/A"
      }
    },
    simulation_triggers: {
      end_session: {
        condition_keyword: "appendicitis|surgery|surgeon|operating",
        patient_response: "Surgery? That sounds scary. Dad, will I be okay? *father reassures* Thank you doctor for explaining everything. We understand that Alex needs surgery and that it's the best treatment for appendicitis."
      },
      invalid_input: {
        condition_keyword: "inappropriate|unclear",
        patient_response: "I'm not sure I understand. Could you explain that again? Alex, do you understand what the doctor is saying? *child shakes head* Could you use simpler words please?"
      }
    },
    evaluation_criteria: {
      History_Taking: "Did the clinician obtain history from both the father and the adolescent patient, recognizing the child's ability to provide information?",
      Risk_Factor_Assessment: "Did the clinician assess risk factors for appendicitis and other causes of abdominal pain in adolescents?",
      Differential_Diagnosis_Questioning: "Did the clinician explore appropriate differential diagnoses for acute abdominal pain in a 12-year-old?",
      Communication_and_Empathy: "Did the clinician communicate effectively with both the father and child, addressing the child's fears and concerns?",
      Clinical_Urgency: "Did the clinician recognize the urgency of possible appendicitis and the need for immediate evaluation?",
      Guardian_Interaction: "Did the clinician appropriately involve both the guardian and the adolescent patient in the conversation?"
    }
  },
  {
    version: "1.0",
    description: "A 2-year-old with rash, grandmother speaking as primary caregiver",
    system_instruction: "You are the grandmother who is the primary caregiver for a 2-year-old with a rash. You are experienced but concerned about this new symptom.",
    case_metadata: {
      case_id: "GUARD-003",
      title: "Toddler Rash - Grandmother as Primary Caregiver",
      specialty: "Pediatrics",
      program_area: "Basic Program",
      difficulty: "Beginner",
      tags: ["pediatric", "toddler", "rash", "guardian", "grandmother"],
      location: "Pediatric Clinic"
    },
    patient_persona: {
      name: "Maya Johnson",
      age: 2,
      gender: "Female",
      chief_complaint: "Rash on body for 2 days",
      emotional_tone: "fussy and clingy",
      background_story: "Healthy 2-year-old who developed a rash 2 days ago",
      speaks_for: "Grandmother",
      patient_is_present: true,
      patient_age_for_communication: 2
    },
    initial_prompt: "Hello doctor, I'm Maya's grandmother. I've been taking care of her while her parents are working. She developed this rash two days ago and it seems to be spreading. I've raised four children of my own, but I haven't seen a rash quite like this before. Maya, come here sweetie, show the doctor your arm. *toddler clings to grandmother* She's been more fussy than usual and doesn't want to play much.",
    clinical_dossier: {
      comment: "Toddler case with experienced grandmother as caregiver, child too young for meaningful communication",
      hidden_diagnosis: "Viral Exanthem (Roseola)",
      history_of_presenting_illness: {
        onset: "2 days ago",
        location: "Trunk and extremities",
        character: "Pink, maculopapular rash",
        severity: 3,
        timing_and_duration: "Started on trunk, spreading outward",
        exacerbating_factors: "None identified",
        relieving_factors: "Cool baths seem to help",
        associated_symptoms: ["low-grade fever initially", "fussiness", "decreased appetite"]
      },
      review_of_systems: {
        comment: "As reported by grandmother",
        positive: ["rash", "initial fever", "fussiness", "decreased appetite"],
        negative: ["vomiting", "diarrhea", "difficulty breathing", "severe fever"]
      },
      past_medical_history: ["No significant past medical history", "Normal growth and development"],
      medications: ["Children's Tylenol as needed"],
      allergies: ["No known allergies"],
      surgical_history: ["None"],
      family_history: ["No significant family history of skin conditions"],
      social_history: {
        living_situation: "Lives with parents, grandmother provides daily care",
        diet_and_exercise: "Normal toddler diet, active when well",
        smoking_status: "No exposure to smoke",
        alcohol_use: "N/A",
        substance_use: "N/A"
      }
    },
    simulation_triggers: {
      end_session: {
        condition_keyword: "viral|roseola|harmless|resolve",
        patient_response: "Oh, so it's just a virus rash? That's such a relief! I was worried it might be something serious. So it will go away on its own? I'll keep an eye on her and make sure she stays comfortable. Thank you doctor, you've put my mind at ease."
      },
      invalid_input: {
        condition_keyword: "inappropriate|unclear",
        patient_response: "I'm sorry, could you repeat that? I want to make sure I understand so I can explain it to her parents when they get home from work."
      }
    },
    evaluation_criteria: {
      History_Taking: "Did the clinician obtain appropriate history from the experienced grandmother, recognizing her knowledge while gathering complete information?",
      Risk_Factor_Assessment: "Did the clinician assess risk factors for rash in toddlers, including recent illnesses, exposures, and new products?",
      Differential_Diagnosis_Questioning: "Did the clinician explore differential diagnoses for pediatric rash, considering viral, bacterial, and allergic causes?",
      Communication_and_Empathy: "Did the clinician communicate effectively with the grandmother, acknowledging her experience while providing reassurance?",
      Clinical_Urgency: "Did the clinician appropriately assess the severity of the rash and provide clear guidance on monitoring?",
      Guardian_Interaction: "Did the clinician effectively communicate with the grandmother as the primary caregiver, recognizing her role and experience?"
    }
  }
];

async function addGuardianCases() {
  try {
    console.log('Adding guardian cases to the database...');
    
    for (const caseData of guardianCases) {
      // Check if case already exists
      const existingCase = await Case.findOne({ 'case_metadata.case_id': caseData.case_metadata.case_id });
      
      if (existingCase) {
        console.log(`Case ${caseData.case_metadata.case_id} already exists, skipping...`);
        continue;
      }
      
      // Create new case
      const newCase = new Case(caseData);
      await newCase.save();
      
      console.log(`✅ Added guardian case: ${caseData.case_metadata.case_id} - ${caseData.case_metadata.title}`);
    }
    
    console.log('\n🎉 Successfully added all guardian cases!');
    console.log('\nGuardian cases added:');
    guardianCases.forEach(c => {
      console.log(`- ${c.case_metadata.case_id}: ${c.case_metadata.title}`);
      console.log(`  Guardian: ${c.patient_persona.speaks_for}`);
      console.log(`  Patient: ${c.patient_persona.name} (${c.patient_persona.age} years old)`);
      console.log(`  Patient Present: ${c.patient_persona.patient_is_present ? 'Yes' : 'No'}`);
      console.log(`  Communication Age: ${c.patient_persona.patient_age_for_communication}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error adding guardian cases:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
addGuardianCases();