import mongoose from 'mongoose';
import StudentProgress from '../models/StudentProgressModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';

// Enhanced difficulty mapping to handle all variations
const normalizeDifficulty = (difficulty) => {
    if (!difficulty) return 'Beginner';
    
    const difficultyLower = difficulty.toLowerCase();
    
    if (difficultyLower.includes('easy') || difficultyLower.includes('beginner')) {
        return 'Beginner';
    } else if (difficultyLower.includes('intermediate') || difficultyLower.includes('medium')) {
        return 'Intermediate';
    } else if (difficultyLower.includes('hard') || difficultyLower.includes('advanced') || difficultyLower.includes('expert')) {
        return 'Advanced';
    }
    
    // Default to Beginner for unknown values
    return 'Beginner';
};

class StudentProgressService {
  // Get or create student progress for a user
  async getOrCreateStudentProgress(userId, dbSession = null) {
    try {
      let progress = await StudentProgress.findOne({ userId })
        .populate('competencies.competencyId')
        .populate('caseAttempts.caseId')
        .populate('learningPaths.pathId')
        .populate('learningPaths.currentModule')
        .session(dbSession || null);

      if (!progress) {
        progress = new StudentProgress({ userId });
        await progress.save({ session: dbSession });
      }

      return progress;
    } catch (error) {
      throw new Error(`Error getting student progress: ${error.message}`);
    }
  }

  // Record a case attempt with detailed metrics
  async recordCaseAttempt(userId, attemptData, dbSession = null) {
    const useExternalSession = !!dbSession;
    const session = dbSession || await mongoose.startSession();
    
    if (!useExternalSession) {
      session.startTransaction();
    }

    try {
      const progress = await this.getOrCreateStudentProgress(userId, session);
      
      // Validate score if provided
      if (attemptData.score !== null && attemptData.score !== undefined) {
        const score = Number(attemptData.score);
        if (isNaN(score)) {
          throw new Error('Invalid score provided');
        }
        attemptData.score = score;
      }
      
      // Add the case attempt
      const caseAttempt = {
        caseId: attemptData.caseId,
        caseTitle: attemptData.caseTitle,
        attemptNumber: attemptData.attemptNumber,
        startTime: attemptData.startTime,
        endTime: attemptData.endTime,
        duration: attemptData.duration,
        score: attemptData.score,
        status: attemptData.status,
        detailedMetrics: attemptData.detailedMetrics || {},
        feedback: attemptData.feedback,
        sessionId: attemptData.sessionId
      };

      await progress.addCaseAttempt(caseAttempt);

      // Update competencies if provided
      if (attemptData.competencies) {
        for (const comp of attemptData.competencies) {
          await progress.updateCompetency(
            comp.competencyId,
            comp.score,
            comp.casesAttempted || 1
          );
        }
      }

      // Update overall progress
      progress.overallProgress.overallScore = this.calculateOverallScore(progress);
      progress.overallProgress.currentLevel = this.calculateCurrentLevel(progress);
      
      if (attemptData.duration) {
        progress.overallProgress.totalLearningHours += attemptData.duration / 3600; // Convert seconds to hours
      }

      await progress.save({ session });

      if (!useExternalSession) {
        await session.commitTransaction();
      }
      return progress;
    } catch (error) {
      if (!useExternalSession) {
        await session.abortTransaction();
      }
      throw new Error(`Error recording case attempt: ${error.message}`);
    } finally {
      if (!useExternalSession) {
        session.endSession();
      }
    }
  }

  // Update competency progress
  async updateCompetencyProgress(userId, competencyId, score, casesAttempted = 1) {
    try {
      const progress = await this.getOrCreateStudentProgress(userId);
      await progress.updateCompetency(competencyId, score, casesAttempted);
      return progress;
    } catch (error) {
      throw new Error(`Error updating competency progress: ${error.message}`);
    }
  }

  // Add achievement
  async addAchievement(userId, achievementData) {
    try {
      const progress = await this.getOrCreateStudentProgress(userId);
      await progress.addAchievement(achievementData);
      return progress;
    } catch (error) {
      throw new Error(`Error adding achievement: ${error.message}`);
    }
  }

  // Add milestone
  async addMilestone(userId, milestoneData) {
    try {
      const progress = await this.getOrCreateStudentProgress(userId);
      await progress.addMilestone(milestoneData);
      return progress;
    } catch (error) {
      throw new Error(`Error adding milestone: ${error.message}`);
    }
  }

  // Get progress summary
  async getProgressSummary(userId) {
    try {
      const progress = await this.getOrCreateStudentProgress(userId);
      
      return {
        overallProgress: progress.overallProgress,
        competencies: progress.competencies,
        totalAchievements: progress.achievements.length,
        totalMilestones: progress.milestones.length,
        progressPercentage: progress.progressPercentage,
        streak: progress.streak
      };
    } catch (error) {
      throw new Error(`Error getting progress summary: ${error.message}`);
    }
  }

  // Get case attempt history
  async getCaseAttemptHistory(userId, limit = 10) {
    try {
      const progress = await this.getOrCreateStudentProgress(userId);
      return progress.caseAttempts
        .sort((a, b) => new Date(b.endTime || b.startTime) - new Date(a.endTime || a.startTime))
        .slice(0, limit);
    } catch (error) {
      throw new Error(`Error getting case attempt history: ${error.message}`);
    }
  }

  // Get achievements and milestones
  async getAchievementsAndMilestones(userId) {
    try {
      const progress = await this.getOrCreateStudentProgress(userId);
      return {
        achievements: progress.achievements.sort((a, b) => new Date(b.earnedDate) - new Date(a.earnedDate)),
        milestones: progress.milestones.sort((a, b) => new Date(b.achievedDate) - new Date(a.achievedDate))
      };
    } catch (error) {
      throw new Error(`Error getting achievements and milestones: ${error.message}`);
    }
  }

  // Calculate overall score based on competency scores
  calculateOverallScore(progress) {
    if (progress.competencies.length === 0) return 0;
    
    const totalScore = progress.competencies.reduce((sum, comp) => sum + comp.score, 0);
    return Math.round(totalScore / progress.competencies.length);
  }

  // Calculate current level based on overall score and progression
  calculateCurrentLevel(progress) {
    const overallScore = progress.overallProgress.overallScore;
    
    if (overallScore >= 90) return 'Expert';
    if (overallScore >= 80) return 'Proficient';
    if (overallScore >= 70) return 'Competent';
    if (overallScore >= 60) return 'Beginner';
    return 'Novice';
  }

  // Reset progress (for testing or admin purposes)
  async resetProgress(userId) {
    try {
      const progress = await StudentProgress.findOneAndUpdate(
        { userId },
        {
          $set: {
            'overallProgress.totalCasesAttempted': 0,
            'overallProgress.totalCasesCompleted': 0,
            'overallProgress.totalLearningHours': 0,
            'overallProgress.overallScore': 0,
            'overallProgress.currentLevel': 'Novice',
            'overallProgress.experiencePoints': 0,
            competencies: [],
            caseAttempts: [],
            learningPaths: [],
            milestones: [],
            achievements: [],
            'streak.currentStreak': 0,
            'streak.longestStreak': 0,
            'streak.lastActivityDate': null
          }
        },
        { new: true }
      );
      return progress;
    } catch (error) {
      throw new Error(`Error resetting progress: ${error.message}`);
    }
  }
}

export default new StudentProgressService();