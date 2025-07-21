import ClinicianPerformance from '../models/ClinicianPerformanceModel.js';
import emailService from '../services/emailService.js';
import logger from '../config/logger.js';

// Middleware to automatically record evaluation results
export const recordEvaluationMiddleware = async (req, res, next) => {
  // Store original res.json to intercept the response
  const originalJson = res.json;
  
  res.json = function(data) {
    // Check if this is an evaluation response
    if (data && data.evaluation && req.body && req.body.sessionId) {
      // Extract evaluation data from the response
      const evaluationData = {
        userId: req.user?.id || req.body.userId || 'anonymous',
        userEmail: req.user?.email || req.body.userEmail || '',
        userName: req.user?.name || req.body.userName || 'Anonymous User',
        sessionId: req.body.sessionId,
        caseId: req.body.caseId,
        caseTitle: data.caseTitle || req.body.caseTitle,
        specialty: data.specialty || req.body.specialty,
        module: data.module || req.body.module,
        programArea: data.programArea || req.body.programArea,
        overallRating: data.evaluation.overallRating,
        criteriaScores: data.evaluation.criteriaScores || {},
        totalScore: data.evaluation.totalScore,
        duration: data.sessionDuration,
        messagesExchanged: data.messagesExchanged
      };
      
      // Record the evaluation asynchronously (don't block the response)
      recordEvaluationAsync(evaluationData);
    }
    
    // Call the original res.json with the data
    return originalJson.call(this, data);
  };
  
  next();
};

// Async function to record evaluation
const recordEvaluationAsync = async (evaluationData) => {
  try {
    // Skip if no user ID
    if (!evaluationData.userId || evaluationData.userId === 'anonymous') {
      return;
    }
    
    // Find or create clinician performance record
    let performance = await ClinicianPerformance.findOne({ userId: evaluationData.userId });
    
    if (!performance) {
      performance = new ClinicianPerformance({
        userId: evaluationData.userId,
        email: evaluationData.userEmail,
        name: evaluationData.userName,
        evaluationHistory: [],
        specialtyStats: new Map(),
        contributorStatus: {
          isEligible: false,
          eligibleSpecialties: [],
          eligibilityCriteria: new Map()
        }
      });
    }
    
    // Add the evaluation
    performance.addEvaluation({
      sessionId: evaluationData.sessionId,
      caseId: evaluationData.caseId,
      caseTitle: evaluationData.caseTitle,
      specialty: evaluationData.specialty,
      module: evaluationData.module,
      programArea: evaluationData.programArea,
      overallRating: evaluationData.overallRating,
      criteriaScores: new Map(Object.entries(evaluationData.criteriaScores || {})),
      totalScore: evaluationData.totalScore,
      duration: evaluationData.duration,
      messagesExchanged: evaluationData.messagesExchanged,
      completedAt: new Date()
    });
    
    // Check if user just became eligible (before saving)
    const wasEligibleBefore = performance.contributorStatus.isEligible;
    const eligibleSpecialtiesBefore = [...(performance.contributorStatus.eligibleSpecialties || [])];
    
    await performance.save();
    
    logger.info(`Evaluation recorded for user ${evaluationData.userId}: ${evaluationData.overallRating} in ${evaluationData.specialty}`);
    
    // Check if user became eligible for contribution and send notification
    if (performance.contributorStatus.isEligible) {
      const newEligibleSpecialties = performance.contributorStatus.eligibleSpecialties.filter(
        specialty => !eligibleSpecialtiesBefore.includes(specialty)
      );
      
      // Send notification if user just became eligible or gained new specialties
      if (!wasEligibleBefore || newEligibleSpecialties.length > 0) {
        logger.info(`User ${evaluationData.userId} is now eligible to contribute cases in: ${performance.contributorStatus.eligibleSpecialties.join(', ')}`);
        
        // Send eligibility notification email
        await emailService.notifyEligibilityAchieved(
          evaluationData.userEmail,
          evaluationData.userName,
          performance.contributorStatus.eligibleSpecialties
        );
      }
    }
    
  } catch (error) {
    logger.error('Error recording evaluation:', error);
  }
};

// Middleware to check contributor eligibility
export const checkContributorEligibility = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.params.userId || req.body.userId;
    const specialty = req.params.specialty || req.body.specialty;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const performance = await ClinicianPerformance.findOne({ userId });
    
    if (!performance) {
      return res.status(403).json({ 
        error: 'Not eligible to contribute cases',
        reason: 'No performance record found. Complete some case evaluations first.'
      });
    }
    
    // Check if eligible for the specific specialty (if provided)
    if (specialty && !performance.contributorStatus.eligibleSpecialties.includes(specialty)) {
      const criteria = performance.contributorStatus.eligibilityCriteria.get(specialty);
      return res.status(403).json({ 
        error: 'Not eligible to contribute cases in this specialty',
        specialty,
        criteria: criteria || {
          excellentCount: 0,
          recentExcellent: false,
          consistentPerformance: false,
          qualificationMet: false
        },
        requirements: {
          excellentRatingsNeeded: Math.max(0, 3 - (criteria?.excellentCount || 0)),
          needsRecentExcellent: !criteria?.recentExcellent,
          needsConsistentPerformance: !criteria?.consistentPerformance
        }
      });
    }
    
    // Check general eligibility
    if (!performance.contributorStatus.isEligible) {
      return res.status(403).json({ 
        error: 'Not eligible to contribute cases',
        reason: 'Achieve "Excellent" ratings in your specialty areas to become eligible.'
      });
    }
    
    // Add performance data to request for use in route handlers
    req.performance = performance;
    next();
    
  } catch (error) {
    logger.error('Error checking contributor eligibility:', error);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
};

export default {
  recordEvaluationMiddleware,
  checkContributorEligibility
};