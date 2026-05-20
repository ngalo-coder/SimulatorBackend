import mongoose from 'mongoose';

// Schema for cases contributed by clinicians
const ContributedCaseSchema = new mongoose.Schema({
  // Contributor Information
  contributorId: { type: String, required: true },
  contributorName: { type: String, required: true },
  contributorEmail: { type: String, required: true },
  
  // Case Status
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'needs_revision'],
    default: 'draft'
  },
  
  // Review Information
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  reviewComments: { type: String },
  revisionRequests: [{
    field: String,
    comment: String,
    requestedAt: Date
  }],
  assignedReviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedReviewerName: {
    type: String
  },
  reviewDeadline: {
    type: Date
  },
  reviewPriority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  reviewScore: {
    type: Number,
    min: 1,
    max: 5
  },
  qualityRating: {
    type: Number,
    min: 1,
    max: 5
  },
  educationalValueRating: {
    type: Number,
    min: 1,
    max: 5
  },
  clinicalAccuracyRating: {
    type: Number,
    min: 1,
    max: 5
  },
  communicationRating: {
    type: Number,
    min: 1,
    max: 5
  },
  culturalAppropriatenessRating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  // Case Content (matching your existing case structure)
  caseData: {
    version: { type: String, default: "3.1-program-aware" },
    description: { type: String, default: "A case contributed by a clinician" },
    system_instruction: { type: String, default: "You are an AI-powered virtual patient..." },
    
    case_metadata: {
      case_id: { type: String, required: true, unique: true },
      title: { type: String, required: true },
      specialty: { type: String, required: true },
      program_area: { 
        type: String, 
        required: true,
        enum: ['Basic Program', 'Specialty Program']
      },
      module: { type: String },
      difficulty: { 
        type: String, 
        required: true,
        enum: ['Easy', 'Intermediate', 'Hard']
      },
      tags: [{ type: String }],
      location: { type: String, required: true }
    },
    
    patient_persona: {
      name: { type: String, required: true },
      age: { type: Number, required: true },
      gender: { type: String, required: true },
      occupation: { type: String },
      chief_complaint: { type: String, required: true },
      emotional_tone: { type: String, required: true },
      background_story: { type: String },
      // Pediatric fields
      is_pediatric: { type: Boolean },
      pediatric_threshold: { type: Number },
      guardian: {
        name: { type: String },
        relationship: { type: String },
        age: { type: Number },
        occupation: { type: String },
        emotional_state: { type: String },
        background_info: { type: String },
        communication_style: { type: String }
      }
    },
    
    initial_prompt: { type: String, required: true },
    
    clinical_dossier: {
      comment: { type: String, default: "This is the AI's source of truth." },
      hidden_diagnosis: { type: String, required: true },
      history_of_presenting_illness: {
        onset: String,
        location: String,
        radiation: String,
        character: String,
        severity: Number,
        timing_and_duration: String,
        exacerbating_factors: String,
        relieving_factors: String,
        associated_symptoms: [String]
      },
      review_of_systems: {
        positive: [String],
        negative: [String]
      },
      past_medical_history: [String],
      medications: [String],
      allergies: [String],
      surgical_history: [String],
      family_history: [String],
      social_history: {
        smoking_status: String,
        alcohol_use: String,
        substance_use: String,
        diet_and_exercise: String,
        living_situation: String
      }
    },
    
    simulation_triggers: {
      end_session: {
        condition_keyword: String,
        patient_response: String
      },
      invalid_input: {
        response: String
      }
    },
    
    evaluation_criteria: {
      type: Map,
      of: String
    }
  },
  
  // Timestamps
  submittedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // Review tracking
  reviewRound: {
    type: Number,
    default: 1
  },
  totalReviewTime: {
    type: Number, // in minutes
    default: 0
  },
  lastReviewStartedAt: {
    type: Date
  },
  lastReviewCompletedAt: {
    type: Date
  },

  // Student feedback metrics
  studentFeedbackCount: {
    type: Number,
    default: 0
  },
  averageStudentRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 0
  },
  studentFeedbackComments: [{
    comment: String,
    rating: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Case effectiveness metrics
  effectivenessMetrics: {
    totalSessions: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    passRate: { type: Number, default: 0 }, // Percentage of sessions with score >= 70
    excellentRate: { type: Number, default: 0 }, // Percentage of sessions with score >= 85
    avgCompletionTime: { type: Number, default: 0 }, // Average session duration in minutes
    lastUpdated: { type: Date, default: Date.now }
  },

  // Quality assurance flags
  qualityFlags: {
    needsContentReview: { type: Boolean, default: false },
    needsDifficultyAdjustment: { type: Boolean, default: false },
    technicalIssuesReported: { type: Boolean, default: false },
    lastQualityCheck: { type: Date }
  }
});

// Update the updatedAt field on save
ContributedCaseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate case ID if not provided
ContributedCaseSchema.pre('save', function(next) {
  if (!this.caseData.case_metadata.case_id) {
    const specialty = this.caseData.case_metadata.specialty;
    const module = this.caseData.case_metadata.module;
    const timestamp = Date.now().toString().slice(-6);
    
    // Generate ID based on specialty/module
    let prefix = 'VP-CONTRIB-';
    if (specialty === 'Internal Medicine' && module) {
      const moduleMap = {
        'Cardiovascular System': 'CARD',
        'Tropical Medicine': 'ID',
        'Central Nervous System': 'NEURO',
        'Respiratory System': 'PULM',
        'Genital Urinary System': 'NEPH',
        'Musculoskeletal System': 'RHEUM',
        'Endocrinology': 'ENDO',
        'Emergency Medicine': 'EM'
      };
      prefix = `VP-${moduleMap[module] || 'IM'}-`;
    } else if (specialty === 'Pediatrics') {
      prefix = 'VP-PED-';
    }
    
    this.caseData.case_metadata.case_id = `${prefix}${timestamp}`;
  }
  next();
});

// Method to assign reviewer
ContributedCaseSchema.methods.assignReviewer = function(reviewerId, reviewerName, deadline, priority) {
  this.assignedReviewerId = reviewerId;
  this.assignedReviewerName = reviewerName;
  this.reviewDeadline = deadline;
  this.reviewPriority = priority;
  this.status = 'under_review';
  return this.save();
};

// Method to complete review
ContributedCaseSchema.methods.completeReview = function(decision, feedback, ratings) {
  this.status = decision === 'approved' ? 'approved' : decision;
  this.finalDecision = decision;
  this.decisionReason = feedback;
  this.reviewedAt = new Date();
  
  // Update ratings if provided
  if (ratings) {
    if (ratings.reviewScore) this.reviewScore = ratings.reviewScore;
    if (ratings.qualityRating) this.qualityRating = ratings.qualityRating;
    if (ratings.educationalValueRating) this.educationalValueRating = ratings.educationalValueRating;
    if (ratings.clinicalAccuracyRating) this.clinicalAccuracyRating = ratings.clinicalAccuracyRating;
    if (ratings.communicationRating) this.communicationRating = ratings.communicationRating;
    if (ratings.culturalAppropriatenessRating) this.culturalAppropriatenessRating = ratings.culturalAppropriatenessRating;
  }
  
  return this.save();
};

// Method to request revisions
ContributedCaseSchema.methods.requestRevisions = function(feedback) {
  this.status = 'needs_revision';
  this.revisionRequests.push({
    field: 'general',
    comment: feedback,
    requestedAt: new Date()
  });
  this.reviewRound += 1;
  return this.save();
};

export default mongoose.model('ContributedCase', ContributedCaseSchema);