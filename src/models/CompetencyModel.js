import mongoose from 'mongoose';

const CompetencySchema = new mongoose.Schema({
  // Core competency information
  competencyId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  competencyName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['clinical', 'technical', 'communication', 'professional', 'analytical'],
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  
  // Framework and standards
  framework: {
    type: String,
    required: true,
    enum: ['MCF-2024', 'ACGME', 'CANMeds', 'custom'],
    default: 'MCF-2024'
  },
  frameworkVersion: {
    type: String,
    default: '1.0'
  },
  standardId: {
    type: String,
    trim: true
  },
  
  // Level definitions
  levels: [{
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    levelName: {
      type: String,
      required: true,
      enum: ['novice', 'advanced_beginner', 'competent', 'proficient', 'expert']
    },
    description: {
      type: String,
      required: true
    },
    targetScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    behaviors: [{
      type: String,
      trim: true
    }]
  }],
  
  // Assessment criteria
  assessmentCriteria: [{
    criterion: {
      type: String,
      required: true,
      trim: true
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    description: {
      type: String,
      trim: true
    }
  }],
  
  // Learning resources and references
  learningResources: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      enum: ['article', 'video', 'course', 'guideline', 'book']
    },
    url: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  }],
  
  // Related competencies
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competency'
  }],
  relatedCompetencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competency'
  }],
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  isCore: {
    type: Boolean,
    default: false
  },
  difficultyLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'intermediate'
  },
  estimatedMasteryTime: {
    type: Number, // in hours
    min: 0
  },
  
  // Case associations
  associatedCases: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Indexes for efficient queries
CompetencySchema.index({ competencyId: 1 });
CompetencySchema.index({ competencyName: 1 });
CompetencySchema.index({ category: 1 });
CompetencySchema.index({ framework: 1 });
CompetencySchema.index({ isActive: 1 });
CompetencySchema.index({ isCore: 1 });

// Pre-save hook to update timestamps
CompetencySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to find by category
CompetencySchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true });
};

// Static method to find by framework
CompetencySchema.statics.findByFramework = function(framework) {
  return this.find({ framework, isActive: true });
};

// Static method to get core competencies
CompetencySchema.statics.getCoreCompetencies = function() {
  return this.find({ isCore: true, isActive: true });
};

// Method to get level information
CompetencySchema.methods.getLevelInfo = function(levelNumber) {
  return this.levels.find(level => level.level === levelNumber);
};

// Method to calculate progress percentage
CompetencySchema.methods.calculateProgress = function(currentScore) {
  const targetLevel = this.levels.find(level => level.level === 5); // Expert level
  if (!targetLevel) return 0;
  
  return Math.min(100, Math.round((currentScore / targetLevel.targetScore) * 100));
};

export default mongoose.model('Competency', CompetencySchema);