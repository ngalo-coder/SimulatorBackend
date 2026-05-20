import mongoose from 'mongoose';

const LearningModuleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  content: {
    type: String,
    trim: true
  },
  moduleType: {
    type: String,
    enum: ['text', 'video', 'quiz', 'interactive', 'assessment'],
    default: 'text'
  },
  duration: {
    type: Number, // in minutes
    min: 0,
    default: 0
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  order: {
    type: Number,
    min: 0,
    required: true
  },
  prerequisites: [{
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningModule'
    },
    requiredScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  }],
  learningObjectives: [{
    type: String,
    trim: true
  }],
  resources: [{
    title: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['document', 'video', 'article', 'external_link'],
      default: 'document'
    }
  }],
  assessmentCriteria: {
    passingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 70
    },
    maxAttempts: {
      type: Number,
      min: 1,
      default: 3
    },
    timeLimit: {
      type: Number, // in minutes
      min: 0,
      default: 0
    }
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    version: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },
    tags: [{
      type: String,
      trim: true
    }]
  }
}, {
  timestamps: true
});

// Update the updatedAt field before saving
LearningModuleSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

// Indexes for efficient queries
LearningModuleSchema.index({ title: 'text', description: 'text' });
LearningModuleSchema.index({ 'metadata.status': 1 });
LearningModuleSchema.index({ order: 1 });
LearningModuleSchema.index({ difficulty: 1 });
LearningModuleSchema.index({ 'metadata.createdBy': 1 });

// Virtual for module completion status (can be used in progress tracking)
LearningModuleSchema.virtual('isPublished').get(function() {
  return this.metadata.status === 'published';
});

// Method to check if prerequisites are met
LearningModuleSchema.methods.checkPrerequisites = function(completedModules = []) {
  if (!this.prerequisites || this.prerequisites.length === 0) {
    return true;
  }

  return this.prerequisites.every(prereq => {
    const completedModule = completedModules.find(cm => cm.moduleId.equals(prereq.moduleId));
    return completedModule && completedModule.score >= prereq.requiredScore;
  });
};

// Method to get module summary
LearningModuleSchema.methods.getSummary = function() {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    moduleType: this.moduleType,
    duration: this.duration,
    difficulty: this.difficulty,
    order: this.order,
    prerequisites: this.prerequisites.length,
    learningObjectives: this.learningObjectives.length,
    resources: this.resources.length,
    status: this.metadata.status
  };
};

const LearningModule = mongoose.model('LearningModule', LearningModuleSchema);

export default LearningModule;