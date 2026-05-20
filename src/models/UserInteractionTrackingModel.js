import mongoose from 'mongoose';

// Interaction type enum
export const InteractionType = {
  CASE_START: 'case_start',
  CASE_COMPLETE: 'case_complete',
  CASE_PAUSE: 'case_pause',
  CASE_RESUME: 'case_resume',
  CASE_ABANDON: 'case_abandon',
  HELP_REQUEST: 'help_request',
  FEEDBACK_SUBMIT: 'feedback_submit',
  CONTENT_VIEW: 'content_view',
  SEARCH: 'search',
  NAVIGATION: 'navigation'
};

// Resource type enum
export const ResourceType = {
  CASE: 'case',
  LEARNING_MODULE: 'learning_module',
  FEEDBACK: 'feedback',
  GUIDE: 'guide',
  ASSESSMENT: 'assessment',
  OTHER: 'other'
};

// Help request type enum
export const HelpRequestType = {
  HINT: 'hint',
  CLINICAL_QUESTION: 'clinical_question',
  TECHNICAL_ISSUE: 'technical_issue',
  GENERAL_HELP: 'general_help',
  CLARIFICATION: 'clarification'
};

// Engagement level enum
export const EngagementLevel = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  VERY_HIGH: 'very_high'
};

// Metadata schema for flexible additional data
const MetadataSchema = new mongoose.Schema({}, { strict: false, _id: false });

// User Interaction Tracking Schema
const UserInteractionTrackingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    interactionType: {
      type: String,
      enum: Object.values(InteractionType),
      required: true,
      index: true
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      sparse: true
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      sparse: true
    },
    resourceType: {
      type: String,
      enum: Object.values(ResourceType),
      sparse: true
    },
    helpRequestType: {
      type: String,
      enum: Object.values(HelpRequestType),
      sparse: true
    },
    engagementScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    engagementLevel: {
      type: String,
      enum: Object.values(EngagementLevel),
      default: EngagementLevel.MODERATE
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: 0
    },
    sessionId: {
      type: String,
      sparse: true
    },
    metadata: {
      type: MetadataSchema,
      default: {}
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'user_interaction_tracking',
    timestamps: true
  }
);

// Indexes for efficient querying
UserInteractionTrackingSchema.index({ userId: 1, createdAt: -1 });
UserInteractionTrackingSchema.index({ interactionType: 1, createdAt: -1 });
UserInteractionTrackingSchema.index({ caseId: 1, createdAt: -1 });
UserInteractionTrackingSchema.index({ userId: 1, interactionType: 1, createdAt: -1 });
UserInteractionTrackingSchema.index({ createdAt: -1 });
UserInteractionTrackingSchema.index({ sessionId: 1 });

// Create the model
const UserInteractionTracking = mongoose.model(
  'UserInteractionTracking',
  UserInteractionTrackingSchema
);

// Static method for getting paginated user interactions
UserInteractionTracking.getUserInteractions = async function(userId, limit = 100, page = 1) {
  const skip = (page - 1) * limit;
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

export default UserInteractionTracking;
