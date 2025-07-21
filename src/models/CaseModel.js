import mongoose from 'mongoose';

// Case Metadata Schema
const CaseMetadataSchema = new mongoose.Schema({
  case_id: { type: String, required: true, unique: true, trim: true },
  title: { type: String, required: true, trim: true },
  specialty: { type: String, required: true, trim: true }, // Added 'required: true'
  program_area: {
    type: String,
    required: true,
    trim: true,
    enum: ['Basic Program', 'Specialty Program'] // Updated enum values
  },
  difficulty: { 
    type: String, 
    required: true, 
    trim: true,
    enum: ['Easy', 'Intermediate', 'Hard'] // Added enum validation
  },
  tags: [{ type: String, trim: true }],
  location: { type: String, required: true, trim: true } // New field for location
}, { _id: false });

// Patient Persona Schema
const PatientPersonaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true }, // Changed from String to Number for consistency
  gender: { type: String, required: true, trim: true },
  occupation: { type: String, trim: true },
  chief_complaint: { type: String, required: true, trim: true },
  emotional_tone: { type: String, required: true, trim: true },
  background_story: { type: String, trim: true },
  speaks_for: { type: String, trim: true },
  patient_is_present: { type: Boolean },
  patient_age_for_communication: { type: Number },
  is_pediatric: { type: Boolean },
  pediatric_threshold: { type: Number },
  guardian: {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    age: { type: Number },
    occupation: { type: String, trim: true },
    emotional_state: { type: String, trim: true },
    background_info: { type: String, trim: true },
    communication_style: { type: String, trim: true }
  }
}, { _id: false });

// History of Presenting Illness Schema
const HistoryItemSchema = new mongoose.Schema({
  onset: String,
  location: String,
  radiation: String,
  character: String,
  severity: Number, // Changed from String to Number for numerical ratings
  timing_and_duration: String,
  exacerbating_factors: String,
  relieving_factors: String,
  associated_symptoms: [String]
}, { _id: false });

// Review of Systems Schema
const ReviewOfSystemsSchema = new mongoose.Schema({
  comment: String,
  positive: [String],
  negative: [String]
}, { _id: false });

// Social History Schema
const SocialHistorySchema = new mongoose.Schema({
  smoking_status: String,
  alcohol_use: String,
  substance_use: String,
  diet_and_exercise: String,
  living_situation: String
}, { _id: false });

// Clinical Dossier Schema
const ClinicalDossierSchema = new mongoose.Schema({
  comment: String,
  hidden_diagnosis: { type: String, required: true, trim: true },
  history_of_presenting_illness: HistoryItemSchema,
  review_of_systems: ReviewOfSystemsSchema,
  past_medical_history: [String],
  medications: [String],
  allergies: [String],
  surgical_history: [String],
  family_history: [String],
  social_history: SocialHistorySchema
}, { _id: false });

// Simulation Triggers Schema
const SimulationTriggersSchema = new mongoose.Schema({
  condition_keyword: String,
  patient_response: String
}, { _id: false });

// Simulation Trigger Group Schema
const SimulationTriggerGroupSchema = new mongoose.Schema({
  end_session: SimulationTriggersSchema,
  invalid_input: SimulationTriggersSchema
}, { _id: false });

// Evaluation Criteria Schema
const EvaluationCriteriaSchema = new mongoose.Schema({}, { strict: false, _id: false }); // Flexible Map

// Main Case Schema
const CaseSchema = new mongoose.Schema({
  version: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  system_instruction: { type: String, required: true, trim: true },
  case_metadata: { type: CaseMetadataSchema, required: true },
  patient_persona: { type: PatientPersonaSchema, required: true },
  initial_prompt: { type: String, required: true, trim: true },
  clinical_dossier: { type: ClinicalDossierSchema, required: true },
  simulation_triggers: { type: SimulationTriggerGroupSchema, required: true }, // Added 'required: true'
  evaluation_criteria: { type: EvaluationCriteriaSchema, required: true } // Storing as a flexible Map
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Indexes for faster queries
CaseSchema.index({ 'case_metadata.case_id': 1 });
CaseSchema.index({ 'case_metadata.program_area': 1 });
CaseSchema.index({ 'case_metadata.specialty': 1 });
CaseSchema.index({ 'case_metadata.location': 1 }); // New index for location

// Create the Case Model
const Case = mongoose.model('Case', CaseSchema);

export default Case;