import mongoose from "mongoose";

const RatingEnum = ["Excellent", "Very Good", "Good", "Fair", "Poor"];
const AccuracyEnum = ["Reached", "Missed", "Partially Reached", "Undetermined"];

const PerformanceMetricsSchema = new mongoose.Schema(
  {
    session_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    case_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      required: true,
      index: true,
    },
    user_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    metrics: {
      history_taking_rating: {
        type: String,
        enum: RatingEnum,
        default: "Not Assessed",
      },
      risk_factor_assessment_rating: {
        type: String,
        enum: RatingEnum,
        default: "Not Assessed",
      },
      differential_diagnosis_questioning_rating: {
        type: String,
        enum: RatingEnum,
        default: "Not Assessed",
      },
      communication_and_empathy_rating: {
        type: String,
        enum: RatingEnum,
        default: "Not Assessed",
      },
      clinical_urgency_rating: {
        type: String,
        enum: RatingEnum,
        default: "Not Assessed",
      },
      overall_diagnosis_accuracy: {
        type: String,
        enum: AccuracyEnum,
        default: "Undetermined",
      },
      overall_score: { type: Number, min: 0, max: 100, default: null },
      performance_label: {
        type: String,
        enum: RatingEnum,
        default: "Not Assessed",
      },
    },

    evaluation_summary: { type: String, trim: true },
    raw_evaluation_text: { type: String, required: true, trim: true },
    evaluated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

PerformanceMetricsSchema.index({ user_ref: 1, evaluated_at: -1 });
PerformanceMetricsSchema.index({ case_ref: 1, evaluated_at: -1 });

// Pre-save hook to set performance_label based on overall_score
PerformanceMetricsSchema.pre('save', function(next) {
  if (this.metrics.overall_score !== null && this.metrics.overall_score !== undefined) {
    const score = this.metrics.overall_score;
    if (score >= 85) {
      this.metrics.performance_label = 'Excellent';
    } else if (score >= 75) {
      this.metrics.performance_label = 'Very Good';
    } else if (score >= 65) {
      this.metrics.performance_label = 'Good';
    } else if (score >= 50) {
      this.metrics.performance_label = 'Fair';
    } else {
      this.metrics.performance_label = 'Poor';
    }
  }
  next();
});

const PerformanceMetrics = mongoose.model(
  "PerformanceMetrics",
  PerformanceMetricsSchema
);

export default PerformanceMetrics;