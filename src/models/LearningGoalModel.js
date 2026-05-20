import mongoose from 'mongoose';

const LearningGoalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      sparse: true
    },
    targetCompetencies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competency'
    }],
    targetCases: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case'
    }],
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    targetDate: {
      type: Date,
      sparse: true
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    notes: {
      type: String,
      sparse: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      sparse: true
    }
  },
  {
    collection: 'learning_goals',
    timestamps: true
  }
);

LearningGoalSchema.index({ userId: 1, status: 1 });

const LearningGoal = mongoose.model('LearningGoal', LearningGoalSchema);

export default LearningGoal;
