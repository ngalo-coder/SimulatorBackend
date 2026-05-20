
import UserInteractionTracking, { 
  InteractionType, 
  ResourceType, 
  HelpRequestType, 
  EngagementLevel 
} from '../models/UserInteractionTrackingModel.js';
import StudentProgress from '../models/StudentProgressModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';

/**
 * Interaction Tracking Service
 * Provides comprehensive user interaction logging, engagement analysis,
 * pattern recognition, and learning behavior recommendations
 */
class InteractionTrackingService {
  constructor() {
    this.engagementCache = new Map();
    this.cacheDuration = 10 * 60 * 1000; // 10 minutes cache
  }

  /**
   * Track a user interaction
   * @param {Object} interactionData - Interaction data to track
   * @returns {Promise<Object>} - Created interaction record
   */
  async trackInteraction(interactionData) {
    try {
      const interaction = new UserInteractionTracking(interactionData);
      const savedInteraction = await interaction.save();
      
      // Clear relevant cache entries
      this._clearUserCache(interactionData.userId);
      
      return savedInteraction;
    } catch (error) {
      console.error('Track interaction error:', error);
      throw error;
    }
  }

  /**
   * Track multiple interactions in bulk
   * @param {Array} interactions - Array of interaction data
   * @returns {Promise<Object>} - Bulk write result
   */
  async trackBulkInteractions(interactions) {
    try {
      const result = await UserInteractionTracking.insertMany(interactions);
      
      // Clear cache for all unique users
      const userIds = [...new Set(interactions.map(i => i.userId))];
      userIds.forEach(userId => this._clearUserCache(userId));
      
      return result;
    } catch (error) {
      console.error('Track bulk interactions error:', error);
      throw error;
    }
  }

  /**
   * Get user engagement analytics
   * @param {string} userId - User ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Engagement analytics
   */
  async getUserEngagementAnalytics(userId, options = {}) {
    try {
      const cacheKey = `engagement_${userId}_${JSON.stringify(options)}`;
      const cached = this.engagementCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }

      const { timeRange = '30d', granularity = 'day' } = options;
      
      const [
        engagementMetrics,
        interactionPatterns,
        learningBehavior,
        recommendations
      ] = await Promise.all([
        this._calculateEngagementMetrics(userId, timeRange),
        this._analyzeInteractionPatterns(userId, timeRange, granularity),
        this._analyzeLearningBehavior(userId, timeRange),
        this._generateRecommendations(userId, timeRange)
      ]);

      const analytics = {
        engagementMetrics,
        interactionPatterns,
        learningBehavior,
        recommendations,
        timeRange,
        generatedAt: new Date()
      };

      this.engagementCache.set(cacheKey, {
        timestamp: Date.now(),
        data: analytics
      });

      return analytics;
    } catch (error) {
      console.error('Get user engagement analytics error:', error);
      throw error;
    }
  }

  /**
   * Analyze engagement patterns across all users
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - Global engagement patterns
   */
  async analyzeGlobalEngagementPatterns(filters = {}) {
    try {
      const { timeRange = '30d', specialty, difficulty } = filters;
      const dateFilter = this._getDateFilter(timeRange);

      const matchStage = { createdAt: dateFilter };
      if (specialty) {
        // This would require joining with cases collection
      }

      const patterns = await UserInteractionTracking.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              interactionType: '$interactionType',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            totalCount: { $sum: 1 },
            avgEngagement: { $avg: '$engagementScore' },
            totalTime: { $sum: '$timeSpentSeconds' },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        {
          $group: {
            _id: '$_id.interactionType',
            dailyPatterns: {
              $push: {
                date: '$_id.date',
                count: '$totalCount',
                avgEngagement: '$avgEngagement',
                totalTime: '$totalTime',
                uniqueUsers: { $size: '$uniqueUsers' }
              }
            },
            totalInteractions: { $sum: '$totalCount' },
            avgDailyEngagement: { $avg: '$avgEngagement' }
          }
        },
        { $sort: { totalInteractions: -1 } }
      ]);

      return {
        patterns,
        timeRange,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Analyze global engagement patterns error:', error);
      throw error;
    }
  }

  /**
   * Get learning behavior insights for a user
   * @param {string} userId - User ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Learning behavior insights
   */
  async getLearningBehaviorInsights(userId, options = {}) {
    try {
      const { timeRange = '90d' } = options;
      
      const [
        studyPatterns,
        performanceCorrelation,
        competencyProgress,
        engagementTrends
      ] = await Promise.all([
        this._analyzeStudyPatterns(userId, timeRange),
        this._analyzePerformanceCorrelation(userId, timeRange),
        this._analyzeCompetencyProgress(userId, timeRange),
        this._analyzeEngagementTrends(userId, timeRange)
      ]);

      return {
        studyPatterns,
        performanceCorrelation,
        competencyProgress,
        engagementTrends,
        overallLearningEfficiency: this._calculateLearningEfficiency(studyPatterns, performanceCorrelation),
        timeRange,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Get learning behavior insights error:', error);
      throw error;
    }
  }

  /**
   * Generate personalized learning recommendations
   * @param {string} userId - User ID
   * @param {Object} options - Recommendation options
   * @returns {Promise<Object>} - Personalized recommendations
   */
  async generatePersonalizedRecommendations(userId, options = {}) {
    try {
      const { timeRange = '30d', limit = 5 } = options;
      
      const [
        weakCompetencies,
        engagementGaps,
        performanceData,
        interactionHistory
      ] = await Promise.all([
        this._identifyWeakCompetencies(userId, timeRange),
        this._identifyEngagementGaps(userId, timeRange),
        this._getPerformanceData(userId, timeRange),
        this._getRecentInteractions(userId, 50)
      ]);

      const recommendations = this._createRecommendations(
        weakCompetencies,
        engagementGaps,
        performanceData,
        interactionHistory,
        limit
      );

      return {
        recommendations,
        confidenceScore: this._calculateRecommendationConfidence(weakCompetencies, engagementGaps),
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Generate personalized recommendations error:', error);
      throw error;
    }
  }

  // Private helper methods

  async _calculateEngagementMetrics(userId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    
    const metrics = await UserInteractionTracking.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: dateFilter } },
      {
        $group: {
          _id: null,
          totalInteractions: { $sum: 1 },
          totalTimeSpent: { $sum: '$timeSpentSeconds' },
          avgEngagementScore: { $avg: '$engagementScore' },
          maxEngagementScore: { $max: '$engagementScore' },
          engagementLevelDistribution: {
            $push: '$engagementLevel'
          },
          caseStarts: { $sum: { $cond: [{ $eq: ['$interactionType', InteractionType.CASE_START] }, 1, 0] } },
          caseCompletions: { $sum: { $cond: [{ $eq: ['$interactionType', InteractionType.CASE_COMPLETE] }, 1, 0] } },
          helpRequests: { $sum: { $cond: [{ $eq: ['$interactionType', InteractionType.HELP_REQUEST] }, 1, 0] } },
          resourceAccesses: { $sum: { $cond: [{ $eq: ['$interactionType', InteractionType.RESOURCE_ACCESS] }, 1, 0] } },
          lastActivity: { $max: '$createdAt' }
        }
      }
    ]);

    const result = metrics[0] || {
      totalInteractions: 0,
      totalTimeSpent: 0,
      avgEngagementScore: 0,
      maxEngagementScore: 0,
      engagementLevelDistribution: [],
      caseStarts: 0,
      caseCompletions: 0,
      helpRequests: 0,
      resourceAccesses: 0,
      lastActivity: null
    };

    // Calculate engagement level counts
    result.engagementLevelCounts = {
      [EngagementLevel.LOW]: result.engagementLevelDistribution.filter(l => l === EngagementLevel.LOW).length,
      [EngagementLevel.MEDIUM]: result.engagementLevelDistribution.filter(l => l === EngagementLevel.MEDIUM).length,
      [EngagementLevel.HIGH]: result.engagementLevelDistribution.filter(l => l === EngagementLevel.HIGH).length,
      [EngagementLevel.VERY_HIGH]: result.engagementLevelDistribution.filter(l => l === EngagementLevel.VERY_HIGH).length
    };

    delete result.engagementLevelDistribution;

    return result;
  }

  async _analyzeInteractionPatterns(userId, timeRange, granularity) {
    const dateFilter = this._getDateFilter(timeRange);
    const groupFormat = this._getGroupFormat(granularity);

    const patterns = await UserInteractionTracking.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: dateFilter } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            interactionType: '$interactionType'
          },
          count: { $sum: 1 },
          totalTime: { $sum: '$timeSpentSeconds' },
          avgEngagement: { $avg: '$engagementScore' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    return patterns;
  }

  async _analyzeLearningBehavior(userId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    
    const behavior = await UserInteractionTracking.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: dateFilter } },
      {
        $group: {
          _id: {
            hourOfDay: { $hour: '$createdAt' },
            dayOfWeek: { $dayOfWeek: '$createdAt' }
          },
          interactionCount: { $sum: 1 },
          studySessions: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
          avgSessionDuration: { $avg: '$timeSpentSeconds' }
        }
      },
      {
        $project: {
          hourOfDay: '$_id.hourOfDay',
          dayOfWeek: '$_id.dayOfWeek',
          interactionCount: 1,
          studyDays: { $size: '$studySessions' },
          avgSessionDuration: 1
        }
      },
      { $sort: { dayOfWeek: 1, hourOfDay: 1 } }
    ]);

    return behavior;
  }

  async _analyzeStudyPatterns(userId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    
    const patterns = await UserInteractionTracking.aggregate([
      { $match: { 
        userId: new mongoose.Types.ObjectId(userId), 
        createdAt: dateFilter,
        interactionType: { $in: [InteractionType.CASE_START, InteractionType.CASE_COMPLETE, InteractionType.RESOURCE_ACCESS] }
      } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          studySessions: { $sum: 1 },
          totalStudyTime: { $sum: '$timeSpentSeconds' },
          casesCompleted: { $sum: { $cond: [{ $eq: ['$interactionType', InteractionType.CASE_COMPLETE] }, 1, 0] } },
          resourcesAccessed: { $sum: { $cond: [{ $eq: ['$interactionType', InteractionType.RESOURCE_ACCESS] }, 1, 0] } }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    return patterns;
  }

  async _analyzePerformanceCorrelation(userId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    
    const correlation = await PerformanceMetrics.aggregate([
      { $match: { user_ref: new mongoose.Types.ObjectId(userId), evaluated_at: dateFilter } },
      {
        $lookup: {
          from: 'userinteractiontrackings',
          localField: 'evaluated_at',
          foreignField: 'createdAt',
          as: 'interactions'
        }
      },
      {
        $project: {
          score: '$metrics.overall_score',
          engagementScore: { $avg: '$interactions.engagementScore' },
          timeSpent: { $avg: '$interactions.timeSpentSeconds' },
          interactionCount: { $size: '$interactions' }
        }
      }
    ]);

    return correlation;
  }

  async _analyzeCompetencyProgress(userId, timeRange) {
    // This would require integration with StudentProgress model
    const progress = await StudentProgress.findOne({ userId });
    if (!progress) return [];

    return progress.competencies.map(comp => ({
      competencyId: comp.competencyId,
      competencyName: comp.competencyName,
      currentScore: comp.score,
      proficiencyLevel: comp.proficiencyLevel,
      casesAttempted: comp.casesAttempted,
      casesMastered: comp.casesMastered,
      lastAssessed: comp.lastAssessed
    }));
  }

  async _analyzeEngagementTrends(userId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    
    const trends = await UserInteractionTracking.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          dailyEngagement: { $avg: '$engagementScore' },
          interactionCount: { $sum: 1 },
          totalTime: { $sum: '$timeSpentSeconds' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return trends;
  }

  async _identifyWeakCompetencies(userId, timeRange) {
    const progress = await StudentProgress.findOne({ userId });
    if (!progress) return [];

    return progress.competencies
      .filter(comp => comp.score < 70)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map(comp => ({
        competencyId: comp.competencyId,
        competencyName: comp.competencyName,
        currentScore: comp.score,
        targetScore: 80,
        gap: 80 - comp.score
      }));
  }

  async _identifyEngagementGaps(userId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    
    const gaps = await UserInteractionTracking.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          engagementScore: { $avg: '$engagementScore' }
        }
      },
      { $sort: { _id: 1 } },
      {
        $group: {
          _id: null,
          dates: { $push: '$_id' },
          scores: { $push: '$engagementScore' }
        }
      }
    ]);

    if (!gaps.length) return [];

    const engagementData = gaps[0];
    const lowEngagementDays = engagementData.scores
      .map((score, index) => ({ date: engagementData.dates[index], score }))
      .filter(day => day.score < 40);

    return lowEngagementDays;
  }

  async _getPerformanceData(userId, timeRange) {
    const dateFilter = this._getDateFilter(timeRange);
    
    const performance = await PerformanceMetrics.aggregate([
      { $match: { user_ref: new mongoose.Types.ObjectId(userId), evaluated_at: dateFilter } },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$metrics.overall_score' },
          bestScore: { $max: '$metrics.overall_score' },
          worstScore: { $min: '$metrics.overall_score' },
          completionRate: {
            $avg: { $cond: [{ $gte: ['$metrics.overall_score', 70] }, 1, 0] }
          }
        }
      }
    ]);

    return performance[0] || { averageScore: 0, bestScore: 0, worstScore: 0, completionRate: 0 };
  }

  async _getRecentInteractions(userId, limit) {
    return UserInteractionTracking.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  _createRecommendations(weakCompetencies, engagementGaps, performanceData, interactionHistory, limit) {
    const recommendations = [];

    // Competency-based recommendations
    weakCompetencies.forEach(comp => {
      recommendations.push({
        type: 'competency_improvement',
        priority: comp.gap > 20 ? 'high' : 'medium',
        title: `Improve ${comp.competencyName} Skills`,
        description: `Your current score is ${comp.currentScore}/100. Focus on cases and resources related to this competency.`,
        action: 'practice_competency',
        target: comp.competencyId,
        confidence: 0.8
      });
    });

    // Engagement-based recommendations
    if (engagementGaps.length > 0) {
      recommendations.push({
        type: 'engagement_boost',
        priority: 'medium',
        title: 'Increase Study Consistency',
        description: `You had ${engagementGaps.length} days with low engagement. Try to maintain regular study habits.`,
        action: 'schedule_study',
        target: null,
        confidence: 0.6
      });
    }

    // Performance-based recommendations
    if (performanceData.averageScore < 70) {
      recommendations.push({
        type: 'performance_improvement',
        priority: 'high',
        title: 'Focus on Fundamental Cases',
        description: `Your average score is ${performanceData.averageScore.toFixed(1)}. Practice basic cases to build foundation.`,
        action: 'practice_basics',
        target: null,
        confidence: 0.7
      });
    }

    // Interaction pattern recommendations
    const recentCaseCompletions = interactionHistory.filter(
      i => i.interactionType === InteractionType.CASE_COMPLETE
    ).length;

    if (recentCaseCompletions < 3) {
      recommendations.push({
        type: 'activity_increase',
        priority: 'medium',
        title: 'Complete More Cases',
        description: 'You haven\'t completed many cases recently. Try to complete at least 3 cases this week.',
        action: 'complete_cases',
        target: null,
        confidence: 0.5
      });
    }

    return recommendations.slice(0, limit);
  }

  _calculateLearningEfficiency(studyPatterns, performanceCorrelation) {
    if (!studyPatterns.length || !performanceCorrelation.length) return 0;
    
    const totalStudyTime = studyPatterns.reduce((sum, day) => sum + (day.totalStudyTime || 0), 0);
    const totalCasesCompleted = studyPatterns.reduce((sum, day) => sum + (day.casesCompleted || 0), 0);
    const avgPerformance = performanceCorrelation.reduce((sum, item) => sum + (item.score || 0), 0) / performanceCorrelation.length;

    if (totalStudyTime === 0) return 0;

    // Efficiency formula: (cases completed * average performance) / total study time
    const efficiency = (totalCasesCompleted * avgPerformance) / (totalStudyTime / 3600); // Convert time to hours
    return Math.min(100, efficiency * 10); // Scale to 0-100 range
  }

  _calculateRecommendationConfidence(weakCompetencies, engagementGaps) {
    let confidence = 0.5; // Base confidence

    if (weakCompetencies.length > 0) {
      confidence += 0.2;
    }

    if (engagementGaps.length > 0) {
      confidence += 0.1;
    }

    return Math.min(0.9, confidence);
  }

  _getDateFilter(timeRange) {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '365d':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { $gte: startDate };
  }

  _getGroupFormat(interval) {
    switch (interval) {
      case 'day':
        return '%Y-%m-%d';
      case 'week':
        return '%Y-%U';
      case 'month':
        return '%Y-%m';
      default:
        return '%Y-%m-%d';
    }
  }

  _clearUserCache(userId) {
    const keysToDelete = [];
    for (const [key] of this.engagementCache) {
      if (key.includes(`_${userId}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.engagementCache.delete(key));
  }

  /**
   * Clear interaction tracking cache
   */
  clearCache() {
    this.engagementCache.clear();
  }
}

export default new InteractionTrackingService();