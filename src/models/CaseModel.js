import mongoose from 'mongoose';

const CaseMetadataSchema = new mongoose.Schema({
  case_id: { type: String, required: true, unique: true, trim: true },
  title: { type: String, required: true, trim: true },
  specialty: { type: String, trim: true },
  program_area: {
    type: String,
    required: true,
    trim: true,
    // Consider adding enum validation later based on your finalized list
    // enum: ['Internal medicine', 'Surgery', 'Obstetrics and gynaecology', 'Pediatrics', 'Community health', 'Specialized programs']
  },
  specialized_area: {
    type: String,
    trim: true,
    default: null
    // Consider adding enum validation later based on your finalized list
    // enum: [null, 'Ophthalmology', 'ENT', 'Reproductive health', 'Dermatology', 'Anesthesia', 'Family medicine', 'Pediatrics', 'Surgery']
  },
  difficulty: { type: String, trim: true },
  tags: [{ type: String, trim: true }]
}, { _id: false });

const PatientPersonaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: String, required: true, trim: true }, // Keeping as String as per original JSON
  gender: { type: String, required: true, trim: true },
  occupation: { type: String, trim: true },
  chief_complaint: { type: String, required: true, trim: true },
  emotional_tone: { type: String, required: true, trim: true },
  background_story: { type: String, trim: true }
}, { _id: false });

const HistoryItemSchema = new mongoose.Schema({
  onset: String,
  location: String,
  radiation: String,
  character: String,
  severity: String,
  timing_and_duration: String,
  exacerbating_factors: String,
  relieving_factors: String,
  associated_symptoms: [String]
}, { _id: false });

const ReviewOfSystemsSchema = new mongoose.Schema({
  comment: String,
  positive: [String],
  negative: [String]
}, { _id: false });

const SocialHistorySchema = new mongoose.Schema({
  smoking_status: String,
  alcohol_use: String,
  substance_use: String,
  diet_and_exercise: String,
  living_situation: String
}, { _id: false });

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

const SimulationTriggersSchema = new mongoose.Schema({
  condition_keyword: String,
  patient_response: String
}, { _id: false });

const SimulationTriggerGroupSchema = new mongoose.Schema({
  end_session: SimulationTriggersSchema,
  invalid_input: SimulationTriggersSchema
}, { _id: false });

// Using a flexible Map for evaluation_criteria as the keys (criteria names) can vary
const EvaluationCriteriaSchema = new mongoose.Schema({}, { strict: false, _id: false });


const CaseSchema = new mongoose.Schema({
  version: { type: String, trim: true },
  description: { type: String, trim: true },
  system_instruction: { type: String, required: true, trim: true },
  case_metadata: { type: CaseMetadataSchema, required: true },
  patient_persona: { type: PatientPersonaSchema, required: true },
  initial_prompt: { type: String, required: true, trim: true },
  clinical_dossier: { type: ClinicalDossierSchema, required: true },
  simulation_triggers: { type: SimulationTriggerGroupSchema },
  evaluation_criteria: { type: Map, of: String, required: true } // Storing as a Map of String
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Indexing case_id for faster lookups
CaseSchema.index({ 'case_metadata.case_id': 1 });
CaseSchema.index({ 'case_metadata.program_area': 1 });
CaseSchema.index({ 'case_metadata.specialized_area': 1 });


const Case = mongoose.model('Case', CaseSchema);

export default Case;
