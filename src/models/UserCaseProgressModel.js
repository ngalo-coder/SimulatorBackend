import mongoose from 'mongoose';

const UserCaseProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  caseId: { // ObjectId of the case from the 'cases' collection
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
  },
  originalCaseIdString: { // The human-readable case_id like "VP-ABD-002"
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['completed', 'skipped', 'in_progress_queue', 'viewed_in_queue'],
  },
  filterContextHash: { // MD5 or SHA256 hash of the sorted filter parameters string
    type: String,
    required: true,
  },
  sessionId: { // Optional: links to a UserQueueSessionModel entry
    type: String,
    trim: true,
    sparse: true, // Allows null/undefined values not to be indexed if you add an index here
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdatedAt' }, // Use lastUpdatedAt for consistency with field name
});

// Update lastUpdatedAt on every save
UserCaseProgressSchema.pre('save', function(next) {
  this.lastUpdatedAt = new Date();
  next();
});

// Compound index for efficiently querying user progress for a specific case within a filter context
UserCaseProgressSchema.index({ userId: 1, originalCaseIdString: 1, filterContextHash: 1 }, { unique: true });

// Index for finding cases by user, context, and status (e.g., finding 'in_progress_queue' cases)
UserCaseProgressSchema.index({ userId: 1, filterContextHash: 1, status: 1 });

// Index for finding all progress for a user
UserCaseProgressSchema.index({ userId: 1 });


const UserCaseProgress = mongoose.model('UserCaseProgress', UserCaseProgressSchema);

export default UserCaseProgress;
