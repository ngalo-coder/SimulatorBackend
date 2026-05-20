import mongoose from 'mongoose';

// Feedback types
const FeedbackType = {
  CASE_QUALITY: 'case_quality',
  SYSTEM_USABILITY: 'system_usability',
  EDUCATIONAL_VALUE: 'educational_value',
  TECHNICAL_ISSUES: 'technical_issues',
  GENERAL_FEEDBACK: 'general_feedback'
};

// Sentiment labels
const SentimentLabel = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative'
};

// Feedback schema
const FeedbackSchema = new mongoose.Schema({
  // User who submitted the feedback
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Case reference (optional - for case-specific feedback)
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContributedCase',
    required: false,
    index: true
  },

  // Type of feedback
  feedbackType: {
    type: String,
    enum: Object.values(FeedbackType),
    required: true,
    index: true
  },

  // Rating from 1-5 stars
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },

  // Detailed comments
  comments: {
    type: String,
    trim: true,
    maxlength: 2000
  },

  // Automated sentiment analysis
  sentiment: {
    type: String,
    enum: Object.values(SentimentLabel),
    default: SentimentLabel.NEUTRAL
  },

  // Additional metadata
  metadata: {
    userAgent: String, // Browser/user agent info
    pageUrl: String,   // URL where feedback was submitted
    timestamp: {
      type: Date,
      default: Date.now
    }
  },

  // Status for moderation
  status: {
    type: String,
    enum: ['active', 'archived', 'flagged'],
    default: 'active'
  },

  // Admin response (if any)
  adminResponse: {
    response: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  }

}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for efficient querying
FeedbackSchema.index({ userId: 1, createdAt: -1 });
FeedbackSchema.index({ caseId: 1, createdAt: -1 });
FeedbackSchema.index({ feedbackType: 1, sentiment: 1 });
FeedbackSchema.index({ createdAt: 1 });

// Static method to get feedback by user
FeedbackSchema.statics.findByUserId = function(userId, limit = 50) {
  return this.find({ userId })
    .populate('caseId', 'caseData.case_metadata.title caseData.case_metadata.specialty')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get feedback by case
FeedbackSchema.statics.findByCaseId = function(caseId, limit = 50) {
  return this.find({ caseId })
    .populate('userId', 'username profile.firstName profile.lastName discipline')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get average rating for a case
FeedbackSchema.statics.getCaseAverageRating = function(caseId) {
  return this.aggregate([
    { $match: { caseId: new mongoose.Types.ObjectId(caseId) } },
    {
      $group: {
        _id: '$caseId',
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 },
        positiveCount: {
          $sum: { $cond: [{ $eq: ['$sentiment', SentimentLabel.POSITIVE] }, 1, 0] }
        },
        negativeCount: {
          $sum: { $cond: [{ $eq: ['$sentiment', SentimentLabel.NEGATIVE] }, 1, 0] }
        }
      }
    }
  ]);
};

// Method to add admin response
FeedbackSchema.methods.addAdminResponse = function(response, adminId) {
  this.adminResponse = {
    response,
    respondedBy: adminId,
    respondedAt: new Date()
  };
  return this.save();
};

// Method to update status
FeedbackSchema.methods.updateStatus = function(status) {
  this.status = status;
  return this.save();
};

export default mongoose.model('Feedback', FeedbackSchema);
export { FeedbackType, SentimentLabel };