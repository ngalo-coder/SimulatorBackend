import mongoose from 'mongoose';

const CompetencyLevelSchema = new mongoose.Schema({
  competencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competency',
    required: true
  },
  competencyName: {
    type: String,
    required: true,
    trim: true
  },
  proficiencyLevel: {
    type: String,
    enum: ['Novice', 'Beginner', 'Competent', 'Proficient', 'Expert'],
    default: 'Novice'
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  casesAttempted: {
    type: Number,
    default: 0
  },
  casesMastered: {
    type: Number,
    default: 0
  },
  lastAssessed: {
    type: Date,
    default: Date.now
  }
});

const CaseAttemptSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  caseTitle: {
    type: String,
    required: true,
    trim: true
  },
  attemptNumber: {
    type: Number,
    required: true,
    min: 1
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    min: 0
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['completed', 'failed', 'abandoned', 'in_progress'],
    required: true
  },
  detailedMetrics: {
    historyTakingRating: {
      type: String,
      enum: ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor', 'Not Assessed'],
      default: 'Not Assessed'
    },
    diagnosisAccuracy: {
      type: String,
      enum: ['Reached', 'Missed', 'Partially Reached', 'Undetermined'],
      default: 'Undetermined'
    },
    treatmentEffectiveness: {
      type: Number,
      min: 0,
      max: 100
    },
    communicationSkills: {
      type: Number,
      min: 0,
      max: 100
    },
    criticalThinking: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  feedback: {
    type: String,
    trim: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  }
});

const LearningPathProgressSchema = new mongoose.Schema({
  pathId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath',
    required: true
  },
  pathName: {
    type: String,
    required: true,
    trim: true
  },
  currentModule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningModule'
  },
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  modulesCompleted: {
    type: Number,
    default: 0
  },
  totalModules: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  estimatedCompletion: {
    type: Date
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'paused', 'completed'],
    default: 'not_started'
  }
});

const MilestoneSchema = new mongoose.Schema({
  milestoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Milestone',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  achievedDate: {
    type: Date,
    required: true
  },
  criteria: {
    type: String,
    trim: true
  },
  rewardPoints: {
    type: Number,
    default: 0
  }
});

const AchievementSchema = new mongoose.Schema({
  achievementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['skill', 'completion', 'performance', 'participation'],
    required: true
  },
  earnedDate: {
    type: Date,
    required: true
  },
  badgeUrl: {
    type: String,
    trim: true
  },
  tier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  }
});

const StudentProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    unique: true
  },
  overallProgress: {
    totalCasesAttempted: {
      type: Number,
      default: 0
    },
    totalCasesCompleted: {
      type: Number,
      default: 0
    },
    totalLearningHours: {
      type: Number, // in hours
      default: 0
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    currentLevel: {
      type: String,
      enum: ['Novice', 'Beginner', 'Competent', 'Proficient', 'Expert'],
      default: 'Novice'
    },
    experiencePoints: {
      type: Number,
      default: 0
    }
  },
  competencies: [CompetencyLevelSchema],
  caseAttempts: [CaseAttemptSchema],
  learningPaths: [LearningPathProgressSchema],
  milestones: [MilestoneSchema],
  achievements: [AchievementSchema],
  lastActivity: {
    type: Date,
    default: Date.now
  },
  streak: {
    currentStreak: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    lastActivityDate: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Update lastActivity on every save
StudentProgressSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  
  // Update streak information
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (this.streak.lastActivityDate) {
    const lastDate = new Date(this.streak.lastActivityDate);
    lastDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      this.streak.currentStreak += 1;
    } else if (diffDays > 1) {
      // Broken streak
      this.streak.currentStreak = 1;
    }
    // If diffDays === 0, same day - no change
  } else {
    // First activity
    this.streak.currentStreak = 1;
  }
  
  this.streak.lastActivityDate = today;
  this.streak.longestStreak = Math.max(this.streak.longestStreak, this.streak.currentStreak);
  
  next();
});

// Indexes for efficient queries
StudentProgressSchema.index({ userId: 1 });
StudentProgressSchema.index({ 'overallProgress.currentLevel': 1 });
StudentProgressSchema.index({ 'competencies.competencyId': 1 });
StudentProgressSchema.index({ 'caseAttempts.caseId': 1 });
StudentProgressSchema.index({ 'learningPaths.pathId': 1 });
StudentProgressSchema.index({ 'achievements.type': 1 });
StudentProgressSchema.index({ lastActivity: -1 });

// Virtual for progress percentage
StudentProgressSchema.virtual('progressPercentage').get(function() {
  const totalCompetencies = this.competencies.length;
  if (totalCompetencies === 0) return 0;
  
  const masteredCompetencies = this.competencies.filter(comp => 
    comp.proficiencyLevel === 'Proficient' || comp.proficiencyLevel === 'Expert'
  ).length;
  
  return Math.round((masteredCompetencies / totalCompetencies) * 100);
});

// Method to add a case attempt
StudentProgressSchema.methods.addCaseAttempt = function(attemptData) {
  this.caseAttempts.push(attemptData);
  this.overallProgress.totalCasesAttempted += 1;
  
  if (attemptData.status === 'completed') {
    this.overallProgress.totalCasesCompleted += 1;
  }
  
  return this.save();
};

// Method to update competency progress
StudentProgressSchema.methods.updateCompetency = function(competencyId, score, casesAttempted = 1) {
  const competency = this.competencies.find(comp => comp.competencyId.equals(competencyId));
  
  if (competency) {
    competency.score = Math.max(competency.score, score);
    competency.casesAttempted += casesAttempted;
    if (score >= 80) {
      competency.casesMastered += 1;
    }
    competency.lastAssessed = new Date();
    
    // Update proficiency level based on score
    if (score >= 90) competency.proficiencyLevel = 'Expert';
    else if (score >= 80) competency.proficiencyLevel = 'Proficient';
    else if (score >= 70) competency.proficiencyLevel = 'Competent';
    else if (score >= 60) competency.proficiencyLevel = 'Beginner';
    else competency.proficiencyLevel = 'Novice';
  } else {
    // Add new competency
    this.competencies.push({
      competencyId,
      competencyName: attemptData.competencyName || 'Unknown Competency',
      score,
      casesAttempted,
      casesMastered: score >= 80 ? 1 : 0,
      lastAssessed: new Date(),
      proficiencyLevel: score >= 90 ? 'Expert' : 
                       score >= 80 ? 'Proficient' :
                       score >= 70 ? 'Competent' :
                       score >= 60 ? 'Beginner' : 'Novice'
    });
  }
  
  return this.save();
};

// Method to add an achievement
StudentProgressSchema.methods.addAchievement = function(achievementData) {
  this.achievements.push(achievementData);
  return this.save();
};

// Method to add a milestone
StudentProgressSchema.methods.addMilestone = function(milestoneData) {
  this.milestones.push(milestoneData);
  return this.save();
};

const StudentProgress = mongoose.model('StudentProgress', StudentProgressSchema);

export default StudentProgress;