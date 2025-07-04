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
  history: [MessageSchema],
  evaluation: {
    type: String,
    trim: true,
    default: null
  },
  sessionEnded: {
    type: Boolean,
    default: false
  },
  // You could add a userId here later if you implement user accounts
  // userId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',
  //   required: false // Or true if sessions must belong to a user
  // },
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexing for potential common queries
SessionSchema.index({ case_ref: 1 });
SessionSchema.index({ original_case_id: 1 });
SessionSchema.index({ createdAt: -1 }); // For fetching recent sessions

const Session = mongoose.model('Session', SessionSchema);

export default Session;
