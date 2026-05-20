import mongoose from 'mongoose';
import ContributedCase from '../models/ContributedCaseModel.js';
import CaseReview from '../models/CaseReviewModel.js';
import Feedback from '../models/FeedbackModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';

/**
 * Quality Check Service for automated case validation and quality assurance
 */
class QualityCheckService {
  constructor() {
    this.validationRules = {
      MIN_CASE_LENGTH: 500, // Minimum characters for case content
      MAX_CASE_LENGTH: 10000, // Maximum characters for case content
      REQUIRED_FIELDS: [
        'caseData.case_metadata.title',
        'caseData.case_metadata.specialty',
        'caseData.case_metadata.difficulty',
        'caseData.patient_persona.name',
        'caseData.patient_persona.age',
        'caseData.patient_persona.gender',
        'caseData.patient_persona.chief_complaint',
        'caseData.initial_prompt',
        'caseData.clinical_dossier.hidden_diagnosis'
      ],
      CONTENT_GUIDELINES: {
        minClinicalAccuracyScore: 3.5,
        minEducationalValueScore: 3.0,
        maxTechnicalIssueReports: 3,
        minStudentRating: 2.5
      }
    };

    this.qualityThresholds = {
      EXCELLENT: 4.5,
      GOOD: 3.5,
      FAIR: 2.5,
      POOR: 2.0
    };
  }

  /**
   * Run comprehensive quality checks on a case
   * @param {string} caseId - Case ID to check
   * @returns {Promise<Object>} - Quality check results
   */
  async runQualityChecks(caseId) {
    try {
      const caseDoc = await ContributedCase.findById(caseId);
      if (!caseDoc) {
        throw new Error('Case not found');
      }

      const checks = await Promise.all([
        this._validateRequiredFields(caseDoc),
        this._validateContentLength(caseDoc),
        this._checkClinicalAccuracy(caseDoc),
        this._checkEducationalValue(caseDoc),
        this._checkStudentFeedback(caseId),
        this._checkPerformanceMetrics(caseId),
        this._checkTechnicalIssues(caseId)
      ]);

      const results = {
        caseId: caseDoc._id,
        caseTitle: caseDoc.caseData.case_metadata.title,
        overallScore: this._calculateOverallScore(checks),
        passed: checks.every(check => check.passed),
        checks: checks.reduce((acc, check) => ({ ...acc, ...check }), {}),
        recommendations: this._generateRecommendations(checks),
        lastChecked: new Date()
      };

      // Update case quality flags
      await this._updateCaseQualityFlags(caseDoc, results);

      return results;
    } catch (error) {
      console.error('Run quality checks error:', error);
      throw error;
    }
  }

  /**
   * Validate required fields in case content
   * @param {Object} caseDoc - Case document
   * @returns {Object} - Validation results
   */
  async _validateRequiredFields(caseDoc) {
    const missingFields = [];
    
    this.validationRules.REQUIRED_FIELDS.forEach(fieldPath => {
      const value = this._getNestedValue(caseDoc, fieldPath);
      if (value === undefined || value === null || value === '') {
        missingFields.push(fieldPath);
      }
    });

    return {
      requiredFields: {
        passed: missingFields.length === 0,
        missingFields,
        message: missingFields.length > 0 
          ? `Missing required fields: ${missingFields.join(', ')}`
          : 'All required fields present'
      }
    };
  }

  /**
   * Validate case content length
   * @param {Object} caseDoc - Case document
   * @returns {Object} - Validation results
   */
  async _validateContentLength(caseDoc) {
    const content = JSON.stringify(caseDoc.caseData);
    const length = content.length;
    
    const isTooShort = length < this.validationRules.MIN_CASE_LENGTH;
    const isTooLong = length > this.validationRules.MAX_CASE_LENGTH;

    return {
      contentLength: {
        passed: !isTooShort && !isTooLong,
        currentLength: length,
        minRequired: this.validationRules.MIN_CASE_LENGTH,
        maxAllowed: this.validationRules.MAX_CASE_LENGTH,
        message: isTooShort 
          ? `Case content too short (${length} chars, min ${this.validationRules.MIN_CASE_LENGTH})`
          : isTooLong
          ? `Case content too long (${length} chars, max ${this.validationRules.MAX_CASE_LENGTH})`
          : 'Case content length acceptable'
      }
    };
  }

  /**
   * Check clinical accuracy based on review ratings
   * @param {Object} caseDoc - Case document
   * @returns {Object} - Check results
   */
  async _checkClinicalAccuracy(caseDoc) {
    const accuracyRating = caseDoc.clinicalAccuracyRating || 0;
    const minScore = this.validationRules.CONTENT_GUIDELINES.minClinicalAccuracyScore;

    return {
      clinicalAccuracy: {
        passed: accuracyRating >= minScore,
        currentRating: accuracyRating,
        minRequired: minScore,
        message: accuracyRating >= minScore
          ? `Clinical accuracy meets standards (${accuracyRating}/5)`
          : `Clinical accuracy below standards (${accuracyRating}/5, min ${minScore})`
      }
    };
  }

  /**
   * Check educational value based on review ratings
   * @param {Object} caseDoc - Case document
   * @returns {Object} - Check results
   */
  async _checkEducationalValue(caseDoc) {
    const educationalRating = caseDoc.educationalValueRating || 0;
    const minScore = this.validationRules.CONTENT_GUIDELINES.minEducationalValueScore;

    return {
      educationalValue: {
        passed: educationalRating >= minScore,
        currentRating: educationalRating,
        minRequired: minScore,
        message: educationalRating >= minScore
          ? `Educational value meets standards (${educationalRating}/5)`
          : `Educational value below standards (${educationalRating}/5, min ${minScore})`
      }
    };
  }

  /**
   * Check student feedback for the case
   * @param {string} caseId - Case ID
   * @returns {Object} - Check results
   */
  async _checkStudentFeedback(caseId) {
    const feedbackStats = await Feedback.aggregate([
      { $match: { caseId: new mongoose.Types.ObjectId(caseId) } },
      {
        $group: {
          _id: '$caseId',
          averageRating: { $avg: '$rating' },
          totalFeedback: { $sum: 1 },
          negativeCount: {
            $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = feedbackStats[0] || { averageRating: 0, totalFeedback: 0, negativeCount: 0 };
    const minRating = this.validationRules.CONTENT_GUIDELINES.minStudentRating;

    return {
      studentFeedback: {
        passed: stats.averageRating >= minRating && stats.negativeCount <= 2,
        averageRating: stats.averageRating,
        totalFeedback: stats.totalFeedback,
        negativeCount: stats.negativeCount,
        minRequired: minRating,
        message: stats.totalFeedback === 0
          ? 'No student feedback yet'
          : stats.averageRating >= minRating
          ? `Student feedback positive (${stats.averageRating.toFixed(1)}/5)`
          : `Student feedback concerns (${stats.averageRating.toFixed(1)}/5, min ${minRating})`
      }
    };
  }

  /**
   * Check performance metrics for the case
   * @param {string} caseId - Case ID
   * @returns {Object} - Check results
   */
  async _checkPerformanceMetrics(caseId) {
    const metrics = await PerformanceMetrics.aggregate([
      { $match: { case_ref: new mongoose.Types.ObjectId(caseId) } },
      {
        $group: {
          _id: '$case_ref',
          totalSessions: { $sum: 1 },
          averageScore: { $avg: '$metrics.overall_score' },
          passRate: {
            $avg: { $cond: [{ $gte: ['$metrics.overall_score', 70] }, 1, 0] }
          },
          excellentRate: {
            $avg: { $cond: [{ $gte: ['$metrics.overall_score', 85] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = metrics[0] || { totalSessions: 0, averageScore: 0, passRate: 0, excellentRate: 0 };

    return {
      performanceMetrics: {
        passed: stats.totalSessions > 0 && stats.passRate >= 0.6, // 60% pass rate
        totalSessions: stats.totalSessions,
        averageScore: stats.averageScore,
        passRate: stats.passRate * 100,
        excellentRate: stats.excellentRate * 100,
        message: stats.totalSessions === 0
          ? 'No performance data yet'
          : stats.passRate >= 0.6
          ? `Performance metrics acceptable (${(stats.passRate * 100).toFixed(1)}% pass rate)`
          : `Performance metrics concerning (${(stats.passRate * 100).toFixed(1)}% pass rate)`
      }
    };
  }

  /**
   * Check for technical issues reported
   * @param {string} caseId - Case ID
   * @returns {Object} - Check results
   */
  async _checkTechnicalIssues(caseId) {
    const technicalIssues = await Feedback.countDocuments({
      caseId: new mongoose.Types.ObjectId(caseId),
      feedbackType: 'technical_issues',
      rating: { $lte: 2 }
    });

    const maxAllowed = this.validationRules.CONTENT_GUIDELINES.maxTechnicalIssueReports;

    return {
      technicalIssues: {
        passed: technicalIssues <= maxAllowed,
        reportedIssues: technicalIssues,
        maxAllowed: maxAllowed,
        message: technicalIssues === 0
          ? 'No technical issues reported'
          : technicalIssues <= maxAllowed
          ? `Minor technical issues reported (${technicalIssues})`
          : `Excessive technical issues reported (${technicalIssues}, max ${maxAllowed})`
      }
    };
  }

  /**
   * Calculate overall quality score
   * @param {Array} checks - Individual check results
   * @returns {number} - Overall score (0-100)
   */
  _calculateOverallScore(checks) {
    const flatChecks = checks.flatMap(Object.values);
    const passedChecks = flatChecks.filter(check => check.passed).length;
    const totalChecks = flatChecks.length;
    
    return totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
  }

  /**
   * Generate recommendations based on check results
   * @param {Array} checks - Individual check results
   * @returns {Array} - List of recommendations
   */
  _generateRecommendations(checks) {
    const recommendations = [];
    const flatChecks = checks.flatMap(Object.values);

    flatChecks.forEach(check => {
      if (!check.passed && check.message) {
        recommendations.push(check.message);
      }
    });

    return recommendations;
  }

  /**
   * Update case quality flags based on check results
   * @param {Object} caseDoc - Case document
   * @param {Object} results - Quality check results
   */
  async _updateCaseQualityFlags(caseDoc, results) {
    caseDoc.qualityFlags.needsContentReview = results.recommendations.some(rec => 
      rec.includes('Missing required fields') || rec.includes('content too')
    );
    
    caseDoc.qualityFlags.needsDifficultyAdjustment = results.recommendations.some(rec => 
      rec.includes('Performance metrics concerning')
    );
    
    caseDoc.qualityFlags.technicalIssuesReported = results.recommendations.some(rec => 
      rec.includes('technical issues')
    );
    
    caseDoc.qualityFlags.lastQualityCheck = new Date();
    
    await caseDoc.save();
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Source object
   * @param {string} path - Dot notation path
   * @returns {*} - Value at path
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => {
      return acc && acc[part] !== undefined ? acc[part] : undefined;
    }, obj);
  }

  /**
   * Run quality checks on all cases in review queue
   * @returns {Promise<Array>} - Batch quality check results
   */
  async runBatchQualityChecks() {
    try {
      const casesNeedingReview = await ContributedCase.find({
        status: { $in: ['submitted', 'under_review'] }
      });

      const results = await Promise.all(
        casesNeedingReview.map(caseDoc => 
          this.runQualityChecks(caseDoc._id).catch(error => ({
            caseId: caseDoc._id,
            caseTitle: caseDoc.caseData.case_metadata.title,
            error: error.message,
            passed: false
          }))
        )
      );

      return results;
    } catch (error) {
      console.error('Run batch quality checks error:', error);
      throw error;
    }
  }

  /**
   * Get quality trends over time
   * @param {string} timeRange - Time range for analysis
   * @returns {Promise<Array>} - Quality trend data
   */
  async getQualityTrends(timeRange = '30d') {
    try {
      const dateFilter = this._getDateFilter(timeRange);
      
      const trends = await ContributedCase.aggregate([
        { $match: { 'qualityFlags.lastQualityCheck': dateFilter } },
        {
          $group: {
            _id: {
              week: { $week: '$qualityFlags.lastQualityCheck' },
              year: { $year: '$qualityFlags.lastQualityCheck' }
            },
            averageScore: { $avg: '$effectivenessMetrics.averageScore' },
            totalCases: { $sum: 1 },
            passedCases: {
              $sum: {
                $cond: [
                  { $and: [
                    { $gte: ['$effectivenessMetrics.passRate', 60] },
                    { $gte: ['$averageStudentRating', 2.5] }
                  ]},
                  1, 0
                ]
              }
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.week': 1 } }
      ]);

      return trends;
    } catch (error) {
      console.error('Get quality trends error:', error);
      throw error;
    }
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
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { $gte: startDate };
  }
}

export default new QualityCheckService();