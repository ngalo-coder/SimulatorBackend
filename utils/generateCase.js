// utils/generateCase.js

import Chance from 'chance';
const chance = new Chance();

const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

const hiddenDiagnoses = {
  "Chest pain": "Acute Myocardial Infarction",
  "Abdominal pain": "Appendicitis",
  "Headache": "Migraine",
  "Fever": "Malaria",
  "Shortness of breath": "Pneumonia",
  "Vaginal bleeding": "Ectopic Pregnancy",
  "Rash": "Allergic Reaction",
  "Jaundice": "Hepatitis",
  "Altered mental status": "Hypoglycemia",
  "Seizure": "Epilepsy"
};

const chiefComplaints = Object.keys(hiddenDiagnoses);

const emotionalTones = [
  "Visibly anxious and scared, speaks in short sentences.",
  "Quiet, withdrawn, avoids eye contact.",
  "Restless, agitated, irritable.",
  "Painful grimace, clutching abdomen.",
  "Fatigued, slow speech, drowsy."
];

const difficulties = ["Easy", "Intermediate", "Intermediate", "Hard"];

function generateCase(index, specialty, program_area) {
  const complaint = pickOne(chiefComplaints);
  const gender = pickOne(["Male", "Female"]);
  const isPediatric = specialty.toLowerCase().includes("pediatric");

  const age = isPediatric ? String(chance.age({ min: 1, max: 17 })) : String(chance.age({ min: 18, max: 80 }));

  return {
    version: "3.1-program-aware",
    description: "Program-specific AI-generated virtual patient case.",
    system_instruction: "You are a highly realistic AI-simulated patient for a medical training application. You must portray the patient as defined below and strictly adhere to the specialty of '" + specialty + "'. Never introduce symptoms or diagnoses outside this area. Only reveal what is asked for. Avoid offering medical suggestions or diagnosis.",
    case_metadata: {
      program_area,
      case_id: `VP-${specialty.toUpperCase().replace(/\s+/g, '_')}-${String(index).padStart(4, '0')}`,
      title: `${age}-Year-Old ${gender} with ${complaint}`,
      specialty,
      difficulty: pickOne(difficulties),
      tags: [complaint.toLowerCase(), specialty.toLowerCase(), "clinical reasoning"]
    },
    patient_persona: {
      name: chance.name(),
      age,
      gender,
      occupation: chance.profession(),
      chief_complaint: complaint,
      emotional_tone: pickOne(emotionalTones),
      background_story: `Was at ${chance.sentence({ words: 4 }).toLowerCase()} when the symptoms started.`
    },
    initial_prompt: "You are now interacting with a virtual patient. Begin by asking your clinical questions.",
    clinical_dossier: {
      hidden_diagnosis: hiddenDiagnoses[complaint] || "To be filled",
      history_of_presenting_illness: {
        onset: "Started suddenly about 1 hour ago.",
        location: complaint.includes("chest") ? "chest" :
                 complaint.includes("abdominal") ? "abdomen" :
                 complaint.includes("head") ? "head" : "unspecified",
        radiation: "",
        character: "Sharp",
        severity: "7/10",
        timing_and_duration: "Constant",
        exacerbating_factors: "Movement",
        relieving_factors: "Rest",
        associated_symptoms: []
      },
      review_of_systems: {
        positive: [],
        negative: []
      },
      past_medical_history: [],
      medications: [],
      allergies: [],
      surgical_history: [],
      family_history: [],
      social_history: {}
    },
    simulation_triggers: {
      end_session: {
        condition_keyword: "diagnosis",
        patient_response: "Thank you, doctor. So, what do you think is going on with me?"
      }
    },
    evaluation_criteria: {
      History_Taking: "Did the user fully characterize the main complaint?",
      Risk_Factor_Assessment: "Were relevant risk factors discussed?",
      Differential_Diagnosis_Questioning: "Were alternative diagnoses considered?",
      Communication_and_Empathy: "Was the tone appropriate for the patient's condition?",
      Clinical_Urgency: "Was urgency addressed correctly?"
    }
  };
}

export default generateCase;
