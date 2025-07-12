import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import Case from '../src/models/CaseModel.js';
import logger from '../src/config/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load case template
const caseTemplatePath = path.join(__dirname, '../case_template/case_template.json');
const caseTemplate = JSON.parse(fs.readFileSync(caseTemplatePath, 'utf8'));

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Program areas and specialties mapping
// Program areas and specialties mapping - using exact values from the schema comments
const programSpecialties = {
  "Basic Program": [
    "Internal Medicine",
    "Surgery",
    "Pediatrics",
    "Obstetrics and Gynaecology",
    "Community Health",
    "Family Medicine"
  ],
  "Specialty Program": [
    "Ophthalmology",
    "ENT",
    "Dermatology",
    "Psychiatry",
    "Radiology",
    "Anesthesiology",
    "Pathology",
    "Emergency Medicine",
    "Orthopedics",
    "Neurology",
    "Urology",
    "Nephrology",
    "Cardiology",
    "Oncology",
    "Infectious Diseases",
    "Reproductive Health",
    "Geriatrics"
  ]
};

// Common names for different genders
const names = {
  male: [
    "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
    "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kenneth",
    "Kevin", "Brian", "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Ryan", "Jacob",
    "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon", "Benjamin",
    "Samuel", "Gregory", "Alexander", "Patrick", "Frank", "Raymond", "Jack", "Dennis", "Jerry", "Tyler"
  ],
  female: [
    "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen",
    "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle",
    "Carol", "Amanda", "Dorothy", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia",
    "Kathleen", "Amy", "Angela", "Shirley", "Anna", "Brenda", "Pamela", "Emma", "Nicole", "Helen",
    "Samantha", "Katherine", "Christine", "Debra", "Rachel", "Carolyn", "Janet", "Catherine", "Maria", "Heather"
  ]
};

// Last names
const lastNames = [
  "Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor",
  "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson",
  "Clark", "Rodriguez", "Lewis", "Lee", "Walker", "Hall", "Allen", "Young", "Hernandez", "King",
  "Wright", "Lopez", "Hill", "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter",
  "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins"
];

// Occupations
const occupations = {
  adult: [
    "Teacher", "Engineer", "Doctor", "Nurse", "Accountant", "Lawyer", "Chef", "Electrician", "Plumber", "Carpenter",
    "Mechanic", "Farmer", "Police Officer", "Firefighter", "Salesperson", "Manager", "Office Worker", "Driver", "Cashier", "Waiter/Waitress",
    "Construction Worker", "Janitor", "Security Guard", "Hairdresser", "Artist", "Musician", "Writer", "Journalist", "Photographer", "Graphic Designer",
    "Software Developer", "IT Specialist", "Pharmacist", "Dentist", "Veterinarian", "Architect", "Pilot", "Flight Attendant", "Banker", "Real Estate Agent",
    "Social Worker", "Psychologist", "Librarian", "Scientist", "Researcher", "Professor", "Student", "Retired", "Unemployed", "Self-employed"
  ],
  child: [
    "Student", "Preschooler", "Kindergartener", "Elementary School Student", "Middle School Student", "High School Student",
    "Not in school yet", "Homeschooled", "Daycare attendee"
  ],
  elderly: [
    "Retired Teacher", "Retired Engineer", "Retired Doctor", "Retired Nurse", "Retired Accountant", "Retired Lawyer",
    "Retired", "Pensioner", "Former Business Owner", "Homemaker"
  ]
};

// Emotional tones
const emotionalTones = [
  "Anxious", "Worried", "Scared", "Nervous", "Calm", "Relaxed", "Irritable", "Angry", "Frustrated", "Impatient",
  "Sad", "Depressed", "Hopeful", "Optimistic", "Confused", "Disoriented", "Embarrassed", "Ashamed", "Indifferent", "Stoic"
];

// Common symptoms by specialty
const specialtySymptoms = {
  "Internal Medicine": {
    complaints: ["Chest pain", "Shortness of breath", "Abdominal pain", "Fatigue", "Fever", "Headache", "Dizziness", "Nausea", "Vomiting", "Diarrhea"],
    diagnoses: ["Hypertension", "Diabetes Mellitus", "Pneumonia", "Gastritis", "Peptic Ulcer Disease", "Urinary Tract Infection", "Anemia", "Hypothyroidism", "Asthma", "COPD"]
  },
  "Surgery": {
    complaints: ["Abdominal pain", "Lump or mass", "Wound infection", "Post-operative pain", "Hernia", "Rectal bleeding", "Difficulty swallowing", "Jaundice", "Vomiting", "Constipation"],
    diagnoses: ["Appendicitis", "Cholecystitis", "Intestinal Obstruction", "Hernia", "Diverticulitis", "Colorectal Cancer", "Breast Cancer", "Skin Cancer", "Peripheral Vascular Disease", "Hemorrhoids"]
  },
  "Pediatrics": {
    complaints: ["Fever", "Cough", "Runny nose", "Ear pain", "Sore throat", "Rash", "Vomiting", "Diarrhea", "Abdominal pain", "Poor feeding"],
    diagnoses: ["Upper Respiratory Tract Infection", "Otitis Media", "Gastroenteritis", "Bronchiolitis", "Asthma", "Pneumonia", "Urinary Tract Infection", "Eczema", "Chickenpox", "Meningitis"]
  },
  "Obstetrics and Gynaecology": {
    complaints: ["Abdominal pain", "Vaginal bleeding", "Vaginal discharge", "Pelvic pain", "Menstrual irregularities", "Pregnancy symptoms", "Breast lump", "Urinary symptoms", "Infertility", "Hot flashes"],
    diagnoses: ["Pregnancy", "Preeclampsia", "Gestational Diabetes", "Placenta Previa", "Endometriosis", "Polycystic Ovary Syndrome", "Uterine Fibroids", "Ovarian Cysts", "Cervical Cancer", "Menopause"]
  },
  "Ophthalmology": {
    complaints: ["Eye pain", "Redness in eye", "Vision changes", "Blurry vision", "Double vision", "Dry eyes", "Watery eyes", "Floaters", "Light sensitivity", "Eye discharge"],
    diagnoses: ["Conjunctivitis", "Cataract", "Glaucoma", "Macular Degeneration", "Diabetic Retinopathy", "Dry Eye Syndrome", "Corneal Ulcer", "Retinal Detachment", "Uveitis", "Strabismus"]
  },
  "ENT": {
    complaints: ["Ear pain", "Hearing loss", "Tinnitus", "Sore throat", "Difficulty swallowing", "Hoarseness", "Nasal congestion", "Nosebleed", "Facial pain", "Snoring"],
    diagnoses: ["Otitis Media", "Otitis Externa", "Sinusitis", "Tonsillitis", "Pharyngitis", "Laryngitis", "Rhinitis", "Meniere's Disease", "Nasal Polyps", "Sleep Apnea"]
  },
  "Dermatology": {
    complaints: ["Rash", "Itching", "Skin lesion", "Hair loss", "Nail changes", "Skin discoloration", "Excessive sweating", "Dry skin", "Acne", "Skin growth"],
    diagnoses: ["Eczema", "Psoriasis", "Acne Vulgaris", "Dermatitis", "Urticaria", "Fungal Infection", "Herpes Zoster", "Melanoma", "Basal Cell Carcinoma", "Alopecia"]
  },
  "Cardiology": {
    complaints: ["Chest pain", "Palpitations", "Shortness of breath", "Fatigue", "Dizziness", "Syncope", "Leg swelling", "Exercise intolerance", "Cyanosis", "Orthopnea"],
    diagnoses: ["Coronary Artery Disease", "Myocardial Infarction", "Heart Failure", "Atrial Fibrillation", "Hypertension", "Valvular Heart Disease", "Cardiomyopathy", "Pericarditis", "Endocarditis", "Aortic Aneurysm"]
  },
  "Neurology": {
    complaints: ["Headache", "Dizziness", "Seizures", "Weakness", "Numbness", "Tingling", "Memory problems", "Balance problems", "Tremors", "Vision changes"],
    diagnoses: ["Migraine", "Stroke", "Epilepsy", "Multiple Sclerosis", "Parkinson's Disease", "Alzheimer's Disease", "Peripheral Neuropathy", "Myasthenia Gravis", "Brain Tumor", "Meningitis"]
  }
};

// Generate a random integer between min and max (inclusive)
const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Get a random item from an array
const getRandomItem = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

// Generate a random patient case
const generatePatientCase = (index) => {
  // Determine difficulty level based on index to ensure balanced distribution
  // First 40% of cases are Beginner, next 40% are Intermediate, final 20% are Advanced
  let difficulty;
  if (index < 400) {
    difficulty = "Beginner";
  } else if (index < 800) {
    difficulty = "Intermediate";
  } else {
    difficulty = "Advanced";
  }

  // Determine program area
  const programArea = getRandomItem(Object.keys(programSpecialties));
  
  // Determine specialty
  const specialty = getRandomItem(programSpecialties[programArea]);
  
  // Determine patient age category based on specialty
  let ageCategory;
  if (specialty === "Pediatrics") {
    ageCategory = "child";
  } else if (specialty === "Geriatrics") {
    ageCategory = "elderly";
  } else {
    ageCategory = Math.random() < 0.8 ? "adult" : (Math.random() < 0.5 ? "child" : "elderly");
  }
  
  // Generate age based on age category
  let age;
  if (ageCategory === "child") {
    age = getRandomInt(1, 17).toString();
  } else if (ageCategory === "elderly") {
    age = getRandomInt(65, 95).toString();
  } else {
    age = getRandomInt(18, 64).toString();
  }
  
  // Determine gender
  const gender = Math.random() < 0.5 ? "Male" : "Female";
  
  // Generate name
  const firstName = getRandomItem(gender === "Male" ? names.male : names.female);
  const lastName = getRandomItem(lastNames);
  const fullName = `${firstName} ${lastName}`;
  
  // Generate occupation based on age category
  const occupation = getRandomItem(occupations[ageCategory]);
  
  // Get symptoms and diagnoses for the specialty
  const specialtyData = specialtySymptoms[specialty] || specialtySymptoms["Internal Medicine"];
  
  // Generate chief complaint
  const chiefComplaint = getRandomItem(specialtyData.complaints);
  
  // Generate hidden diagnosis
  const hiddenDiagnosis = getRandomItem(specialtyData.diagnoses);
  
  // Generate emotional tone
  const emotionalTone = getRandomItem(emotionalTones);
  
  // Generate case ID
  const specialtyPrefix = specialty.substring(0, 3).toUpperCase();
  const caseId = `VP-${specialtyPrefix}-${(index + 1).toString().padStart(3, '0')}`;
  
  // Generate background story
  const backgroundStory = generateBackgroundStory(firstName, age, gender, occupation, ageCategory);
  
  // Generate history of presenting illness
  const hpi = generateHistoryOfPresentingIllness(chiefComplaint, specialtyData);
  
  // Generate initial prompt
  const initialPrompt = generateInitialPrompt(firstName, chiefComplaint, emotionalTone);
  
  // Create the case object
  const caseObject = {
    version: "3.1-program-aware",
    description: `A ${age}-year-old ${gender.toLowerCase()} presenting with ${chiefComplaint.toLowerCase()}`,
    system_instruction: caseTemplate.system_instruction,
    case_metadata: {
      program_area: programArea,
      case_id: caseId,
      title: `${age}-Year-Old with ${chiefComplaint}`,
      specialty: specialty,
      specialized_area: specialty,
      difficulty: difficulty,
      progression_order: index, // Add progression order to allow sorting by difficulty
      tags: [specialty, chiefComplaint.toLowerCase().replace(/\s+/g, '_'), hiddenDiagnosis.toLowerCase().replace(/\s+/g, '_'), `difficulty_${difficulty.toLowerCase()}`],
      estimated_duration_min: getRandomInt(10, 30)
    },
    patient_persona: {
      name: fullName,
      age: age,
      gender: gender,
      occupation: occupation,
      chief_complaint: chiefComplaint,
      emotional_tone: emotionalTone,
      background_story: backgroundStory
    },
    initial_prompt: initialPrompt,
    clinical_dossier: {
      comment: "This is the AI's source of truth. Only reveal these details when directly asked.",
      hidden_diagnosis: hiddenDiagnosis,
      history_of_presenting_illness: hpi,
      review_of_systems: generateReviewOfSystems(specialtyData, difficulty),
      past_medical_history: generatePastMedicalHistory(ageCategory, difficulty),
      medications: generateMedications(ageCategory, difficulty),
      allergies: generateAllergies(difficulty),
      surgical_history: generateSurgicalHistory(ageCategory, difficulty),
      family_history: generateFamilyHistory(difficulty),
      social_history: generateSocialHistory(ageCategory, difficulty)
    },
    simulation_triggers: {
      end_session: {
        condition_keyword: hiddenDiagnosis.toLowerCase(),
        patient_response: "Thank you, doctor. Is that serious? What should I do now?"
      },
      invalid_input: {
        condition_keyword: "inappropriate",
        patient_response: "I'm not comfortable with that question."
      }
    },
    evaluation_criteria: {
      "History_Taking": "Did the user thoroughly explore the symptoms using OPQRST or similar?",
      "Risk_Factor_Assessment": "Were lifestyle, past medical, and family histories covered?",
      "Differential_Diagnosis_Questioning": "Did the clinician ask questions to rule out similar or dangerous conditions?",
      "Communication_and_Empathy": "Was the approach sensitive to the patient's emotional tone?",
      "Clinical_Urgency": "Did the clinician demonstrate appropriate urgency or escalation?"
    },
    difficulty_factors: generateDifficultyFactors(difficulty)
  };
  
  return caseObject;
};

// Generate background story
const generateBackgroundStory = (firstName, age, gender, occupation, ageCategory) => {
  const pronoun = gender === "Male" ? "He" : "She";
  
  if (ageCategory === "child") {
    const grade = age < 5 ? "preschool" : `grade ${getRandomInt(1, 12)}`;
    const hobbies = getRandomItem(["playing sports", "video games", "reading", "drawing", "playing with friends", "watching TV"]);
    return `${firstName} is a ${age}-year-old who attends ${grade}. ${pronoun} enjoys ${hobbies} and lives with ${getRandomItem(["both parents", "mother", "father", "grandparents"])}.`;
  } else if (ageCategory === "elderly") {
    const retirementYears = getRandomInt(1, 20);
    return `${firstName} is a ${age}-year-old who has been ${occupation.toLowerCase()} for ${retirementYears} years. ${pronoun} lives ${getRandomItem(["alone", "with spouse", "with children", "in a retirement community"])}.`;
  } else {
    const workYears = getRandomInt(1, 30);
    const familyStatus = getRandomItem(["single", "married", "divorced", "in a relationship"]);
    const children = Math.random() < 0.6 ? getRandomInt(1, 4) : 0;
    const childrenText = children > 0 ? ` and has ${children} ${children === 1 ? 'child' : 'children'}` : "";
    return `${firstName} is a ${age}-year-old who has been working as a ${occupation.toLowerCase()} for ${workYears} years. ${pronoun} is ${familyStatus}${childrenText}.`;
  }
};

// Generate history of presenting illness
const generateHistoryOfPresentingIllness = (chiefComplaint, specialtyData) => {
  const onset = getRandomItem([
    "Started suddenly this morning", 
    "Gradual onset over the past few days", 
    "Started about a week ago", 
    "Has been present for several months", 
    "Began after eating", 
    "Started during exercise", 
    "Woke up with it", 
    "Started after a fall"
  ]);
  
  const location = getRandomItem([
    "Localized to the chest", 
    "In the abdomen", 
    "Throughout the head", 
    "In the lower back", 
    "In the right knee", 
    "Around the eyes", 
    "In the throat", 
    "All over the body"
  ]);
  
  const radiation = getRandomItem([
    "Does not radiate", 
    "Radiates to the left arm", 
    "Spreads to the back", 
    "Moves down the leg", 
    "Radiates to the jaw", 
    "Spreads across the abdomen", 
    "Moves from side to side", 
    "No radiation"
  ]);
  
  const character = getRandomItem([
    "Sharp and stabbing", 
    "Dull and aching", 
    "Burning sensation", 
    "Throbbing", 
    "Cramping", 
    "Pressure-like", 
    "Tightness", 
    "Shooting pain"
  ]);
  
  const severity = `${getRandomInt(1, 10)}/10`;
  
  const timingAndDuration = getRandomItem([
    "Constant since onset", 
    "Comes and goes throughout the day", 
    "Worse in the morning", 
    "Worse at night", 
    "Lasts for about an hour each time", 
    "Intermittent, lasting a few minutes", 
    "Persistent but varies in intensity", 
    "Occurs after meals"
  ]);
  
  const exacerbatingFactors = getRandomItem([
    "Worsened by movement", 
    "Worse when lying down", 
    "Exacerbated by eating", 
    "Worse with stress", 
    "Aggravated by cold weather", 
    "Worse after exercise", 
    "Increases with coughing", 
    "Worsens throughout the day"
  ]);
  
  const relievingFactors = getRandomItem([
    "Relieved by rest", 
    "Better with over-the-counter pain medication", 
    "Improves with heat application", 
    "Better when sitting up", 
    "Relieved by eating", 
    "Improves with walking", 
    "Nothing seems to help", 
    "Temporarily better after taking a deep breath"
  ]);
  
  // Generate 2-4 associated symptoms
  const numSymptoms = getRandomInt(2, 4);
  const associatedSymptoms = [];
  const availableSymptoms = [...specialtyData.complaints];
  
  // Remove the chief complaint from available symptoms
  const chiefComplaintIndex = availableSymptoms.indexOf(chiefComplaint);
  if (chiefComplaintIndex !== -1) {
    availableSymptoms.splice(chiefComplaintIndex, 1);
  }
  
  for (let i = 0; i < numSymptoms && availableSymptoms.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * availableSymptoms.length);
    associatedSymptoms.push(availableSymptoms[randomIndex]);
    availableSymptoms.splice(randomIndex, 1);
  }
  
  return {
    onset: onset,
    location: location,
    radiation: radiation,
    character: character,
    severity: severity,
    timing_and_duration: timingAndDuration,
    exacerbating_factors: exacerbatingFactors,
    relieving_factors: relievingFactors,
    associated_symptoms: associatedSymptoms
  };
};

// Generate difficulty-specific factors
const generateDifficultyFactors = (difficulty) => {
  switch(difficulty) {
    case "Beginner":
      return {
        case_complexity: "Low",
        diagnostic_challenge: "Straightforward with clear symptoms",
        communication_challenge: "Patient is cooperative and clear",
        learning_objectives: [
          "Practice basic history taking",
          "Identify common symptoms",
          "Develop rapport with patients"
        ]
      };
    case "Intermediate":
      return {
        case_complexity: "Moderate",
        diagnostic_challenge: "Multiple possible diagnoses to consider",
        communication_challenge: "Patient may have some communication barriers",
        learning_objectives: [
          "Develop differential diagnosis skills",
          "Practice focused questioning",
          "Handle mild communication challenges"
        ]
      };
    case "Advanced":
      return {
        case_complexity: "High",
        diagnostic_challenge: "Complex presentation with atypical features",
        communication_challenge: "Significant communication barriers or emotional factors",
        learning_objectives: [
          "Navigate complex clinical scenarios",
          "Identify subtle diagnostic clues",
          "Manage difficult communication situations"
        ]
      };
    default:
      return {
        case_complexity: "Moderate",
        diagnostic_challenge: "Standard case",
        communication_challenge: "Normal patient interaction",
        learning_objectives: ["General clinical practice"]
      };
  }
};

// Generate review of systems
const generateReviewOfSystems = (specialtyData, difficulty) => {
  const positive = [];
  const negative = [];
  
  // Add positive findings based on difficulty
  let numPositive;
  if (difficulty === "Beginner") {
    numPositive = getRandomInt(1, 2); // Fewer positive findings for beginners
  } else if (difficulty === "Intermediate") {
    numPositive = getRandomInt(2, 3); // More findings for intermediate
  } else {
    numPositive = getRandomInt(3, 5); // Most findings for advanced
  }
  const availablePositive = [...specialtyData.complaints];
  
  for (let i = 0; i < numPositive && availablePositive.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * availablePositive.length);
    positive.push(availablePositive[randomIndex]);
    availablePositive.splice(randomIndex, 1);
  }
  
  // Add 3-5 negative findings
  const numNegative = getRandomInt(3, 5);
  const commonNegatives = [
    "No fever", "No chills", "No weight loss", "No night sweats", 
    "No headache", "No dizziness", "No vision changes", "No hearing changes",
    "No chest pain", "No palpitations", "No shortness of breath", "No cough",
    "No nausea", "No vomiting", "No diarrhea", "No constipation",
    "No urinary symptoms", "No rash", "No joint pain", "No muscle pain"
  ];
  
  for (let i = 0; i < numNegative; i++) {
    negative.push(commonNegatives[i]);
  }
  
  return {
    comment: "Key positives and negatives for clinical reasoning",
    positive: positive,
    negative: negative
  };
};

// Generate past medical history
const generatePastMedicalHistory = (ageCategory, difficulty) => {
  const history = [];
  
  // Number of conditions based on difficulty
  let numConditions;
  if (difficulty === "Beginner") {
    numConditions = getRandomInt(0, 1); // Simpler history for beginners
  } else if (difficulty === "Intermediate") {
    numConditions = getRandomInt(1, 3); // More complex for intermediate
  } else {
    numConditions = getRandomInt(2, 4); // Most complex for advanced
  }
  
  const childConditions = [
    "Asthma", "Eczema", "Allergies", "Recurrent ear infections", "Chickenpox",
    "Attention Deficit Hyperactivity Disorder", "Autism Spectrum Disorder", "Congenital heart defect"
  ];
  
  const adultConditions = [
    "Hypertension", "Type 2 Diabetes", "Asthma", "Depression", "Anxiety",
    "Hypercholesterolemia", "Gastroesophageal Reflux Disease", "Migraine"
  ];
  
  const elderlyConditions = [
    "Hypertension", "Type 2 Diabetes", "Coronary Artery Disease", "Osteoarthritis", "Osteoporosis",
    "Chronic Obstructive Pulmonary Disease", "Stroke", "Dementia", "Parkinson's Disease", "Chronic Kidney Disease"
  ];
  
  const conditions = ageCategory === "child" ? childConditions : 
                    (ageCategory === "elderly" ? elderlyConditions : adultConditions);
  
  for (let i = 0; i < numConditions; i++) {
    history.push(getRandomItem(conditions));
  }
  
  if (history.length === 0) {
    history.push("No significant past medical history");
  }
  
  return history;
};

// Generate medications
const generateMedications = (ageCategory, difficulty) => {
  const medications = [];
  
  // Number of medications based on difficulty
  let numMedications;
  if (difficulty === "Beginner") {
    numMedications = getRandomInt(0, 1); // Fewer medications for beginners
  } else if (difficulty === "Intermediate") {
    numMedications = getRandomInt(1, 3); // More medications for intermediate
  } else {
    numMedications = getRandomInt(2, 5); // Most medications for advanced
  }
  
  const childMedications = [
    "Albuterol inhaler as needed", "Children's acetaminophen as needed", "Cetirizine 5mg daily",
    "Fluticasone nasal spray", "Methylphenidate 10mg daily", "Amoxicillin 250mg three times daily"
  ];
  
  const adultMedications = [
    "Lisinopril 10mg daily", "Metformin 500mg twice daily", "Atorvastatin 20mg daily",
    "Levothyroxine 50mcg daily", "Sertraline 50mg daily", "Omeprazole 20mg daily",
    "Albuterol inhaler as needed", "Ibuprofen 400mg as needed"
  ];
  
  const elderlyMedications = [
    "Lisinopril 20mg daily", "Metformin 1000mg twice daily", "Atorvastatin 40mg daily",
    "Aspirin 81mg daily", "Amlodipine 5mg daily", "Metoprolol 25mg twice daily",
    "Furosemide 20mg daily", "Levothyroxine 75mcg daily", "Donepezil 10mg daily"
  ];
  
  const medicationList = ageCategory === "child" ? childMedications : 
                        (ageCategory === "elderly" ? elderlyMedications : adultMedications);
  
  for (let i = 0; i < numMedications; i++) {
    medications.push(getRandomItem(medicationList));
  }
  
  if (medications.length === 0) {
    medications.push("No current medications");
  }
  
  return medications;
};

// Generate allergies
const generateAllergies = (difficulty) => {
  const allergies = [];
  
  // Probability of allergies based on difficulty
  let allergyProbability;
  if (difficulty === "Beginner") {
    allergyProbability = 0.2; // Less likely for beginners
  } else if (difficulty === "Intermediate") {
    allergyProbability = 0.4; // More likely for intermediate
  } else {
    allergyProbability = 0.6; // Most likely for advanced
  }
  
  const hasAllergies = Math.random() < allergyProbability;
  
  if (hasAllergies) {
    const commonAllergies = [
      "Penicillin", "Sulfa drugs", "NSAIDs", "Shellfish", "Nuts", "Eggs", "Latex", "Contrast dye"
    ];
    
    allergies.push(getRandomItem(commonAllergies));
    
    if (Math.random() < 0.2) {
      let secondAllergy;
      do {
        secondAllergy = getRandomItem(commonAllergies);
      } while (secondAllergy === allergies[0]);
      
      allergies.push(secondAllergy);
    }
  } else {
    allergies.push("No known allergies");
  }
  
  return allergies;
};

// Generate surgical history
const generateSurgicalHistory = (ageCategory, difficulty) => {
  const surgicalHistory = [];
  
  // Base probability on age category
  let baseProbability = ageCategory === "elderly" ? 0.7 : (ageCategory === "adult" ? 0.4 : 0.2);
  
  // Adjust probability based on difficulty
  let difficultyMultiplier;
  if (difficulty === "Beginner") {
    difficultyMultiplier = 0.7; // Reduce probability for beginners
  } else if (difficulty === "Intermediate") {
    difficultyMultiplier = 1.0; // Normal probability for intermediate
  } else {
    difficultyMultiplier = 1.3; // Increase probability for advanced
  }
  
  const hasSurgery = Math.random() < (baseProbability * difficultyMultiplier);
  
  if (hasSurgery) {
    const childSurgeries = [
      "Tonsillectomy at age 5", "Appendectomy at age 10", "Ear tube placement as a toddler"
    ];
    
    const adultSurgeries = [
      "Appendectomy", "Cholecystectomy", "Cesarean section", "Hysterectomy", 
      "Tonsillectomy in childhood", "Wisdom teeth extraction", "Knee arthroscopy"
    ];
    
    const elderlySurgeries = [
      "Coronary artery bypass graft", "Hip replacement", "Knee replacement", 
      "Cataract surgery", "Prostatectomy", "Cholecystectomy", "Appendectomy in youth"
    ];
    
    const surgeries = ageCategory === "child" ? childSurgeries : 
                     (ageCategory === "elderly" ? elderlySurgeries : adultSurgeries);
    
    surgicalHistory.push(getRandomItem(surgeries));
    
    if (ageCategory === "elderly" && Math.random() < 0.4) {
      let secondSurgery;
      do {
        secondSurgery = getRandomItem(elderlySurgeries);
      } while (secondSurgery === surgicalHistory[0]);
      
      surgicalHistory.push(secondSurgery);
    }
  } else {
    surgicalHistory.push("No previous surgeries");
  }
  
  return surgicalHistory;
};

// Generate family history
const generateFamilyHistory = (difficulty) => {
  const familyHistory = [];
  
  // Number of conditions based on difficulty
  let numConditions;
  if (difficulty === "Beginner") {
    numConditions = getRandomInt(0, 1); // Simpler history for beginners
  } else if (difficulty === "Intermediate") {
    numConditions = getRandomInt(1, 2); // More complex for intermediate
  } else {
    numConditions = getRandomInt(2, 3); // Most complex for advanced
  }
  
  const commonFamilyConditions = [
    "Father with hypertension", "Mother with diabetes", "Grandfather with heart attack at age 65",
    "Grandmother with breast cancer", "Sister with asthma", "Brother with epilepsy",
    "Family history of stroke", "Family history of colon cancer"
  ];
  
  for (let i = 0; i < numConditions; i++) {
    familyHistory.push(getRandomItem(commonFamilyConditions));
  }
  
  if (familyHistory.length === 0) {
    familyHistory.push("No significant family history");
  }
  
  return familyHistory;
};

// Generate social history
const generateSocialHistory = (ageCategory, difficulty) => {
  // Smoking status
  let smokingStatus;
  if (ageCategory === "child") {
    smokingStatus = "Non-smoker";
  } else {
    // Adjust smoking probability based on difficulty (more complex social factors for advanced cases)
    let smokingProbability;
    if (difficulty === "Beginner") {
      smokingProbability = ageCategory === "elderly" ? 0.2 : 0.1;
    } else if (difficulty === "Intermediate") {
      smokingProbability = ageCategory === "elderly" ? 0.3 : 0.2;
    } else {
      smokingProbability = ageCategory === "elderly" ? 0.4 : 0.3;
    }
    smokingStatus = Math.random() < smokingProbability ?
      getRandomItem(["Current smoker, 1 pack per day", "Current smoker, occasional", "Former smoker, quit 5 years ago"]) :
      "Non-smoker";
  }
  
  // Alcohol use
  let alcoholUse;
  if (ageCategory === "child") {
    alcoholUse = "No alcohol use";
  } else {
    // Adjust alcohol probability based on difficulty
    let alcoholProbability;
    if (difficulty === "Beginner") {
      alcoholProbability = ageCategory === "elderly" ? 0.3 : 0.4;
    } else if (difficulty === "Intermediate") {
      alcoholProbability = ageCategory === "elderly" ? 0.4 : 0.6;
    } else {
      alcoholProbability = ageCategory === "elderly" ? 0.5 : 0.7;
    }
    alcoholUse = Math.random() < alcoholProbability ?
      getRandomItem(["Social drinker", "Occasional alcohol use", "Moderate alcohol consumption", "Regular alcohol consumption"]) :
      "No alcohol use";
  }
  
  // Substance use
  let substanceUse;
  if (ageCategory === "child") {
    substanceUse = "No substance use";
  } else {
    // Adjust substance use probability based on difficulty
    let substanceProbability;
    if (difficulty === "Beginner") {
      substanceProbability = 0.05;
    } else if (difficulty === "Intermediate") {
      substanceProbability = 0.1;
    } else {
      substanceProbability = 0.2;
    }
    substanceUse = Math.random() < substanceProbability ?
      getRandomItem(["Occasional marijuana use", "History of recreational drug use", "Current marijuana use"]) :
      "Denies substance use";
  }
  
  // Diet and exercise
  const dietAndExercise = getRandomItem([
    "Balanced diet, regular exercise",
    "Sedentary lifestyle",
    "Tries to eat healthy but struggles with exercise",
    "Regular exercise, poor diet",
    "Vegetarian diet, occasional exercise",
    "No regular exercise routine",
    "Recently started a diet and exercise program"
  ]);
  
  // Living situation
  let livingSituation;
  if (ageCategory === "child") {
    livingSituation = getRandomItem([
      "Lives with both parents",
      "Lives with mother",
      "Lives with father",
      "Lives with grandparents",
      "Lives in a blended family"
    ]);
  } else if (ageCategory === "elderly") {
    livingSituation = getRandomItem([
      "Lives alone",
      "Lives with spouse",
      "Lives with adult children",
      "Lives in a retirement community",
      "Lives in assisted living"
    ]);
  } else {
    livingSituation = getRandomItem([
      "Lives alone",
      "Lives with spouse/partner",
      "Lives with roommates",
      "Lives with family",
      "Recently moved to a new home"
    ]);
  }
  
  return {
    smoking_status: smokingStatus,
    alcohol_use: alcoholUse,
    substance_use: substanceUse,
    diet_and_exercise: dietAndExercise,
    living_situation: livingSituation
  };
};

// Generate initial prompt
const generateInitialPrompt = (firstName, chiefComplaint, emotionalTone) => {
  const greetings = [
    `Hello doctor, my name is ${firstName}.`,
    `Hi there, I'm ${firstName}.`,
    `Good day doctor, ${firstName} here.`,
    `Hello, I'm ${firstName}. Thank you for seeing me today.`
  ];
  
  const complaints = [
    `I've been having ${chiefComplaint.toLowerCase()}.`,
    `I came in because of this ${chiefComplaint.toLowerCase()}.`,
    `I'm here about my ${chiefComplaint.toLowerCase()}.`,
    `I've been experiencing ${chiefComplaint.toLowerCase()} and it's concerning me.`
  ];
  
  const emotions = {
    "Anxious": [
      "I'm really worried about this.",
      "I've been anxious about what this could mean.",
      "This has me quite concerned.",
      "I'm nervous about what you might find."
    ],
    "Worried": [
      "I'm quite worried about this.",
      "This has been on my mind constantly.",
      "I'm concerned this might be serious.",
      "I've been worrying about this for days."
    ],
    "Scared": [
      "To be honest, I'm scared about what this could be.",
      "This has me really frightened.",
      "I'm afraid this might be something serious.",
      "I've been scared to even come in."
    ],
    "Calm": [
      "I'm trying to stay calm about it.",
      "I'm not too worried, just want to get it checked.",
      "I'm sure it's nothing serious, but thought I should come in.",
      "I'm pretty relaxed about it, just want your opinion."
    ],
    "Irritable": [
      "I'm getting really frustrated with this problem.",
      "This has been irritating me for a while now.",
      "I'm at my wit's end with this issue.",
      "I'm pretty annoyed that I have to deal with this."
    ]
  };
  
  const emotionText = emotions[emotionalTone] ? getRandomItem(emotions[emotionalTone]) :
    "I wanted to get this checked out.";
  
  return `${getRandomItem(greetings)} ${getRandomItem(complaints)} ${emotionText}`;
};

// Generate cases and add to database
const generateCases = async (numCases) => {
  try {
    const cases = [];
    
    for (let i = 0; i < numCases; i++) {
      const caseObject = generatePatientCase(i);
      cases.push(caseObject);
      
      // Log progress every 100 cases
      if ((i + 1) % 100 === 0 || i === numCases - 1) {
        logger.info(`Generated ${i + 1} of ${numCases} cases`);
      }
    }
    
    // Insert cases into database
    logger.info(`Inserting ${cases.length} cases into database...`);
    const result = await Case.insertMany(cases);
    logger.info(`Successfully inserted ${result.length} cases into database`);
    
    return result.length;
  } catch (error) {
    logger.error(`Error generating cases: ${error.message}`);
    throw error;
  }
};

// Main function
const main = async () => {
  let connection;
  try {
    connection = await connectDB();
    
    // Number of cases to generate
    const numCases = 1000;
    
    console.log(`Generating ${numCases} realistic patient cases...`);
    console.log('This may take a few minutes. Please wait...');
    
    const insertedCount = await generateCases(numCases);
    console.log(`Successfully generated and inserted ${insertedCount} cases into the database.`);
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Close the connection
    if (connection) {
      await mongoose.disconnect();
      logger.info('MongoDB connection closed');
    }
    process.exit(0);
  }
};

// Run the script
main();