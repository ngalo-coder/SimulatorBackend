import mongoose from 'mongoose';

const UserCaseProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'abandoned'],
      default: 'not_started'
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    startedAt: {
      type: Date,
      sparse: true
    },
    completedAt: {
      type: Date,
      sparse: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      sparse: true
    },
    feedback: {
      type: String,
      sparse: true
    }
  },
  {
    collection: 'user_case_progress',
    timestamps: true
  }
);

UserCaseProgressSchema.index({ userId: 1, caseId: 1 });
UserCaseProgressSchema.index({ userId: 1, status: 1 });

const UserCaseProgress = mongoose.model('UserCaseProgress', UserCaseProgressSchema);

export default UserCaseProgress;
