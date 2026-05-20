import mongoose from 'mongoose';

const CriterionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    sparse: true
  },
  maxPoints: {
    type: Number,
    required: true,
    min: 0
  },
  levels: [{
    level: Number,
    description: String,
    points: Number
  }]
}, { _id: false });

const ScoringRubricSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true
    },
    description: {
      type: String,
      sparse: true
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      sparse: true
    },
    specialty: {
      type: String,
      sparse: true,
      index: true
    },
    totalPoints: {
      type: Number,
      required: true,
      min: 0
    },
    criteria: [CriterionSchema],
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    collection: 'scoring_rubrics',
    timestamps: true
  }
);

ScoringRubricSchema.index({ specialty: 1, isActive: 1 });

const ScoringRubric = mongoose.model('ScoringRubric', ScoringRubricSchema);

export default ScoringRubric;
