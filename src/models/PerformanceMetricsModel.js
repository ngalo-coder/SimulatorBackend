import mongoose from 'mongoose';

const PerformanceMetricsSchema = new mongoose.Schema({
  session_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true
  },
  case_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    index: true
  },
  user_ref: { // Optional: To be implemented if user accounts are added
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  metrics: {
    history_taking_rating: { type: String, trim: true },
    risk_factor_assessment_rating: { type: String, trim: true },
    differential_diagnosis_questioning_rating: { type: String, trim: true },
    communication_and_empathy_rating: { type: String, trim: true },
    clinical_urgency_rating: { type: String, trim: true },
    overall_diagnosis_accuracy: { type: String, trim: true } // e.g., "Reached", "Missed", "Partially Reached"
  },
  evaluation_summary: { // A brief summary, potentially extracted from the AI's "Summary & Recommendations"
    type: String,
    trim: true
  },
  raw_evaluation_text: { // The full text of the AI evaluation for reference and reprocessing if needed
    type: String,
    required: true,
    trim: true
  },
  evaluated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexing for potential common queries
PerformanceMetricsSchema.index({ user_ref: 1, case_ref: 1 }); // For user-specific performance on cases
PerformanceMetricsSchema.index({ evaluated_at: -1 });

const PerformanceMetrics = mongoose.model('PerformanceMetrics', PerformanceMetricsSchema);

export default PerformanceMetrics;
