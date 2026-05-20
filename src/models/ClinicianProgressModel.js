import mongoose from 'mongoose';

const ClinicianProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Track progress by difficulty level
  beginnerCasesCompleted: {
    type: Number,
    default: 0
  },
  intermediateCasesCompleted: {
    type: Number,
    default: 0
  },
  advancedCasesCompleted: {
    type: Number,
    default: 0
  },
  // Track performance metrics by difficulty level
  beginnerAverageScore: {
    type: Number,
    default: 0
  },
  intermediateAverageScore: {
    type: Number,
    default: 0
  },
  advancedAverageScore: {
    type: Number,
    default: 0
  },
  // Track total cases and overall progress
  totalCasesCompleted: {
    type: Number,
    default: 0
  },
  overallAverageScore: {
    type: Number,
    default: 0
  },
  // Track progression level
  currentProgressionLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
    default: 'Beginner'
  },
  // Track last completed case for each difficulty
  lastCompletedBeginnerCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },
  lastCompletedIntermediateCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },
  lastCompletedAdvancedCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },
  // Track completion timestamps
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update lastUpdatedAt on every save
ClinicianProgressSchema.pre('save', function(next) {
  this.lastUpdatedAt = new Date();
  next();
});

// Create index for efficient lookups
ClinicianProgressSchema.index({ userId: 1 }, { unique: true });

const ClinicianProgress = mongoose.model('ClinicianProgress', ClinicianProgressSchema);

export default ClinicianProgress;