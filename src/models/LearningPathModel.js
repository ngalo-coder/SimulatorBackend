import mongoose from 'mongoose';

const LearningPathSchema = new mongoose.Schema(
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
    specialty: {
      type: String,
      required: true,
      index: true
    },
    difficultyLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    cases: [{
      caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case'
      },
      order: Number,
      required: {
        type: Boolean,
        default: true
      }
    }],
    competencies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competency'
    }],
    estimatedDuration: {
      type: Number,
      sparse: true
    },
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
    collection: 'learning_paths',
    timestamps: true
  }
);

LearningPathSchema.index({ specialty: 1, isActive: 1 });

const LearningPath = mongoose.model('LearningPath', LearningPathSchema);

export default LearningPath;
