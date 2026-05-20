import mongoose from 'mongoose';

const ProgramAreaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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
    cases: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case'
    }],
    competencies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competency'
    }],
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
    collection: 'program_areas',
    timestamps: true
  }
);

ProgramAreaSchema.index({ specialty: 1, isActive: 1 });

const ProgramArea = mongoose.model('ProgramArea', ProgramAreaSchema);

export default ProgramArea;
