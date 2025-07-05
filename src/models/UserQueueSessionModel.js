import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const UserQueueSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    unique: true,
    required: true,
    default: uuidv4, // Automatically generate a UUID for sessionId
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  filterContextHash: { // MD5 or SHA256 hash of the sorted filter parameters string
    type: String,
    required: true,
  },
  filtersApplied: { // Store the actual filters used for this session
    type: mongoose.Schema.Types.Mixed, // Allows for flexible filter object structure
    required: true,
  },
  queuedCaseIds: { // List of originalCaseIdString values
    type: [String],
    required: true,
  },
  currentCaseIndex: {
    type: Number,
    required: true,
    default: -1, // -1 indicates no case selected yet or queue is new
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '24h', // Automatically delete session documents after 24 hours
                    // MongoDB TTL index will handle this.
  },
}, {
  timestamps: { createdAt: true, updatedAt: true } // createdAt will be managed by default: Date.now
});

// Ensure TTL index is created for `createdAt` field for session expiration
UserQueueSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 0 }); // expireAfterSeconds: 0 means use 'expires' from schema field

// Index for quickly finding sessions by sessionId
UserQueueSessionSchema.index({ sessionId: 1 });

// Index for finding user's active sessions or sessions by user and filter context
UserQueueSessionSchema.index({ userId: 1, filterContextHash: 1 });
UserQueueSessionSchema.index({ userId: 1 });


const UserQueueSession = mongoose.model('UserQueueSession', UserQueueSessionSchema);

export default UserQueueSession;
