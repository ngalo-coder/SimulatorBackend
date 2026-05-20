import mongoose from 'mongoose';

// Review status options
const ReviewStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Review decision options
const ReviewDecision = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_REVISION: 'needs_revision',
  PENDING: 'pending'
};

// Annotation types for case content
const AnnotationType = {
  COMMENT: 'comment',
  SUGGESTION: 'suggestion',
  CORRECTION: 'correction',
  QUESTION: 'question',
  HIGHLIGHT: 'highlight'
};

// Schema for individual annotations/comments
const AnnotationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(AnnotationType),
    required: true
  },
  fieldPath: {
    type: String,
    required: true // e.g., "case_metadata.title", "patient_persona.age"
  },
  content: {
    type: String,
    required: true
  },
  suggestedValue: {
    type: mongoose.Schema.Types.Mixed // For correction type annotations
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Schema for review sessions
const CaseReviewSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContributedCase',
    required: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewerName: {
    type: String,
    required: true
  },
  reviewerDiscipline: {
    type: String,
    required: true
  },
  reviewerSpecialty: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(ReviewStatus),
    default: ReviewStatus.PENDING
  },
  decision: {
    type: String,
    enum: Object.values(ReviewDecision),
    default: ReviewDecision.PENDING
  },
  overallFeedback: {
    type: String
  },
  ratings: {
    clinicalAccuracy: {
      type: Number,
      min: 1,
      max: 5
    },
    educationalValue: {
      type: Number,
      min: 1,
      max: 5
    },
    completeness: {
      type: Number,
      min: 1,
      max: 5
    },
    clarity: {
      type: Number,
      min: 1,
      max: 5
    },
    culturalAppropriateness: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  annotations: [AnnotationSchema],
  timeSpent: {
    type: Number, // in minutes
    default: 0
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  deadline: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  revisionRound: {
    type: Number,
    default: 1
  },
  previousReviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CaseReview'
  },
  metadata: {
    caseProgramArea: String,
    caseSpecialty: String,
    caseDifficulty: String,
    contributorExperience: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
CaseReviewSchema.index({ caseId: 1, status: 1 });
CaseReviewSchema.index({ reviewerId: 1, status: 1 });
CaseReviewSchema.index({ status: 1, deadline: 1 });
CaseReviewSchema.index({ 'metadata.caseSpecialty': 1, status: 1 });
CaseReviewSchema.index({ createdAt: 1 });

// Method to start review
CaseReviewSchema.methods.startReview = function() {
  this.status = ReviewStatus.IN_PROGRESS;
  this.startedAt = new Date();
  return this.save();
};

// Method to complete review
CaseReviewSchema.methods.completeReview = function(decision, feedback, ratings) {
  this.status = ReviewStatus.COMPLETED;
  this.decision = decision;
  this.overallFeedback = feedback;
  this.completedAt = new Date();
  
  if (ratings) {
    this.ratings = { ...this.ratings, ...ratings };
  }
  
  return this.save();
};

// Method to add annotation
CaseReviewSchema.methods.addAnnotation = function(annotationData) {
  this.annotations.push({
    ...annotationData,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return this.save();
};

// Method to resolve annotation
CaseReviewSchema.methods.resolveAnnotation = function(annotationIndex, resolvedBy) {
  if (this.annotations[annotationIndex]) {
    this.annotations[annotationIndex].resolved = true;
    this.annotations[annotationIndex].resolvedAt = new Date();
    this.annotations[annotationIndex].resolvedBy = resolvedBy;
    this.annotations[annotationIndex].updatedAt = new Date();
  }
  return this.save();
};

// Static method to get reviews by case
CaseReviewSchema.statics.findByCaseId = function(caseId) {
  return this.find({ caseId })
    .populate('reviewerId', 'username profile.firstName profile.lastName discipline')
    .sort({ createdAt: -1 });
};

// Static method to get pending reviews for reviewer
CaseReviewSchema.statics.findPendingByReviewer = function(reviewerId) {
  return this.find({ 
    reviewerId, 
    status: { $in: [ReviewStatus.PENDING, ReviewStatus.IN_PROGRESS] } 
  })
  .populate('caseId', 'caseData.case_metadata.title caseData.case_metadata.specialty status')
  .sort({ priority: -1, deadline: 1 });
};

export default mongoose.model('CaseReview', CaseReviewSchema);