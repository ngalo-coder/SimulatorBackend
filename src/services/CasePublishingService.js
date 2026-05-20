
import Case from '../models/CaseModel.js';
import ContributedCase from '../models/ContributedCaseModel.js';
import User from '../models/UserModel.js';
import CaseSearchService from './CaseSearchService.js';
import auditLogger from './AuditLoggerService.js';

/**
 * Case Publishing Service
 * Handles case publication workflow, distribution, and access control
 */
class CasePublishingService {
  constructor() {
    this.publicationStatuses = {
      DRAFT: 'draft',
      PENDING_REVIEW: 'pending_review',
      APPROVED: 'approved',
      PUBLISHED: 'published',
      ARCHIVED: 'archived',
      REJECTED: 'rejected'
    };

    this.accessLevels = {
      PUBLIC: 'public',
      RESTRICTED: 'restricted',
      PRIVATE: 'private'
    };
  }

  /**
   * Publish a case with enhanced metadata
   * @param {string} caseId - Case ID to publish
   * @param {Object} publicationData - Publication metadata and settings
   * @param {string} publishedBy - User ID publishing the case
   * @returns {Promise<Object>} - Published case with metadata
   */
  async publishCase(caseId, publicationData, publishedBy) {
    try {
      const caseDoc = await Case.findById(caseId);
      if (!caseDoc) {
        throw new Error('Case not found');
      }

      if (caseDoc.status !== this.publicationStatuses.APPROVED) {
        throw new Error('Case must be approved before publication');
      }

      // Update case with publication metadata
      const publicationMetadata = {
        publishedAt: new Date(),
        publishedBy: publishedBy,
        accessLevel: publicationData.accessLevel || this.accessLevels.RESTRICTED,
        availableFrom: publicationData.availableFrom || new Date(),
        availableUntil: publicationData.availableUntil,
        targetAudience: publicationData.targetAudience || [],
        licensing: publicationData.licensing || {
          type: 'educational',
          attributionRequired: true,
          commercialUse: false
        },
        distributionChannels: publicationData.distributionChannels || ['platform'],
        version: publicationData.version || '1.0.0',
        doi: publicationData.doi,
        isbn: publicationData.isbn,
        citation: publicationData.citation
      };

      // Add publication metadata to case
      caseDoc.publicationMetadata = publicationMetadata;
      caseDoc.status = this.publicationStatuses.PUBLISHED;
      caseDoc.publishedAt = new Date();
      caseDoc.publishedBy = publishedBy;

      await caseDoc.save();

      // Log publication event
      await auditLogger.logAuthEvent({
        event: 'CASE_PUBLISHED',
        userId: publishedBy,
        metadata: {
          caseId: caseDoc._id,
          caseTitle: caseDoc.case_metadata.title,
          accessLevel: publicationMetadata.accessLevel,
          targetAudience: publicationMetadata.targetAudience
        }
      });

      return caseDoc;
    } catch (error) {
      console.error('Publish case error:', error);
      throw error;
    }
  }

  /**
   * Unpublish/archive a case
   * @param {string} caseId - Case ID to unpublish
   * @param {string} archivedBy - User ID archiving the case
   * @param {string} reason - Reason for archiving
   * @returns {Promise<Object>} - Archived case
   */
  async unpublishCase(caseId, archivedBy, reason) {
    try {
      const caseDoc = await Case.findById(caseId);
      if (!caseDoc) {
        throw new Error('Case not found');
      }

      if (caseDoc.status !== this.publicationStatuses.PUBLISHED) {
        throw new Error('Only published cases can be unpublished');
      }

      caseDoc.status = this.publicationStatuses.ARCHIVED;
      caseDoc.archivedAt = new Date();
      caseDoc.archivedBy = archivedBy;
      caseDoc.archivalReason = reason;

      await caseDoc.save();

      // Log archival event
      await auditLogger.logAuthEvent({
        event: 'CASE_ARCHIVED',
        userId: archivedBy,
        metadata: {
          caseId: caseDoc._id,
          caseTitle: caseDoc.case_metadata.title,
          reason: reason
        }
      });

      return caseDoc;
    } catch (error) {
      console.error('Unpublish case error:', error);
      throw error;
    }
  }

  /**
   * Check case availability and access permissions
   * @param {string} caseId - Case ID to check
   * @param {Object} user - User requesting access
   * @returns {Promise<Object>} - Access information and case data if accessible
   */
  async checkCaseAccess(caseId, user) {
    try {
      const caseDoc = await Case.findById(caseId);
      if (!caseDoc) {
        throw new Error('Case not found');
      }

      const accessInfo = {
        accessible: false,
        reason: '',
        case: null,
        requiresAuth: false,
        availableFrom: caseDoc.publicationMetadata?.availableFrom,
        availableUntil: caseDoc.publicationMetadata?.availableUntil
      };

      // Check case status
      if (caseDoc.status !== this.publicationStatuses.PUBLISHED) {
        accessInfo.reason = 'Case is not published';
        return accessInfo;
      }

      // Check availability dates
      const now = new Date();
      if (caseDoc.publicationMetadata?.availableFrom && now < caseDoc.publicationMetadata.availableFrom) {
        accessInfo.reason = 'Case not available yet';
        return accessInfo;
      }

      if (caseDoc.publicationMetadata?.availableUntil && now > caseDoc.publicationMetadata.availableUntil) {
        accessInfo.reason = 'Case availability has expired';
        return accessInfo;
      }

      // Check access level
      const accessLevel = caseDoc.publicationMetadata?.accessLevel || this.accessLevels.RESTRICTED;

      switch (accessLevel) {
        case this.accessLevels.PUBLIC:
          accessInfo.accessible = true;
          break;

        case this.accessLevels.RESTRICTED:
          if (!user || !user._id) {
            accessInfo.requiresAuth = true;
            accessInfo.reason = 'Authentication required';
            return accessInfo;
          }
          // Check if user is in target audience
          const targetAudience = caseDoc.publicationMetadata?.targetAudience || [];
          if (targetAudience.length > 0) {
            const userDiscipline = user.discipline;
            const userSpecialty = user.profile?.specialization;
            
            const isInAudience = targetAudience.some(audience => 
              audience.discipline === userDiscipline || 
              audience.specialty === userSpecialty
            );
            
            if (!isInAudience) {
              accessInfo.reason = 'Not available for your discipline/specialty';
              return accessInfo;
            }
          }
          accessInfo.accessible = true;
          break;

        case this.accessLevels.PRIVATE:
          if (!user || !user._id) {
            accessInfo.requiresAuth = true;
            accessInfo.reason = 'Authentication required';
            return accessInfo;
          }
          // Check if user is owner or collaborator
          const isOwner = caseDoc.createdBy.toString() === user._id.toString();
          const isCollaborator = caseDoc.collaborators?.some(
            collab => collab.user.toString() === user._id.toString()
          );
          
          if (!isOwner && !isCollaborator) {
            accessInfo.reason = 'Private case - access denied';
            return accessInfo;
          }
          accessInfo.accessible = true;
          break;
      }

      if (accessInfo.accessible) {
        accessInfo.case = caseDoc;
      }

      return accessInfo;
    } catch (error) {
      console.error('Check case access error:', error);
      throw error;
    }
  }

  /**
   * Get published cases with advanced filtering
   * @param {Object} filters - Search and filter criteria
   * @param {Object} user - User making the request
   * @returns {Promise<Object>} - Filtered published cases
   */
  async getPublishedCases(filters = {}, user) {
    try {
      const {
        query,
        specialties,
        difficulties,
        programAreas,
        locations,
        tags,
        accessLevel,
        targetAudience,
        dateFrom,
        dateTo,
        sortBy = 'publishedAt',
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = filters;

      // Build base query for published cases
      let queryObj = {
        status: this.publicationStatuses.PUBLISHED
      };

      // Add text search
      if (query) {
        queryObj.$and = queryObj.$and || [];
        queryObj.$and.push({
          $or: [
            { 'case_metadata.title': { $regex: query, $options: 'i' } },
            { 'case_metadata.specialty': { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
          ]
        });
      }

      // Add filters
      if (specialties && specialties.length > 0) {
        queryObj['case_metadata.specialty'] = { $in: specialties };
      }

      if (difficulties && difficulties.length > 0) {
        queryObj['case_metadata.difficulty'] = { $in: difficulties };
      }

      if (programAreas && programAreas.length > 0) {
        queryObj['case_metadata.program_area'] = { $in: programAreas };
      }

      if (locations && locations.length > 0) {
        queryObj['case_metadata.location'] = { $in: locations };
      }

      if (tags && tags.length > 0) {
        queryObj.tags = { $in: tags.map(tag => new RegExp(tag, 'i')) };
      }

      if (accessLevel) {
        queryObj['publicationMetadata.accessLevel'] = accessLevel;
      }

      if (targetAudience) {
        queryObj['publicationMetadata.targetAudience'] = {
          $elemMatch: { $or: targetAudience.map(aud => ({ [aud.field]: aud.value })) }
        };
      }

      // Date range filters
      if (dateFrom || dateTo) {
        queryObj.publishedAt = {};
        if (dateFrom) queryObj.publishedAt.$gte = new Date(dateFrom);
        if (dateTo) queryObj.publishedAt.$lte = new Date(dateTo);
      }

      // Build sort options
      const sortOptions = {};
      const order = sortOrder === 'desc' ? -1 : 1;
      
      switch (sortBy) {
        case 'publishedAt':
          sortOptions.publishedAt = order;
          break;
        case 'title':
          sortOptions['case_metadata.title'] = order;
          break;
        case 'difficulty':
          sortOptions['case_metadata.difficulty'] = order;
          break;
        case 'rating':
          sortOptions.averageRating = order;
          break;
        case 'usage':
          sortOptions.usageCount = order;
          break;
        default:
          sortOptions.publishedAt = -1;
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;

      const [cases, total] = await Promise.all([
        Case.find(queryObj)
          .populate('createdBy', 'username profile.firstName profile.lastName discipline')
          .populate('categories')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Case.countDocuments(queryObj)
      ]);

      // Filter cases based on user access
      const accessibleCases = [];
      for (const caseDoc of cases) {
        const accessInfo = await this.checkCaseAccess(caseDoc._id, user);
        if (accessInfo.accessible) {
          accessibleCases.push(caseDoc);
        }
      }

      return {
        cases: accessibleCases,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: accessibleCases.length,
          totalAvailable: total,
          pages: Math.ceil(accessibleCases.length / limit),
          hasNext: page * limit < accessibleCases.length,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Get published cases error:', error);
      throw error;
    }
  }

  /**
   * Generate case recommendations based on user profile
   * @param {Object} user - User profile
   * @param {number} limit - Number of recommendations
   * @returns {Promise<Array>} - Recommended cases
   */
  async getCaseRecommendations(user, limit = 10) {
    try {
      if (!user || !user._id) {
        return this.getPopularCases(limit);
      }

      const userDiscipline = user.discipline;
      const userSpecialty = user.profile?.specialization;

      // Build recommendation query based on user profile
      let queryObj = {
        status: this.publicationStatuses.PUBLISHED,
        $or: [
          { 'publicationMetadata.targetAudience': { $elemMatch: { discipline: userDiscipline } } },
          { 'publicationMetadata.targetAudience': { $elemMatch: { specialty: userSpecialty } } },
          { 'case_metadata.specialty': userSpecialty },
          { 'case_metadata.program_area': userDiscipline === 'specialist' ? 'Specialty Program' : 'Basic Program' }
        ]
      };

      // Get cases that match user profile
      const recommendedCases = await Case.find(queryObj)
        .populate('createdBy', 'username profile.firstName profile.lastName')
        .sort({ usageCount: -1, averageRating: -1 })
        .limit(limit)
        .lean();

      // If not enough recommendations, add popular cases
      if (recommendedCases.length < limit) {
        const popularCases = await this.getPopularCases(limit - recommendedCases.length);
        recommendedCases.push(...popularCases.filter(pc => 
          !recommendedCases.some(rc => rc._id.toString() === pc._id.toString())
        ));
      }

      return recommendedCases;
    } catch (error) {
      console.error('Get case recommendations error:', error);
      return this.getPopularCases(limit);
    }
  }

  /**
   * Get popular published cases
   * @param {number} limit - Number of cases to return
   * @returns {Promise<Array>} - Popular cases
   */
  async getPopularCases(limit = 10) {
    try {
      return await Case.find({
        status: this.publicationStatuses.PUBLISHED
      })
      .populate('createdBy', 'username profile.firstName profile.lastName')
      .sort({ usageCount: -1, averageRating: -1 })
      .limit(limit)
      .lean();
    } catch (error) {
      console.error('Get popular cases error:', error);
      return [];
    }
  }

  /**
   * Update case usage statistics
   * @param {string} caseId - Case ID
   * @param {string} userId - User ID accessing the case
   * @returns {Promise<void>}
   */
  async trackCaseUsage(caseId, userId) {
    try {
      await Case.findByIdAndUpdate(caseId, {
        $inc: { usageCount: 1, accessCount: 1 },
        $set: { lastAccessedAt: new Date() },
        $push: {
          accessLog: {
            userId: userId,
            accessedAt: new Date(),
            userAgent: null // Could be added from request headers
          }
        }
      });
    } catch (error) {
      console.error('Track case usage error:', error);
    }
  }

  /**
   * Get case distribution statistics
   * @returns {Promise<Object>} - Distribution metrics
   */
  async getDistributionStatistics() {
    try {
      // Get basic statistics
      const basicStats = await Case.aggregate([
        { $match: { status: this.publicationStatuses.PUBLISHED } },
        {
          $group: {
            _id: null,
            totalPublished: { $sum: 1 },
            totalUsage: { $sum: '$usageCount' },
            averageRating: { $avg: '$averageRating' }
          }
        }
      ]);

      // Get distribution by specialty
      const specialtyStats = await Case.aggregate([
        { $match: { status: this.publicationStatuses.PUBLISHED } },
        { $group: { _id: '$case_metadata.specialty', count: { $sum: 1 } } }
      ]);

      // Get distribution by difficulty
      const difficultyStats = await Case.aggregate([
        { $match: { status: this.publicationStatuses.PUBLISHED } },
        { $group: { _id: '$case_metadata.difficulty', count: { $sum: 1 } } }
      ]);

      // Get distribution by access level
      const accessLevelStats = await Case.aggregate([
        { $match: { status: this.publicationStatuses.PUBLISHED } },
        { $group: { _id: '$publicationMetadata.accessLevel', count: { $sum: 1 } } }
      ]);

      // Convert to object format
      const specialtyDistribution = {};
      specialtyStats.forEach(stat => {
        if (stat._id) specialtyDistribution[stat._id] = stat.count;
      });

      const difficultyDistribution = {};
      difficultyStats.forEach(stat => {
        if (stat._id) difficultyDistribution[stat._id] = stat.count;
      });

      const accessLevelDistribution = {};
      accessLevelStats.forEach(stat => {
        if (stat._id) accessLevelDistribution[stat._id] = stat.count;
      });

      return {
        totalPublished: basicStats[0]?.totalPublished || 0,
        totalUsage: basicStats[0]?.totalUsage || 0,
        averageRating: basicStats[0]?.averageRating ? Math.round(basicStats[0].averageRating * 100) / 100 : 0,
        specialtyDistribution,
        difficultyDistribution,
        accessLevelDistribution
      };
    } catch (error) {
      console.error('Get distribution statistics error:', error);
      return {
        totalPublished: 0,
        totalUsage: 0,
        averageRating: 0,
        specialtyDistribution: {},
        difficultyDistribution: {},
        accessLevelDistribution: {}
      };
    }
  }
}

export default new CasePublishingService();