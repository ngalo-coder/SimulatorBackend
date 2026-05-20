import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['Clinician', 'Patient', 'System', 'AI Evaluator'] // Added System and AI Evaluator
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const DiagnosticDecisionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['differential_diagnosis', 'diagnostic_test', 'treatment_plan']
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  is_correct: {
    type: Boolean,
    default: null
  },
  feedback: {
    type: String,
    trim: true
  }
}, { _id: false });

const SessionSchema = new mongoose.Schema({
  case_ref: { // Reference to the Case document in the 'cases' collection
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case', // This should match the model name given to mongoose.model() for cases
    required: true
  },
  original_case_id: { // Storing the string ID like "VP-ABD-002" for easier human/dev reference
    type: String,
    required: true,
    trim: true
  },
  // Retake session management
  is_retake: {
    type: Boolean,
    default: false
  },
  retake_attempt_number: {
    type: Number,
    default: 1,
    min: 1
  },
  previous_session_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  },
  retake_reason: {
    type: String,
    enum: ['self_improvement', 'educator_assigned', 'failed_attempt', 'practice'],
    default: 'self_improvement'
  },
  improvement_focus_areas: [{
    type: String,
    trim: true
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true // Allow null for anonymous sessions
  },
  history: [MessageSchema],
  diagnostic_decisions: [DiagnosticDecisionSchema],
  differential_diagnosis: [{
    condition: {
      type: String,
      required: true,
      trim: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    is_correct: {
      type: Boolean,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  diagnostic_tests: [{
    test_name: {
      type: String,
      required: true,
      trim: true
    },
    reason: {
      type: String,
      trim: true
    },
    result: {
      type: String,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    is_appropriate: {
      type: Boolean,
      default: null
    }
  }],
  treatment_plan: [{
    intervention: {
      type: String,
      required: true,
      trim: true
    },
    dosage: {
      type: String,
      trim: true
    },
    frequency: {
      type: String,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    is_correct: {
      type: Boolean,
      default: null
    }
  }],
  // Nursing-specific fields
  nursing_interventions: [{
    intervention: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      trim: true
    },
    parameters: [{
      type: String,
      trim: true
    }],
    expected_outcomes: [{
      type: String,
      trim: true
    }],
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  nursing_care_plan: {
    interventions: [{
      type: String,
      trim: true
    }],
    goals: [{
      type: String,
      trim: true
    }],
    evaluation: {
      type: mongoose.Schema.Types.Mixed
    },
    outcomes: {
      type: mongoose.Schema.Types.Mixed
    },
    submitted_at: {
      type: Date
    }
  },
  safety_metrics: {
    fall_risk_assessment: {
      type: Boolean,
      default: false
    },
    pressure_ulcer_risk: {
      type: Boolean,
      default: false
    },
    infection_control_measures: {
      type: Boolean,
      default: false
    },
    medication_safety: {
      type: Boolean,
      default: false
    },
    patient_education_provided: {
      type: Boolean,
      default: false
    },
    hand_hygiene_compliance: {
      type: Boolean,
      default: false
    },
    pain_assessment_documentation: {
      type: Boolean,
      default: false
    },
    vital_signs_monitoring: {
      type: Boolean,
      default: false
    }
  },
  quality_metrics: {
    patient_satisfaction_score: {
      type: Number,
      min: 0,
      max: 100
    },
    medication_administration_errors: {
      type: Number,
      default: 0
    },
    fall_incidents: {
      type: Number,
      default: 0
    },
    pressure_ulcer_incidence: {
      type: Number,
      default: 0
    },
    hospital_acquired_infections: {
      type: Number,
      default: 0
    },
    readmission_rate: {
      type: Number,
      min: 0,
      max: 100
    },
    patient_education_completion: {
      type: Number,
      min: 0,
      max: 100
    },
    care_plan_adherence: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  evaluation: {
    type: String,
    trim: true,
    default: null
  },
  sessionEnded: {
    type: Boolean,
    default: false
  },
  clinical_reasoning_score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  diagnostic_accuracy_score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  treatment_appropriateness_score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // Retake performance comparison metrics
  improvement_score: {
    type: Number,
    default: 0
  },
  areas_improved: [{
    metric: String,
    previous_score: Number,
    current_score: Number,
    improvement: Number
  }],
  areas_needing_work: [{
    metric: String,
    score: Number,
    recommendation: String
  }]
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexing for potential common queries
SessionSchema.index({ case_ref: 1 });
SessionSchema.index({ original_case_id: 1 });
SessionSchema.index({ createdAt: -1 }); // For fetching recent sessions
SessionSchema.index({ is_retake: 1 });
SessionSchema.index({ user: 1, case_ref: 1, is_retake: 1 }); // For user's retake sessions per case
SessionSchema.index({ user: 1, retake_attempt_number: -1 }); // For latest retake attempts

const Session = mongoose.model('Session', SessionSchema);

export default Session;
