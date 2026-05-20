import mongoose from 'mongoose';
import Feedback from '../models/FeedbackModel.js';
import CaseReview from '../models/CaseReviewModel.js';
import ContributedCase from '../models/ContributedCaseModel.js';
import User from '../models/UserModel.js';

/**
 * Feedback Service for student feedback collection and analysis
 */
class FeedbackService {
  constructor() {
    this.feedbackTypes = {
      CASE_QUALITY: 'case_quality',
      SYSTEM_USABILITY: 'system_usability',
      EDUCATIONAL_VALUE: 'educational_value',
      TECHNICAL_ISSUES: 'technical_issues',
      GENERAL_FEEDBACK: 'general_feedback'
    };

    this.sentimentLabels = {
      POSITIVE: 'positive',
      NEUTRAL: 'neutral',
      NEGATIVE: 'negative'
    };
  }

  /**
   * Submit student feedback
   * @param {Object} feedbackData - Feedback data
   * @returns {Promise<Object>} - Created feedback
   */
  async submitFeedback(feedbackData) {
    try {
      const {
        userId,
        caseId,
        feedbackType,
        rating,
        comments,
        metadata = {}
      } = feedbackData;

      // Validate required fields
      if (!userId || !feedbackType || !rating) {
        throw new Error('User ID, feedback type, and rating are required');
      }

      // Analyze sentiment from comments
      const sentiment = this._analyzeSentiment(comments);
      
      // Create feedback record
      const feedback = new Feedback({
        userId,
        caseId: caseId || null,
        feedbackType,
        rating: parseInt(rating),
        comments: comments || '',
        sentiment,
        metadata: {
          ...metadata,
          userAgent: metadata.userAgent || '',
          pageUrl: metadata.pageUrl || '',
          timestamp: new Date()
        }
      });

      await feedback.save();

      // Update case ratings if this is case quality feedback
      if (caseId && feedbackType === this.feedbackTypes.CASE_QUALITY) {
        await this._updateCaseRatings(caseId, rating, comments);
      }

      // Log feedback submission
      console.log(`Feedback submitted by user ${userId}, type: ${feedbackType}, rating: ${rating}`);

      return feedback;
    } catch (error) {
      console.error('Submit feedback error:', error);
      throw error;
    }
  }

  /**
   * Get feedback analytics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - Feedback analytics
   */
  async getFeedbackAnalytics(filters = {}) {
    try {
      const { 
        timeRange = '30d', 
        feedbackType, 
        caseId, 
        specialty,
        sentiment 
      } = filters;

      const dateFilter = this._getDateFilter(timeRange);
      const matchStage = { createdAt: dateFilter };

      if (feedbackType) {
        matchStage.feedbackType = feedbackType;
      }
      if (caseId) {
        matchStage.caseId = caseId;
      }
      if (sentiment) {
        matchStage.sentiment = sentiment;
      }

      // Aggregate feedback statistics
      const feedbackStats = await Feedback.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              feedbackType: '$feedbackType',
              sentiment: '$sentiment'
            },
            count: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            minRating: { $min: '$rating' },
            maxRating: { $max: '$rating' }
          }
        },
        {
          $sort: { '_id.feedbackType': 1, '_id.sentiment': 1 }
        }
      ]);

      // Get case-specific feedback if caseId is provided
      let caseFeedback = [];
      if (caseId) {
        caseFeedback = await Feedback.find({ caseId })
          .populate('userId', 'username profile.firstName profile.lastName')
          .sort({ createdAt: -1 })
          .limit(20);
      }

      // Get sentiment distribution
      const sentimentDistribution = await Feedback.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$sentiment',
            count: { $sum: 1 },
            percentage: { 
              $avg: { 
                $cond: [{ $eq: ['$sentiment', '$sentiment'] }, 1, 0] 
              } 
            }
          }
        }
      ]);

      // Get trending issues
      const trendingIssues = await this._getTrendingIssues(dateFilter);

      return {
        summary: feedbackStats,
        sentimentDistribution,
        trendingIssues,
        recentFeedback: caseFeedback,
        totalFeedback: await Feedback.countDocuments(matchStage),
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Get feedback analytics error:', error);
      throw error;
    }
  }

  /**
   * Get feedback for a specific case
   * @param {string} caseId - Case ID
   * @returns {Promise<Array>} - Case feedback
   */
  async getCaseFeedback(caseId) {
    try {
      const feedback = await Feedback.find({ caseId })
        .populate('userId', 'username profile.firstName profile.lastName discipline')
        .sort({ createdAt: -1 });

      // Calculate average ratings
      const ratings = await Feedback.aggregate([
        { $match: { caseId: new mongoose.Types.ObjectId(caseId) } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalFeedback: { $sum: 1 },
            positiveCount: { 
              $sum: { $cond: [{ $eq: ['$sentiment', this.sentimentLabels.POSITIVE] }, 1, 0] }
            },
            negativeCount: { 
              $sum: { $cond: [{ $eq: ['$sentiment', this.sentimentLabels.NEGATIVE] }, 1, 0] }
            }
          }
        }
      ]);

      return {
        feedback,
        ratings: ratings[0] || {
          averageRating: 0,
          totalFeedback: 0,
          positiveCount: 0,
          negativeCount: 0
        }
      };
    } catch (error) {
      console.error('Get case feedback error:', error);
      throw error;
    }
  }

  /**
   * Get user feedback history
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - User feedback history
   */
  async getUserFeedbackHistory(userId) {
    try {
      return await Feedback.find({ userId })
        .populate('caseId', 'caseData.case_metadata.title caseData.case_metadata.specialty')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Get user feedback history error:', error);
      throw error;
    }
  }

  /**
   * Analyze feedback trends over time
   * @param {string} timeRange - Time range for analysis
   * @returns {Promise<Array>} - Trend data
   */
  async analyzeFeedbackTrends(timeRange = '90d') {
    try {
      const dateFilter = this._getDateFilter(timeRange);

      const trends = await Feedback.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: {
              week: { $week: '$createdAt' },
              year: { $year: '$createdAt' },
              feedbackType: '$feedbackType'
            },
            averageRating: { $avg: '$rating' },
            count: { $sum: 1 },
            positiveCount: {
              $sum: { $cond: [{ $eq: ['$sentiment', this.sentimentLabels.POSITIVE] }, 1, 0] }
            },
            negativeCount: {
              $sum: { $cond: [{ $eq: ['$sentiment', this.sentimentLabels.NEGATIVE] }, 1, 0] }
            }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.week': 1 }
        }
      ]);

      return trends;
    } catch (error) {
      console.error('Analyze feedback trends error:', error);
      throw error;
    }
  }

  /**
   * Export feedback data for reporting
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} - Export data
   */
  async exportFeedbackData(filters = {}) {
    try {
      const { startDate, endDate, feedbackType } = filters;
      const matchStage = {};

      if (startDate && endDate) {
        matchStage.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      if (feedbackType) {
        matchStage.feedbackType = feedbackType;
      }

      return await Feedback.find(matchStage)
        .populate('userId', 'username email profile.firstName profile.lastName discipline')
        .populate('caseId', 'caseData.case_metadata.title caseData.case_metadata.specialty')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Export feedback data error:', error);
      throw error;
    }
  }

  // Private helper methods
  _analyzeSentiment(comments) {
    if (!comments) return this.sentimentLabels.NEUTRAL;

    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'helpful', 'useful', 'love', 'like'];
    const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'hate', 'dislike', 'frustrating', 'broken'];

    const text = comments.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    positiveWords.forEach(word => {
      if (text.includes(word)) positiveCount++;
    });

    negativeWords.forEach(word => {
      if (text.includes(word)) negativeCount++;
    });

    if (positiveCount > negativeCount) {
      return this.sentimentLabels.POSITIVE;
    } else if (negativeCount > positiveCount) {
      return this.sentimentLabels.NEGATIVE;
    } else {
      return this.sentimentLabels.NEUTRAL;
    }
  }

  async _updateCaseRatings(caseId, rating, comments) {
    try {
      const caseDoc = await ContributedCase.findById(caseId);
      if (!caseDoc) return;

      // Update case ratings based on feedback
      const newRating = parseInt(rating);
      
      // Simple average calculation for demo purposes
      // In production, you might want a more sophisticated algorithm
      if (caseDoc.studentFeedbackCount === undefined) {
        caseDoc.studentFeedbackCount = 0;
        caseDoc.averageStudentRating = 0;
      }

      const currentTotal = caseDoc.averageStudentRating * caseDoc.studentFeedbackCount;
      caseDoc.studentFeedbackCount += 1;
      caseDoc.averageStudentRating = (currentTotal + newRating) / caseDoc.studentFeedbackCount;

      // Store feedback comments for review
      if (comments) {
        if (!caseDoc.studentFeedbackComments) {
          caseDoc.studentFeedbackComments = [];
        }
        caseDoc.studentFeedbackComments.push({
          comment: comments,
          rating: newRating,
          timestamp: new Date()
        });
      }

      await caseDoc.save();
    } catch (error) {
      console.error('Update case ratings error:', error);
    }
  }

  async _getTrendingIssues(dateFilter) {
    // Simple keyword analysis for trending issues
    const issues = await Feedback.aggregate([
      { $match: { 
        createdAt: dateFilter,
        sentiment: this.sentimentLabels.NEGATIVE 
      }},
      {
        $group: {
          _id: {
            $toLower: {
              $substrCP: ['$comments', 0, 50]
            }
          },
          count: { $sum: 1 },
          examples: { $push: { comment: '$comments', rating: '$rating' } }
        }
      },
      { $match: { count: { $gt: 1 } } }, // Only show issues mentioned multiple times
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return issues;
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
}

export default new FeedbackService();