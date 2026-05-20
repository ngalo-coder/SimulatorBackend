import mongoose from 'mongoose';

const UserQueueSessionSchema = new mongoose.Schema(
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
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      sparse: true
    },
    queuePosition: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['waiting', 'in_progress', 'completed', 'cancelled'],
      default: 'waiting'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    startedAt: {
      type: Date,
      sparse: true
    },
    completedAt: {
      type: Date,
      sparse: true
    }
  },
  {
    collection: 'user_queue_sessions',
    timestamps: true
  }
);

UserQueueSessionSchema.index({ userId: 1, status: 1 });
UserQueueSessionSchema.index({ caseId: 1, status: 1 });
UserQueueSessionSchema.index({ createdAt: -1 });

const UserQueueSession = mongoose.model('UserQueueSession', UserQueueSessionSchema);

export default UserQueueSession;
