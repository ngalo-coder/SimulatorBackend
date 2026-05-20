import mongoose from 'mongoose';

// Case Metadata Schema
const CaseMetadataSchema = new mongoose.Schema(
  {
    case_id: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true }, // Added 'required: true'
    program_area: {
      type: String,
      required: true,
      trim: true,
      enum: ['Basic Program', 'Specialty Program'], // Updated enum values
    },
    module: { type: String, trim: true }, // Added module field for Internal Medicine specialization
    difficulty: {
      type: String,
      required: true,
      trim: true,
      enum: ['Easy', 'Intermediate', 'Hard'], // Added enum validation
    },
    tags: [{ type: String, trim: true }],
    location: { type: String, required: true, trim: true }, // New field for location
  },
  { _id: false }
);

// Patient Persona Schema
const PatientPersonaSchema = new mongoose.Schema(
  {
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
      communication_style: { type: String, trim: true },
    },
  },
  { _id: false }
);

// History of Presenting Illness Schema
const HistoryItemSchema = new mongoose.Schema(
  {
    onset: String,
    location: String,
    radiation: String,
    character: String,
    severity: Number, // Changed from String to Number for numerical ratings
    timing_and_duration: String,
    exacerbating_factors: String,
    relieving_factors: String,
    associated_symptoms: [String],
  },
  { _id: false }
);

// Review of Systems Schema
const ReviewOfSystemsSchema = new mongoose.Schema(
  {
    comment: String,
    positive: [String],
    negative: [String],
  },
  { _id: false }
);

// Social History Schema
const SocialHistorySchema = new mongoose.Schema(
  {
    smoking_status: String,
    alcohol_use: String,
    substance_use: String,
    diet_and_exercise: String,
    living_situation: String,
  },
  { _id: false }
);

// Clinical Dossier Schema
const ClinicalDossierSchema = new mongoose.Schema(
  {
    comment: String,
    hidden_diagnosis: { type: String, required: true, trim: true },
    history_of_presenting_illness: HistoryItemSchema,
    review_of_systems: ReviewOfSystemsSchema,
    past_medical_history: [String],
    medications: [String],
    allergies: [String],
    surgical_history: [String],
    family_history: [String],
    social_history: SocialHistorySchema,
  },
  { _id: false }
);

// Simulation Triggers Schema
const SimulationTriggersSchema = new mongoose.Schema(
  {
    condition_keyword: String,
    patient_response: String,
  },
  { _id: false }
);

// Simulation Trigger Group Schema
const SimulationTriggerGroupSchema = new mongoose.Schema(
  {
    end_session: SimulationTriggersSchema,
    invalid_input: SimulationTriggersSchema,
  },
  { _id: false }
);

// Multimedia Content Schema
const MultimediaContentSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, unique: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String },
    type: {
      type: String,
      required: true,
      enum: ['image', 'video', 'audio', 'document']
    },
    category: {
      type: String,
      enum: ['patient_image', 'xray', 'lab_result', 'audio_recording', 'video_demo', 'reference_material'],
      required: true
    },
    description: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    metadata: {
      width: Number,
      height: Number,
      duration: Number, // for video/audio
      encoding: String,
      compression: String
    }
  },
  { _id: false }
);

// Case Category Schema
const CaseCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'CaseCategory' },
    color: { type: String, default: '#3B82F6' },
    icon: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  }
);

// Nursing Diagnosis Schema
const NursingDiagnosisSchema = new mongoose.Schema(
  {
    diagnosis: { type: String, required: true, trim: true },
    related_factors: [{ type: String, trim: true }],
    defining_characteristics: [{ type: String, trim: true }],
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    nanda_code: { type: String, trim: true }
  },
  { _id: false }
);

// Nursing Intervention Schema
const NursingInterventionSchema = new mongoose.Schema(
  {
    intervention: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    nic_code: { type: String, trim: true },
    parameters: [{ type: String, trim: true }],
    expected_outcomes: [{ type: String, trim: true }]
  },
  { _id: false }
);

// Nursing Outcome Schema
const NursingOutcomeSchema = new mongoose.Schema(
  {
    outcome: { type: String, required: true, trim: true },
    indicators: [{ type: String, trim: true }],
    measurement_scale: { type: String, trim: true },
    noc_code: { type: String, trim: true }
  },
  { _id: false }
);

// Patient Safety Metrics Schema
const PatientSafetyMetricsSchema = new mongoose.Schema(
  {
    fall_risk_assessment: { type: Boolean, default: false },
    pressure_ulcer_risk: { type: Boolean, default: false },
    infection_control_measures: { type: Boolean, default: false },
    medication_safety: { type: Boolean, default: false },
    patient_education_provided: { type: Boolean, default: false },
    hand_hygiene_compliance: { type: Boolean, default: false },
    pain_assessment_documentation: { type: Boolean, default: false },
    vital_signs_monitoring: { type: Boolean, default: false }
  },
  { _id: false }
);

// Quality Metrics Schema
const QualityMetricsSchema = new mongoose.Schema(
  {
    patient_satisfaction_score: { type: Number, min: 0, max: 100 },
    medication_administration_errors: { type: Number, default: 0 },
    fall_incidents: { type: Number, default: 0 },
    pressure_ulcer_incidence: { type: Number, default: 0 },
    hospital_acquired_infections: { type: Number, default: 0 },
    readmission_rate: { type: Number, min: 0, max: 100 },
    patient_education_completion: { type: Number, min: 0, max: 100 },
    care_plan_adherence: { type: Number, min: 0, max: 100 }
  },
  { _id: false }
);

// Evaluation Criteria Schema
const EvaluationCriteriaSchema = new mongoose.Schema({}, { strict: false, _id: false }); // Flexible Map

// Enhanced Version History Schema
const VersionHistorySchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    changes: { type: String, required: true },
    status: { type: String, required: true },
    changeType: {
      type: String,
      enum: ['content_update', 'metadata_update', 'multimedia_add', 'multimedia_remove', 'review_feedback', 'approval'],
      required: true
    },
    affectedFields: [{ type: String }],
    multimediaChanges: [{
      action: { type: String, enum: ['added', 'removed', 'updated'] },
      fileId: String,
      filename: String
    }],
    reviewComments: String,
    reviewSuggestions: String
  },
  { _id: false }
);

// Case Template Schema
const CaseTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    discipline: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    difficulty: {
      type: String,
      required: true,
      enum: ['Easy', 'Intermediate', 'Hard']
    },
    tags: [{ type: String, trim: true }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CaseCategory' }],
    multimediaContent: [MultimediaContentSchema],
    templateData: {
      case_metadata: CaseMetadataSchema,
      patient_persona: PatientPersonaSchema,
      clinical_dossier: ClinicalDossierSchema,
      simulation_triggers: SimulationTriggerGroupSchema,
      evaluation_criteria: EvaluationCriteriaSchema
    },
    usageCount: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    lastModified: { type: Date, default: Date.now }
  }
);

// Main Case Schema
const CaseSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true, default: 1 },
    description: { type: String, required: true, trim: true },
    system_instruction: { type: String, required: true, trim: true },
    case_metadata: { type: CaseMetadataSchema, required: true },
    patient_persona: { type: PatientPersonaSchema, required: true },
    initial_prompt: { type: String, required: true, trim: true },
    clinical_dossier: { type: ClinicalDossierSchema, required: true },
    simulation_triggers: { type: SimulationTriggerGroupSchema, required: true },
    evaluation_criteria: { type: EvaluationCriteriaSchema, required: true },
    // Nursing-specific fields
    nursing_diagnoses: [NursingDiagnosisSchema],
    nursing_interventions: [NursingInterventionSchema],
    nursing_outcomes: [NursingOutcomeSchema],
    patient_safety_metrics: { type: PatientSafetyMetricsSchema },
    quality_metrics: { type: QualityMetricsSchema },
    // New multimedia and organization fields
    multimediaContent: [MultimediaContentSchema],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CaseCategory' }],
    tags: [{ type: String, trim: true }],
    isTemplate: { type: Boolean, default: false },
    templateSource: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
    // Enhanced versioning
    versionHistory: [VersionHistorySchema],
    // Collaboration and workflow
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    collaborators: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'viewer' },
      permissions: [{ type: String, enum: ['read', 'write', 'delete', 'share'] }],
      addedAt: { type: Date, default: Date.now },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    }],
    // Status and workflow
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'published', 'archived', 'rejected'],
      default: 'draft'
    },
    submittedForReviewAt: Date,
    submittedForReviewBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: Date,
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    archivedAt: Date,
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewComments: String,
    reviewSuggestions: String,
    // Publication metadata
    publicationMetadata: {
      accessLevel: {
        type: String,
        enum: ['public', 'restricted', 'private'],
        default: 'restricted'
      },
      availableFrom: { type: Date, default: Date.now },
      availableUntil: Date,
      targetAudience: [{
        discipline: String,
        specialty: String,
        program: String,
        level: String // e.g., 'beginner', 'intermediate', 'advanced'
      }],
      licensing: {
        type: { type: String, enum: ['educational', 'commercial', 'open'], default: 'educational' },
        attributionRequired: { type: Boolean, default: true },
        commercialUse: { type: Boolean, default: false },
        licenseUrl: String
      },
      distributionChannels: [{ type: String }], // e.g., 'platform', 'export', 'api'
      version: { type: String, default: '1.0.0' },
      doi: String,
      isbn: String,
      citation: String
    },
    // Access tracking
    accessLog: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      accessedAt: { type: Date, default: Date.now },
      userAgent: String,
      ipAddress: String,
      duration: Number // in seconds
    }],
    // Analytics and tracking
    usageCount: { type: Number, default: 0 },
    averageRating: { type: Number, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    lastAccessedAt: Date,
    accessCount: { type: Number, default: 0 }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

// Indexes for faster queries
CaseSchema.index({ 'case_metadata.case_id': 1 });
CaseSchema.index({ 'case_metadata.program_area': 1 });
CaseSchema.index({ 'case_metadata.specialty': 1 });
CaseSchema.index({ 'case_metadata.location': 1 });
CaseSchema.index({ 'case_metadata.difficulty': 1 });
CaseSchema.index({ tags: 1 });
CaseSchema.index({ categories: 1 });
CaseSchema.index({ status: 1 });
CaseSchema.index({ createdBy: 1 });
CaseSchema.index({ createdAt: -1 });
CaseSchema.index({ lastAccessedAt: -1 });
CaseSchema.index({ usageCount: -1 });
CaseSchema.index({ 'multimediaContent.type': 1 });
CaseSchema.index({ 'multimediaContent.category': 1 });
CaseSchema.index({ 'multimediaContent.tags': 1 });

// Create the models
const Case = mongoose.model('Case', CaseSchema);
const CaseCategory = mongoose.model('CaseCategory', CaseCategorySchema);
const CaseTemplate = mongoose.model('CaseTemplate', CaseTemplateSchema);

export default Case;
export { CaseCategory, CaseTemplate };
