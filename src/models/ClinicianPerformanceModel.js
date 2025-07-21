import mongoose from 'mongoose';

// Schema for tracking clinician performance and contribution eligibility
const ClinicianPerformanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  
  // Performance tracking
  evaluationHistory: [{
    sessionId: { type: String, required: true },
    caseId: { type: String, required: true },
    caseTitle: { type: String },
    specialty: { type: String, required: true },
    module: { type: String },
    programArea: { type: String },
    
    // Evaluation results
    overallRating: { 
      type: String, 
      enum: ['Excellent', 'Good', 'Needs Improvement'],
      required: true 
    },
    criteriaScores: {
      type: Map,
      of: String // Each criterion and its rating
    },
    totalScore: { type: Number }, // Percentage score
    
    // Metadata
    completedAt: { type: Date, default: Date.now },
    duration: { type: Number }, // Session duration in minutes
    messagesExchanged: { type: Number }
  }],
  
  // Performance statistics by specialty
  specialtyStats: {
    type: Map,
    of: {
      totalCases: { type: Number, default: 0 },
      excellentCount: { type: Number, default: 0 },
      goodCount: { type: Number, default: 0 },
      needsImprovementCount: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      lastExcellentDate: { type: Date },
      recentPerformance: [{ // Last 10 evaluations
        rating: String,
        date: Date,
        score: Number
      }]
    }
  },
  
  // Contributor eligibility
  contributorStatus: {
    isEligible: { type: Boolean, default: false },
    eligibleSpecialties: [String], // Specialties they can contribute to
    qualificationDate: { type: Date }, // When they first became eligible
    lastEligibilityCheck: { type: Date, default: Date.now },
    
    // Eligibility criteria tracking
    eligibilityCriteria: {
      type: Map,
      of: {
        specialty: String,
        excellentCount: Number,
        recentExcellent: Boolean, // Has excellent in last 30 days
        consistentPerformance: Boolean, // No "Needs Improvement" in last 10
        qualificationMet: Boolean,
        qualificationDate: Date
      }
    }
  },
  
  // Contribution history
  contributionStats: {
    totalSubmitted: { type: Number, default: 0 },
    totalApproved: { type: Number, default: 0 },
    totalRejected: { type: Number, default: 0 },
    approvalRate: { type: Number, default: 0 },
    lastContribution: { type: Date }
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create index for userId (unique)
ClinicianPerformanceSchema.index({ userId: 1 }, { unique: true });

// Update the updatedAt field on save
ClinicianPerformanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to add a new evaluation
ClinicianPerformanceSchema.methods.addEvaluation = function(evaluationData) {
  // Add to evaluation history
  this.evaluationHistory.push(evaluationData);
  
  // Update specialty stats
  const specialty = evaluationData.specialty;
  if (!this.specialtyStats.has(specialty)) {
    this.specialtyStats.set(specialty, {
      totalCases: 0,
      excellentCount: 0,
      goodCount: 0,
      needsImprovementCount: 0,
      averageScore: 0,
      recentPerformance: []
    });
  }
  
  const stats = this.specialtyStats.get(specialty);
  stats.totalCases++;
  
  // Update counts based on rating
  switch (evaluationData.overallRating) {
    case 'Excellent':
      stats.excellentCount++;
      stats.lastExcellentDate = evaluationData.completedAt;
      break;
    case 'Good':
      stats.goodCount++;
      break;
    case 'Needs Improvement':
      stats.needsImprovementCount++;
      break;
  }
  
  // Update recent performance (keep last 10)
  stats.recentPerformance.push({
    rating: evaluationData.overallRating,
    date: evaluationData.completedAt,
    score: evaluationData.totalScore
  });
  
  if (stats.recentPerformance.length > 10) {
    stats.recentPerformance.shift();
  }
  
  // Calculate average score
  const allScores = this.evaluationHistory
    .filter(e => e.specialty === specialty && e.totalScore)
    .map(e => e.totalScore);
  
  if (allScores.length > 0) {
    stats.averageScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  }
  
  this.specialtyStats.set(specialty, stats);
  
  // Check eligibility after adding evaluation
  this.checkContributorEligibility();
};

// Method to check contributor eligibility
ClinicianPerformanceSchema.methods.checkContributorEligibility = function() {
  const eligibleSpecialties = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  // Check each specialty
  for (const [specialty, stats] of this.specialtyStats) {
    const criteria = {
      specialty,
      excellentCount: stats.excellentCount,
      recentExcellent: false,
      consistentPerformance: false,
      qualificationMet: false
    };
    
    // Check if has 3+ excellent ratings
    const hasEnoughExcellent = stats.excellentCount >= 3;
    
    // Check if has recent excellent (within 30 days)
    const hasRecentExcellent = stats.lastExcellentDate && stats.lastExcellentDate >= thirtyDaysAgo;
    
    // Check consistency (no "Needs Improvement" in last 10 attempts)
    const recentNeedsImprovement = stats.recentPerformance
      .filter(p => p.rating === 'Needs Improvement').length;
    const isConsistent = recentNeedsImprovement === 0;
    
    criteria.recentExcellent = hasRecentExcellent;
    criteria.consistentPerformance = isConsistent;
    criteria.qualificationMet = hasEnoughExcellent && hasRecentExcellent && isConsistent;
    
    if (criteria.qualificationMet) {
      eligibleSpecialties.push(specialty);
      if (!criteria.qualificationDate) {
        criteria.qualificationDate = now;
      }
    }
    
    this.contributorStatus.eligibilityCriteria.set(specialty, criteria);
  }
  
  // Update contributor status
  const wasEligible = this.contributorStatus.isEligible;
  this.contributorStatus.isEligible = eligibleSpecialties.length > 0;
  this.contributorStatus.eligibleSpecialties = eligibleSpecialties;
  this.contributorStatus.lastEligibilityCheck = now;
  
  if (!wasEligible && this.contributorStatus.isEligible) {
    this.contributorStatus.qualificationDate = now;
  }
};

// Method to update contribution stats
ClinicianPerformanceSchema.methods.updateContributionStats = function(status) {
  this.contributionStats.totalSubmitted++;
  this.contributionStats.lastContribution = new Date();
  
  if (status === 'approved') {
    this.contributionStats.totalApproved++;
  } else if (status === 'rejected') {
    this.contributionStats.totalRejected++;
  }
  
  // Calculate approval rate
  const total = this.contributionStats.totalApproved + this.contributionStats.totalRejected;
  if (total > 0) {
    this.contributionStats.approvalRate = (this.contributionStats.totalApproved / total) * 100;
  }
};

// Static method to get eligible contributors for a specialty
ClinicianPerformanceSchema.statics.getEligibleContributors = function(specialty) {
  return this.find({
    'contributorStatus.isEligible': true,
    'contributorStatus.eligibleSpecialties': specialty
  }).select('userId name email contributorStatus specialtyStats');
};

export default mongoose.model('ClinicianPerformance', ClinicianPerformanceSchema);