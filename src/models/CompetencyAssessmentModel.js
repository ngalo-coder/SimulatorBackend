import mongoose from 'mongoose';

const CompetencyAssessmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    competencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competency',
      required: true,
      index: true
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      sparse: true
    },
    assessmentType: {
      type: String,
      enum: ['case_based', 'quiz', 'practical', 'peer_review'],
      default: 'case_based'
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    level: {
      type: Number,
      min: 1,
      max: 5,
      default: 1
    },
    feedback: {
      type: String,
      sparse: true
    },
    assessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },
    assessedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'competency_assessments',
    timestamps: true
  }
);

CompetencyAssessmentSchema.index({ userId: 1, competencyId: 1 });
CompetencyAssessmentSchema.index({ userId: 1, assessedAt: -1 });

const CompetencyAssessment = mongoose.model('CompetencyAssessment', CompetencyAssessmentSchema);

export default CompetencyAssessment;
