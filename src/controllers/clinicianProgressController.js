import ClinicianProgress from '../models/ClinicianProgressModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';
import logger from '../config/logger.js';

const log = logger.child({ module: 'clinicianProgressController' });

// Helper function to calculate progression level
const calculateProgressionLevel = (progress) => {
  // Basic algorithm: 
  // - Start at Beginner
  // - Move to Intermediate after completing at least 10 Beginner cases with average score > 70
  // - Move to Advanced after completing at least 15 Intermediate cases with average score > 75
  // - Move to Expert after completing at least 10 Advanced cases with average score > 80
  
  if (progress.advancedCasesCompleted >= 10 && progress.advancedAverageScore > 80) {
    return 'Expert';
  } else if (progress.intermediateCasesCompleted >= 15 && progress.intermediateAverageScore > 75) {
    return 'Advanced';
  } else if (progress.beginnerCasesCompleted >= 10 && progress.beginnerAverageScore > 70) {
    return 'Intermediate';
  } else {
    return 'Beginner';
  }
};

// GET /api/clinician-progress/:userId - Get clinician progress
export const getClinicianProgress = async (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    log.warn('Get clinician progress failed: userId is required');
    return res.status(400).json({ error: 'userId parameter is required' });
  }
  
  try {
    // Find or create progress record
    let progress = await ClinicianProgress.findOne({ userId });
    
    if (!progress) {
      progress = new ClinicianProgress({ userId });
      await progress.save();
      log.info({ userId }, 'Created new clinician progress record');
    }
    
    // Get additional stats for dashboard
    const recentMetrics = await PerformanceMetrics.find({ user_ref: userId })
      .sort({ evaluated_at: -1 })
      .limit(5)
      .populate('case_ref', 'case_metadata.title case_metadata.difficulty');
    
    // Return progress with recent metrics
    log.info({ userId }, 'Fetched clinician progress successfully');
    res.json({
      progress,
      recentMetrics
    });
  } catch (error) {
    log.error(error, 'Error fetching clinician progress');
    res.status(500).json({ error: 'Failed to fetch clinician progress' });
  }
};

// POST /api/clinician-progress/update-after-case - Update progress after case completion
export const updateProgressAfterCase = async (req, res) => {
  const { userId, caseId, performanceMetricsId } = req.body;
  
  if (!userId || !caseId || !performanceMetricsId) {
    log.warn('Update progress failed: missing required parameters');
    return res.status(400).json({ error: 'userId, caseId, and performanceMetricsId are required' });
  }
  
  try {
    // Get case details to determine difficulty
    const caseDetails = await Case.findById(caseId);
    if (!caseDetails) {
      log.warn({ caseId }, 'Case not found');
      return res.status(404).json({ error: 'Case not found' });
    }
    
    const difficulty = caseDetails.case_metadata.difficulty;
    
    // Get performance metrics
    const metrics = await PerformanceMetrics.findById(performanceMetricsId);
    if (!metrics) {
      log.warn({ performanceMetricsId }, 'Performance metrics not found');
      return res.status(404).json({ error: 'Performance metrics not found' });
    }
    
    const score = metrics.metrics.overall_score || 0;
    
    // Find or create progress record
    let progress = await ClinicianProgress.findOne({ userId });
    if (!progress) {
      progress = new ClinicianProgress({ userId });
    }
    
    // Update progress based on difficulty
    if (difficulty === 'Beginner') {
      const newTotal = progress.beginnerCasesCompleted + 1;
      const newAvg = ((progress.beginnerAverageScore * progress.beginnerCasesCompleted) + score) / newTotal;
      
      progress.beginnerCasesCompleted = newTotal;
      progress.beginnerAverageScore = Math.round(newAvg * 100) / 100;
      progress.lastCompletedBeginnerCase = caseId;
    } else if (difficulty === 'Intermediate') {
      const newTotal = progress.intermediateCasesCompleted + 1;
      const newAvg = ((progress.intermediateAverageScore * progress.intermediateCasesCompleted) + score) / newTotal;
      
      progress.intermediateCasesCompleted = newTotal;
      progress.intermediateAverageScore = Math.round(newAvg * 100) / 100;
      progress.lastCompletedIntermediateCase = caseId;
    } else if (difficulty === 'Advanced') {
      const newTotal = progress.advancedCasesCompleted + 1;
      const newAvg = ((progress.advancedAverageScore * progress.advancedCasesCompleted) + score) / newTotal;
      
      progress.advancedCasesCompleted = newTotal;
      progress.advancedAverageScore = Math.round(newAvg * 100) / 100;
      progress.lastCompletedAdvancedCase = caseId;
    }
    
    // Update total cases and overall average
    const newTotal = progress.totalCasesCompleted + 1;
    const newAvg = ((progress.overallAverageScore * progress.totalCasesCompleted) + score) / newTotal;
    
    progress.totalCasesCompleted = newTotal;
    progress.overallAverageScore = Math.round(newAvg * 100) / 100;
    
    // Calculate new progression level
    progress.currentProgressionLevel = calculateProgressionLevel(progress);
    
    // Save progress
    await progress.save();
    
    log.info({ userId, difficulty, score }, 'Updated clinician progress successfully');
    res.json({
      message: 'Progress updated successfully',
      progress
    });
  } catch (error) {
    log.error(error, 'Error updating clinician progress');
    res.status(500).json({ error: 'Failed to update clinician progress' });
  }
};

// GET /api/clinician-progress/recommendations/:userId - Get case recommendations based on progress
export const getProgressRecommendations = async (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    log.warn('Get recommendations failed: userId is required');
    return res.status(400).json({ error: 'userId parameter is required' });
  }
  
  try {
    // Find progress record
    const progress = await ClinicianProgress.findOne({ userId });
    
    if (!progress) {
      log.warn({ userId }, 'No progress record found for recommendations');
      return res.status(404).json({ error: 'No progress record found' });
    }
    
    // Determine recommended difficulty based on progression level
    let recommendedDifficulty;
    let recommendationReason;
    
    switch (progress.currentProgressionLevel) {
      case 'Beginner':
        recommendedDifficulty = 'Beginner';
        recommendationReason = 'Continue with beginner cases to build foundational skills';
        break;
      case 'Intermediate':
        recommendedDifficulty = progress.beginnerCasesCompleted >= 20 ? 'Intermediate' : 'Beginner';
        recommendationReason = progress.beginnerCasesCompleted >= 20 
          ? 'You\'re ready for intermediate cases to challenge your skills'
          : 'Complete more beginner cases to solidify your foundation';
        break;
      case 'Advanced':
        recommendedDifficulty = progress.intermediateCasesCompleted >= 25 ? 'Advanced' : 'Intermediate';
        recommendationReason = progress.intermediateCasesCompleted >= 25
          ? 'You\'re ready for advanced cases to test your expertise'
          : 'Complete more intermediate cases to prepare for advanced challenges';
        break;
      case 'Expert':
        recommendedDifficulty = 'Advanced';
        recommendationReason = 'Continue with advanced cases to maintain your expert status';
        break;
      default:
        recommendedDifficulty = 'Beginner';
        recommendationReason = 'Start with beginner cases to build your skills';
    }
    
    // Find recommended cases
    const recommendedCases = await Case.find({
      'case_metadata.difficulty': recommendedDifficulty
    })
    .select('case_metadata.case_id case_metadata.title case_metadata.specialty case_metadata.difficulty')
    .limit(5);
    
    log.info({ userId, recommendedDifficulty }, 'Generated case recommendations');
    res.json({
      currentLevel: progress.currentProgressionLevel,
      recommendedDifficulty,
      recommendationReason,
      recommendedCases
    });
  } catch (error) {
    log.error(error, 'Error generating recommendations');
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
};