import mongoose from 'mongoose';
import ContributedCase from '../models/ContributedCaseModel.js';
import CaseReview from '../models/CaseReviewModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import ClinicianPerformance from '../models/ClinicianPerformanceModel.js';
import UserCaseProgress from '../models/UserCaseProgressModel.js';
import UserInteractionTracking from '../models/UserInteractionTrackingModel.js';
import InteractionTrackingService from './InteractionTrackingService.js';

/**
 * Analytics Service for comprehensive case usage and performance tracking
 */
class AnalyticsService {
  constructor() {
    this.metricsCache = new Map();
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get comprehensive case usage analytics
   * @param {Object} filters - Filter options (timeRange, specialty, difficulty, etc.)
   * @returns {Promise<Object>} - Case usage analytics
   */
  async getCaseUsageAnalytics(filters = {}) {
    try {
      const cacheKey = JSON.stringify(filters);
      const cached = this.metricsCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }

      const { timeRange = '30d', specialty, difficulty, programArea } = filters;
      const dateFilter = this._getDateFilter(timeRange);

      // Aggregate case usage data
      const usageStats = await this._aggregateCaseUsage(dateFilter, specialty, difficulty, programArea);
      
      // Get performance metrics
      const performanceStats = await this._aggregatePerformanceMetrics(dateFilter, specialty);
      
      // Get review quality metrics
      const reviewQuality = await this._aggregateReviewQuality(dateFilter, specialty);
      
      // Get user engagement metrics
      const engagementStats = await this._aggregateEngagementMetrics(dateFilter);

      const result = {
        usage: usageStats,
        performance: performanceStats,
        reviewQuality,
        engagement: engagementStats,
        timeRange,
        generatedAt: new Date()
      };

      this.metricsCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });

      return result;
    } catch (error) {
      console.error('Get case usage analytics error:', error);
      throw error;
    }
  }

  /**
   * Get case effectiveness metrics
   * @param {string} caseId - Optional case ID for specific case analysis
   * @returns {Promise<Object>} - Case effectiveness metrics
   */
  async getCaseEffectivenessMetrics(caseId = null) {
    try {
      const matchStage = caseId ? { case_ref: new mongoose.Types.ObjectId(caseId) } : {};
      
      const effectivenessMetrics = await PerformanceMetrics.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: caseId ? '$case_ref' : null,
            totalSessions: { $sum: 1 },
            averageScore: { $avg: '$metrics.overall_score' },
            excellentCount: {
              $sum: { $cond: [{ $gte: ['$metrics.overall_score', 85] }, 1, 0] }
            },
            goodCount: {
              $sum: { $cond: [
                { $and: [
                  { $gte: ['$metrics.overall_score', 70] },
                  { $lt: ['$metrics.overall_score', 85] }
                ]}, 1, 0
              ]}
            },
            needsImprovementCount: {
              $sum: { $cond: [{ $lt: ['$metrics.overall_score', 70] }, 1, 0] }
            },
            avgHistoryTaking: { $avg: { $toDouble: '$metrics.history_taking_rating' } },
            avgRiskAssessment: { $avg: { $toDouble: '$metrics.risk_factor_assessment_rating' } },
            avgDifferentialDiagnosis: { $avg: { $toDouble: '$metrics.differential_diagnosis_questioning_rating' } },
            avgCommunication: { $avg: { $toDouble: '$metrics.communication_and_empathy_rating' } },
            avgClinicalUrgency: { $avg: { $toDouble: '$metrics.clinical_urgency_rating' } }
          }
        },
        {
          $lookup: {
            from: 'cases',
            localField: '_id',
            foreignField: '_id',
            as: 'caseDetails'
          }
        },
        {
          $unwind: { path: '$caseDetails', preserveNullAndEmptyArrays: true }
        }
      ]);

      return effectivenessMetrics;
    } catch (error) {
      console.error('Get case effectiveness metrics error:', error);
      throw error;
    }
  }

  /**
   * Get difficulty analysis for cases
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - Difficulty analysis
   */
  async getDifficultyAnalysis(filters = {}) {
    try {
      const { specialty, programArea } = filters;
      const matchStage = {};
      
      if (specialty) {
        matchStage['caseDetails.case_metadata.specialty'] = specialty;
      }
      if (programArea) {
        matchStage['caseDetails.case_metadata.program_area'] = programArea;
      }

      const difficultyStats = await PerformanceMetrics.aggregate([
        {
          $lookup: {
            from: 'cases',
            localField: 'case_ref',
            foreignField: '_id',
            as: 'caseDetails'
          }
        },
        { $unwind: '$caseDetails' },
        { $match: matchStage },
        {
          $group: {
            _id: '$caseDetails.case_metadata.difficulty',
            totalSessions: { $sum: 1 },
            averageScore: { $avg: '$metrics.overall_score' },
            passRate: {
              $avg: { $cond: [{ $gte: ['$metrics.overall_score', 70] }, 1, 0] }
            },
            excellentRate: {
              $avg: { $cond: [{ $gte: ['$metrics.overall_score', 85] }, 1, 0] }
            },
            avgCompletionTime: { $avg: '$session_duration' } // Assuming this field exists
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return difficultyStats;
    } catch (error) {
      console.error('Get difficulty analysis error:', error);
      throw error;
    }
  }

  /**
   * Get trend analysis for performance metrics
   * @param {string} timeRange - Time range for trend analysis
   * @param {string} interval - Time interval (day, week, month)
   * @returns {Promise<Array>} - Trend data
   */
  async getPerformanceTrends(timeRange = '90d', interval = 'week') {
    try {
      const dateFilter = this._getDateFilter(timeRange);
      const groupFormat = this._getGroupFormat(interval);

      const trends = await PerformanceMetrics.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: groupFormat, date: '$createdAt' } },
              specialty: '$case_ref' // This would need adjustment for proper grouping
            },
            averageScore: { $avg: '$metrics.overall_score' },
            sessionCount: { $sum: 1 },
            excellentCount: { $sum: { $cond: [{ $gte: ['$metrics.overall_score', 85] }, 1, 0] } }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      return trends;
    } catch (error) {
      console.error('Get performance trends error:', error);
      throw error;
    }
  }

  /**
   * Get contributor performance analytics
   * @returns {Promise<Array>} - Contributor performance metrics
   */
  async getContributorAnalytics() {
    try {
      const contributorStats = await ContributedCase.aggregate([
        {
          $group: {
            _id: '$contributorId',
            totalCases: { $sum: 1 },
            approvedCases: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            rejectedCases: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            pendingCases: {
              $sum: { $cond: [{ $in: ['$status', ['submitted', 'under_review']] }, 1, 0] }
            },
            averageReviewScore: { $avg: '$reviewScore' },
            averageQualityRating: { $avg: '$qualityRating' },
            averageEducationalRating: { $avg: '$educationalValueRating' },
            contributorName: { $first: '$contributorName' },
            contributorEmail: { $first: '$contributorEmail' }
          }
        },
        {
          $addFields: {
            approvalRate: {
              $cond: [
                { $gt: ['$totalCases', 0] },
                { $multiply: [{ $divide: ['$approvedCases', '$totalCases'] }, 100] },
                0
              ]
            }
          }
        },
        { $sort: { totalCases: -1 } }
      ]);

      return contributorStats;
    } catch (error) {
      console.error('Get contributor analytics error:', error);
      throw error;
    }
  }

  /**
   * Get review quality metrics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - Review quality metrics
   */
  async getReviewQualityMetrics(filters = {}) {
    try {
      const { timeRange = '30d', reviewerId } = filters;
      const dateFilter = this._getDateFilter(timeRange);

      const matchStage = { 
        status: 'completed',
        completedAt: dateFilter
      };

      if (reviewerId) {
        matchStage.reviewerId = new mongoose.Types.ObjectId(reviewerId);
      }

      const reviewQuality = await CaseReview.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: reviewerId ? '$reviewerId' : null,
            totalReviews: { $sum: 1 },
            averageReviewTime: { $avg: '$timeSpent' },
            averageClinicalAccuracy: { $avg: '$ratings.clinicalAccuracy' },
            averageEducationalValue: { $avg: '$ratings.educationalValue' },
            averageCompleteness: { $avg: '$ratings.completeness' },
            averageClarity: { $avg: '$ratings.clarity' },
            averageCulturalAppropriateness: { $avg: '$ratings.culturalAppropriateness' },
            approvalRate: {
              $avg: { $cond: [{ $eq: ['$decision', 'approved'] }, 1, 0] }
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'reviewerDetails'
          }
        },
        { $unwind: { path: '$reviewerDetails', preserveNullAndEmptyArrays: true } }
      ]);

      return reviewQuality;
    } catch (error) {
      console.error('Get review quality metrics error:', error);
      throw error;
    }
  }

  // Private helper methods
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
        return '%Y-%U'; // Year-Week number
      case 'month':
        return '%Y-%m';
      default:
        return '%Y-%m-%d';
    }
  }

  async _aggregateCaseUsage(dateFilter, specialty, difficulty, programArea) {
    const matchStage = { createdAt: dateFilter };
    
    if (specialty) {
      matchStage['caseData.case_metadata.specialty'] = specialty;
    }
    if (difficulty) {
      matchStage['caseData.case_metadata.difficulty'] = difficulty;
    }
    if (programArea) {
      matchStage['caseData.case_metadata.program_area'] = programArea;
    }

    return await ContributedCase.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            specialty: '$caseData.case_metadata.specialty',
            status: '$status'
          },
          count: { $sum: 1 },
          avgQualityRating: { $avg: '$qualityRating' },
          avgEducationalRating: { $avg: '$educationalValueRating' }
        }
      }
    ]);
  }

  async _aggregatePerformanceMetrics(dateFilter, specialty) {
    const matchStage = { createdAt: dateFilter };
    
    if (specialty) {
      // This would need a lookup to cases collection first
    }

    return await PerformanceMetrics.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          averageScore: { $avg: '$metrics.overall_score' },
          passRate: {
            $avg: { $cond: [{ $gte: ['$metrics.overall_score', 70] }, 1, 0] }
          }
        }
      }
    ]);
  }

  async _aggregateReviewQuality(dateFilter, specialty) {
    const matchStage = { 
      status: 'completed',
      completedAt: dateFilter 
    };

    return await CaseReview.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgReviewTime: { $avg: '$timeSpent' },
          avgClinicalAccuracy: { $avg: '$ratings.clinicalAccuracy' },
          avgEducationalValue: { $avg: '$ratings.educationalValue' }
        }
      }
    ]);
  }

  async _aggregateEngagementMetrics(dateFilter) {
    const [userProgress, activeUsers] = await Promise.all([
      UserCaseProgress.countDocuments({ lastUpdatedAt: dateFilter }),
      UserCaseProgress.distinct('userId', { lastUpdatedAt: dateFilter })
    ]);

    return {
      totalSessions: userProgress,
      activeUsers: activeUsers.length
    };
  }

  /**
   * Get comprehensive engagement analytics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - Engagement analytics
   */
  async getEngagementAnalytics(filters = {}) {
    try {
      const { timeRange = '30d', specialty, difficulty } = filters;
      const dateFilter = this._getDateFilter(timeRange);

      const engagementStats = await this._aggregateEngagementMetrics(dateFilter, specialty, difficulty);
      
      return {
        engagement: engagementStats,
        timeRange,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Get engagement analytics error:', error);
      throw error;
    }
  }

  /**
   * Get user engagement patterns
   * @param {string} userId - User ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - User engagement patterns
   */
  async getUserEngagementPatterns(userId, options = {}) {
    try {
      const { timeRange = '30d', granularity = 'week' } = options;
      
      const patterns = await InteractionTrackingService.analyzeCompetencyTrends(userId, {
        timeRange,
        granularity
      });

      return {
        patterns,
        timeRange,
        granularity,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Get user engagement patterns error:', error);
      throw error;
    }
  }

  /**
   * Get learning behavior insights
   * @param {string} userId - User ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Learning behavior insights
   */
  async getLearningBehaviorInsights(userId, options = {}) {
    try {
      const { timeRange = '90d' } = options;
      
      const insights = await InteractionTrackingService.getLearningBehaviorInsights(userId, {
        timeRange
      });

      return {
        insights,
        timeRange,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Get learning behavior insights error:', error);
      throw error;
    }
  }

  /**
   * Enhanced engagement metrics aggregation
   */
  async _aggregateEngagementMetrics(dateFilter, specialty, difficulty) {
    const matchStage = { createdAt: dateFilter };
    
    if (specialty || difficulty) {
      // This would require joining with cases collection for specialty/difficulty filtering
    }

    const engagementMetrics = await UserInteractionTracking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalInteractions: { $sum: 1 },
          totalTimeSpent: { $sum: '$timeSpentSeconds' },
          averageEngagementScore: { $avg: '$engagementScore' },
          uniqueUsers: { $addToSet: '$userId' },
          caseStarts: { $sum: { $cond: [{ $eq: ['$interactionType', 'case_start'] }, 1, 0] } },
          caseCompletions: { $sum: { $cond: [{ $eq: ['$interactionType', 'case_complete'] }, 1, 0] } },
          helpRequests: { $sum: { $cond: [{ $eq: ['$interactionType', 'help_request'] }, 1, 0] } },
          resourceAccesses: { $sum: { $cond: [{ $eq: ['$interactionType', 'resource_access'] }, 1, 0] } }
        }
      }
    ]);

    const result = engagementMetrics[0] || {
      totalInteractions: 0,
      totalTimeSpent: 0,
      averageEngagementScore: 0,
      uniqueUsers: [],
      caseStarts: 0,
      caseCompletions: 0,
      helpRequests: 0,
      resourceAccesses: 0
    };

    result.activeUsers = result.uniqueUsers.length;
    delete result.uniqueUsers;

    // Calculate additional metrics
    result.averageSessionDuration = result.totalInteractions > 0
      ? Math.round(result.totalTimeSpent / result.totalInteractions)
      : 0;
    
    result.caseCompletionRate = result.caseStarts > 0
      ? (result.caseCompletions / result.caseStarts) * 100
      : 0;

    return result;
  }

  /**
   * Clear analytics cache
   */
  clearCache() {
    this.metricsCache.clear();
  }
}

export default new AnalyticsService();