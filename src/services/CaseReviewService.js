import ContributedCase from '../models/ContributedCaseModel.js';
import CaseReview from '../models/CaseReviewModel.js';
import User from '../models/UserModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import QualityCheckService from './QualityCheckService.js';
import auditLogger from './AuditLoggerService.js';

/**
 * Case Review Service
 * Handles case review assignment, workflow management, and review operations
 */
class CaseReviewService {
  constructor() {
    this.reviewStatuses = {
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled'
    };

    this.reviewDecisions = {
      APPROVED: 'approved',
      REJECTED: 'rejected',
      NEEDS_REVISION: 'needs_revision',
      PENDING: 'pending'
    };
  }

  /**
   * Assign case for review based on discipline expertise
   * @param {string} caseId - Case ID to assign for review
   * @param {Object} options - Assignment options (priority, deadline, etc.)
   * @returns {Promise<Object>} - Assigned review details
   */
  async assignCaseForReview(caseId, options = {}) {
    try {
      const contributedCase = await ContributedCase.findById(caseId);
      if (!contributedCase) {
        throw new Error('Case not found');
      }

      // Get suitable reviewers based on case specialty and discipline
      const suitableReviewers = await this.findSuitableReviewers(
        contributedCase.caseData.case_metadata.specialty,
        contributedCase.caseData.case_metadata.program_area
      );

      if (suitableReviewers.length === 0) {
        throw new Error('No suitable reviewers found for this case');
      }

      // Select reviewer based on load balancing algorithm
      const selectedReviewer = await this.selectReviewer(suitableReviewers);

      // Calculate review deadline (default: 7 days from now)
      const reviewDeadline = options.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create review assignment
      const review = new CaseReview({
        caseId: contributedCase._id,
        reviewerId: selectedReviewer._id,
        reviewerName: `${selectedReviewer.profile?.firstName} ${selectedReviewer.profile?.lastName}`,
        reviewerDiscipline: selectedReviewer.discipline,
        reviewerSpecialty: selectedReviewer.profile?.specialization,
        status: this.reviewStatuses.PENDING,
        decision: this.reviewDecisions.PENDING,
        deadline: reviewDeadline,
        priority: options.priority || 'medium',
        revisionRound: 1,
        metadata: {
          caseProgramArea: contributedCase.caseData.case_metadata.program_area,
          caseSpecialty: contributedCase.caseData.case_metadata.specialty,
          caseDifficulty: contributedCase.caseData.case_metadata.difficulty,
          contributorExperience: contributedCase.contributorExperience || 'unknown'
        }
      });

      await review.save();

      // Update case status to under_review
      contributedCase.status = 'under_review';
      contributedCase.assignedReviewerId = selectedReviewer._id;
      contributedCase.assignedReviewerName = `${selectedReviewer.profile?.firstName} ${selectedReviewer.profile?.lastName}`;
      contributedCase.reviewDeadline = reviewDeadline;
      await contributedCase.save();

      // Log review assignment
      await auditLogger.logAuthEvent({
        event: 'CASE_REVIEW_ASSIGNED',
        userId: selectedReviewer._id,
        username: selectedReviewer.username,
        metadata: {
          caseId: contributedCase._id,
          caseTitle: contributedCase.caseData.case_metadata.title,
          reviewerId: selectedReviewer._id,
          deadline: reviewDeadline,
          priority: options.priority || 'medium'
        }
      });

      return {
        review,
        case: contributedCase,
        reviewer: selectedReviewer
      };
    } catch (error) {
      console.error('Assign case for review error:', error);
      throw error;
    }
  }

  /**
   * Find suitable reviewers based on specialty and discipline
   * @param {string} specialty - Case specialty
   * @param {string} programArea - Case program area
   * @returns {Promise<Array>} - List of suitable reviewers
   */
  async findSuitableReviewers(specialty, programArea) {
    try {
      // Base query for users with educator or admin role
      const baseQuery = {
        primaryRole: { $in: ['educator', 'admin'] },
        isActive: true,
        emailVerified: true
      };

      // Find reviewers with matching specialty or discipline
      const reviewers = await User.find({
        ...baseQuery,
        $or: [
          { 'profile.specialization': specialty },
          { discipline: programArea === 'Specialty Program' ? 'specialist' : 'general' }
        ]
      }).select('username profile firstName lastName discipline profile.specialization reviewStats');

      return reviewers;
    } catch (error) {
      console.error('Find suitable reviewers error:', error);
      throw error;
    }
  }

  /**
   * Select reviewer using load balancing algorithm
   * @param {Array} reviewers - List of suitable reviewers
   * @returns {Promise<Object>} - Selected reviewer
   */
  async selectReviewer(reviewers) {
    if (reviewers.length === 0) {
      throw new Error('No reviewers available');
    }

    // Get current review load for each reviewer
    const reviewersWithLoad = await Promise.all(
      reviewers.map(async (reviewer) => {
        const pendingReviews = await CaseReview.countDocuments({
          reviewerId: reviewer._id,
          status: { $in: [this.reviewStatuses.PENDING, this.reviewStatuses.IN_PROGRESS] }
        });

        return {
          reviewer,
          load: pendingReviews
        };
      })
    );

    // Select reviewer with least load
    return reviewersWithLoad.reduce((prev, current) => 
      (prev.load < current.load) ? prev : current
    ).reviewer;
  }

  /**
   * Start a case review
   * @param {string} reviewId - Review ID
   * @param {string} reviewerId - Reviewer ID
   * @returns {Promise<Object>} - Started review
   */
  async startReview(reviewId, reviewerId) {
    try {
      const review = await CaseReview.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      if (review.reviewerId.toString() !== reviewerId) {
        throw new Error('Not authorized to start this review');
      }

      if (review.status !== this.reviewStatuses.PENDING) {
        throw new Error('Review cannot be started in current status');
      }

      await review.startReview();

      // Log review start
      await auditLogger.logAuthEvent({
        event: 'CASE_REVIEW_STARTED',
        userId: reviewerId,
        metadata: {
          reviewId: review._id,
          caseId: review.caseId
        }
      });

      // Run quality checks in background
      QualityCheckService.runQualityChecks(review.caseId).catch(error => {
        console.error('Background quality check error:', error);
      });

      return review;
    } catch (error) {
      console.error('Start review error:', error);
      throw error;
    }
  }

  /**
   * Complete a case review with decision
   * @param {string} reviewId - Review ID
   * @param {string} reviewerId - Reviewer ID
   * @param {Object} reviewData - Review decision and feedback
   * @returns {Promise<Object>} - Completed review and updated case
   */
  async completeReview(reviewId, reviewerId, reviewData) {
    try {
      const { decision, feedback, ratings } = reviewData;
      
      const review = await CaseReview.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      if (review.reviewerId.toString() !== reviewerId) {
        throw new Error('Not authorized to complete this review');
      }

      if (review.status !== this.reviewStatuses.IN_PROGRESS) {
        throw new Error('Review must be in progress to complete');
      }

      await review.completeReview(decision, feedback, ratings);

      // Update case status based on review decision
      const contributedCase = await ContributedCase.findById(review.caseId);
      if (contributedCase) {
        switch (decision) {
          case this.reviewDecisions.APPROVED:
            contributedCase.status = 'approved';
            contributedCase.finalDecision = 'approved';
            break;
          case this.reviewDecisions.REJECTED:
            contributedCase.status = 'rejected';
            contributedCase.finalDecision = 'rejected';
            break;
          case this.reviewDecisions.NEEDS_REVISION:
            contributedCase.status = 'needs_revision';
            break;
        }
        contributedCase.decisionReason = feedback;
        contributedCase.reviewedAt = new Date();
        
        // Update ratings if provided
        if (ratings) {
          if (ratings.clinicalAccuracy) contributedCase.clinicalAccuracyRating = ratings.clinicalAccuracy;
          if (ratings.educationalValue) contributedCase.educationalValueRating = ratings.educationalValue;
        }

        await contributedCase.save();
      }

      // Log review completion
      await auditLogger.logAuthEvent({
        event: 'CASE_REVIEW_COMPLETED',
        userId: reviewerId,
        metadata: {
          reviewId: review._id,
          caseId: review.caseId,
          decision: decision,
          ratings: ratings
        }
      });

      // Run quality checks in background to update case metrics
      QualityCheckService.runQualityChecks(review.caseId).catch(error => {
        console.error('Background quality check error:', error);
      });

      return { review, case: contributedCase };
    } catch (error) {
      console.error('Complete review error:', error);
      throw error;
    }
  }

  /**
   * Add annotation to a review
   * @param {string} reviewId - Review ID
   * @param {string} reviewerId - Reviewer ID
   * @param {Object} annotationData - Annotation details
   * @returns {Promise<Object>} - Updated review with new annotation
   */
  async addAnnotation(reviewId, reviewerId, annotationData) {
    try {
      const review = await CaseReview.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      if (review.reviewerId.toString() !== reviewerId) {
        throw new Error('Not authorized to add annotations to this review');
      }

      await review.addAnnotation({
        ...annotationData,
        createdBy: reviewerId
      });

      // Log annotation addition
      await auditLogger.logAuthEvent({
        event: 'REVIEW_ANNOTATION_ADDED',
        userId: reviewerId,
        metadata: {
          reviewId: review._id,
          caseId: review.caseId,
          annotationType: annotationData.type,
          fieldPath: annotationData.fieldPath
        }
      });

      return review;
    } catch (error) {
      console.error('Add annotation error:', error);
      throw error;
    }
  }

  /**
   * Resolve an annotation
   * @param {string} reviewId - Review ID
   * @param {number} annotationIndex - Annotation index
   * @param {string} resolvedBy - User ID resolving the annotation
   * @returns {Promise<Object>} - Updated review
   */
  async resolveAnnotation(reviewId, annotationIndex, resolvedBy) {
    try {
      const review = await CaseReview.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      await review.resolveAnnotation(annotationIndex, resolvedBy);

      // Log annotation resolution
      await auditLogger.logAuthEvent({
        event: 'REVIEW_ANNOTATION_RESOLVED',
        userId: resolvedBy,
        metadata: {
          reviewId: review._id,
          caseId: review.caseId,
          annotationIndex: annotationIndex
        }
      });

      return review;
    } catch (error) {
      console.error('Resolve annotation error:', error);
      throw error;
    }
  }

  /**
   * Get reviews for a specific case
   * @param {string} caseId - Case ID
   * @returns {Promise<Array>} - List of reviews for the case
   */
  async getCaseReviews(caseId) {
    try {
      return await CaseReview.findByCaseId(caseId);
    } catch (error) {
      console.error('Get case reviews error:', error);
      throw error;
    }
  }

  /**
   * Get pending reviews for a reviewer
   * @param {string} reviewerId - Reviewer ID
   * @returns {Promise<Array>} - List of pending reviews
   */
  async getPendingReviews(reviewerId) {
    try {
      return await CaseReview.findPendingByReviewer(reviewerId);
    } catch (error) {
      console.error('Get pending reviews error:', error);
      throw error;
    }
  }

  /**
   * Reassign a review to a different reviewer
   * @param {string} reviewId - Review ID to reassign
   * @param {string} newReviewerId - New reviewer ID
   * @param {string} reassignedBy - User ID reassigning the review
   * @returns {Promise<Object>} - Reassigned review
   */
  async reassignReview(reviewId, newReviewerId, reassignedBy) {
    try {
      const review = await CaseReview.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      const newReviewer = await User.findById(newReviewerId);
      if (!newReviewer) {
        throw new Error('New reviewer not found');
      }

      // Update review with new reviewer
      review.reviewerId = newReviewerId;
      review.reviewerName = `${newReviewer.profile?.firstName} ${newReviewer.profile?.lastName}`;
      review.reviewerDiscipline = newReviewer.discipline;
      review.reviewerSpecialty = newReviewer.profile?.specialization;
      review.status = this.reviewStatuses.PENDING;
      review.startedAt = null;

      await review.save();

      // Update case assignment
      const contributedCase = await ContributedCase.findById(review.caseId);
      if (contributedCase) {
        contributedCase.assignedReviewerId = newReviewerId;
        contributedCase.assignedReviewerName = `${newReviewer.profile?.firstName} ${newReviewer.profile?.lastName}`;
        await contributedCase.save();
      }

      // Log review reassignment
      await auditLogger.logAuthEvent({
        event: 'CASE_REVIEW_REASSIGNED',
        userId: reassignedBy,
        metadata: {
          reviewId: review._id,
          caseId: review.caseId,
          previousReviewerId: review.reviewerId,
          newReviewerId: newReviewerId
        }
      });

      return review;
    } catch (error) {
      console.error('Reassign review error:', error);
      throw error;
    }
  }

  /**
   * Get review statistics for dashboard
   * @returns {Promise<Object>} - Review statistics
   */
  async getReviewStatistics() {
    try {
      const [
        totalReviews,
        pendingReviews,
        inProgressReviews,
        completedReviews,
        averageReviewTime,
        casesByStatus
      ] = await Promise.all([
        CaseReview.countDocuments(),
        CaseReview.countDocuments({ status: this.reviewStatuses.PENDING }),
        CaseReview.countDocuments({ status: this.reviewStatuses.IN_PROGRESS }),
        CaseReview.countDocuments({ status: this.reviewStatuses.COMPLETED }),
        this.calculateAverageReviewTime(),
        ContributedCase.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
      ]);

      return {
        totalReviews,
        pendingReviews,
        inProgressReviews,
        completedReviews,
        averageReviewTime: averageReviewTime || 0,
        casesByStatus: casesByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Get review statistics error:', error);
      throw error;
    }
  }

  /**
   * Calculate average review completion time
   * @returns {Promise<number>} - Average time in minutes
   */
  async calculateAverageReviewTime() {
    try {
      const completedReviews = await CaseReview.find({
        status: this.reviewStatuses.COMPLETED,
        startedAt: { $exists: true },
        completedAt: { $exists: true }
      });

      if (completedReviews.length === 0) return 0;

      const totalTime = completedReviews.reduce((sum, review) => {
        const timeDiff = review.completedAt - review.startedAt;
        return sum + (timeDiff / (1000 * 60)); // Convert to minutes
      }, 0);

      return Math.round(totalTime / completedReviews.length);
    } catch (error) {
      console.error('Calculate average review time error:', error);
      return 0;
    }
  }
}

export default new CaseReviewService();