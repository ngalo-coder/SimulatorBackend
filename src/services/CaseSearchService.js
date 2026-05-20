import Case, { CaseCategory } from '../models/CaseModel.js';
import mongoose from 'mongoose';
import CasePublishingService from './CasePublishingService.js';

/**
 * Case Search Service
 * Handles advanced search and filtering capabilities for cases
 */
class CaseSearchService {
  constructor() {
    this.defaultPageSize = 20;
    this.maxPageSize = 100;
  }

  /**
   * Advanced case search with multiple filters
   * @param {Object} filters - Search filters
   * @param {Object} options - Search options
   * @param {Object} user - User performing search
   * @returns {Promise<Object>} - Search results
   */
  async advancedSearch(filters, options = {}, user) {
    try {
      const {
        query, // General text search
        categories,
        tags,
        specialty,
        difficulty,
        status,
        programArea,
        location,
        createdBy,
        dateFrom,
        dateTo,
        multimediaTypes,
        hasMultimedia,
        minRating,
        maxRating,
        // Publication metadata filters
        accessLevel,
        targetAudience,
        availableFrom,
        availableUntil,
        licenseType,
        distributionChannel,
        sortBy = 'relevance',
        sortOrder = 'desc'
      } = filters;

      const {
        page = 1,
        limit = this.defaultPageSize,
        includeFacets = true
      } = options;

      // Build base query
      let queryObj = this.buildBaseQuery(user);

      // Add text search
      if (query) {
        queryObj.$and = queryObj.$and || [];
        queryObj.$and.push({
          $or: [
            { 'case_metadata.title': { $regex: query, $options: 'i' } },
            { 'case_metadata.specialty': { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } },
            { 'patient_persona.name': { $regex: query, $options: 'i' } },
            { 'patient_persona.chief_complaint': { $regex: query, $options: 'i' } }
          ]
        });
      }

      // Add category filter
      if (categories && categories.length > 0) {
        queryObj.categories = { $in: categories };
      }

      // Add tag filter
      if (tags && tags.length > 0) {
        queryObj.tags = { $in: tags.map(tag => new RegExp(tag, 'i')) };
      }

      // Add specialty filter
      if (specialty) {
        queryObj['case_metadata.specialty'] = specialty;
      }

      // Add difficulty filter
      if (difficulty) {
        queryObj['case_metadata.difficulty'] = difficulty;
      }

      // Add status filter
      if (status) {
        queryObj.status = status;
      }

      // Add program area filter
      if (programArea) {
        queryObj['case_metadata.program_area'] = programArea;
      }

      // Add location filter
      if (location) {
        queryObj['case_metadata.location'] = { $regex: location, $options: 'i' };
      }

      // Add creator filter
      if (createdBy) {
        queryObj.createdBy = createdBy;
      }

      // Add date range filter
      if (dateFrom || dateTo) {
        queryObj.createdAt = {};
        if (dateFrom) queryObj.createdAt.$gte = new Date(dateFrom);
        if (dateTo) queryObj.createdAt.$lte = new Date(dateTo);
      }

      // Add multimedia filters
      if (hasMultimedia === true) {
        queryObj['multimediaContent.0'] = { $exists: true };
      } else if (hasMultimedia === false) {
        queryObj.$or = queryObj.$or || [];
        queryObj.$or.push(
          { multimediaContent: { $exists: false } },
          { multimediaContent: { $size: 0 } }
        );
      }

      if (multimediaTypes && multimediaTypes.length > 0) {
        queryObj['multimediaContent.type'] = { $in: multimediaTypes };
      }

      // Add rating filters
      if (minRating || maxRating) {
        if (minRating) queryObj.averageRating = { $gte: minRating };
        if (maxRating) queryObj.averageRating = { ...queryObj.averageRating, $lte: maxRating };
      }

      // Add publication metadata filters
      if (accessLevel) {
        queryObj['publicationMetadata.accessLevel'] = accessLevel;
      }

      if (targetAudience) {
        queryObj['publicationMetadata.targetAudience'] = {
          $elemMatch: { $or: targetAudience.map(aud => ({ [aud.field]: aud.value })) }
        };
      }

      if (availableFrom) {
        queryObj['publicationMetadata.availableFrom'] = { $lte: new Date(availableFrom) };
      }

      if (availableUntil) {
        queryObj['publicationMetadata.availableUntil'] = { $gte: new Date(availableUntil) };
      }

      if (licenseType) {
        queryObj['publicationMetadata.licensing.type'] = licenseType;
      }

      if (distributionChannel) {
        queryObj['publicationMetadata.distributionChannels'] = distributionChannel;
      }

      // Build sort options
      const sortOptions = this.buildSortOptions(sortBy, sortOrder, query);

      // Execute search
      const skip = (page - 1) * limit;

      const [cases, total] = await Promise.all([
        Case.find(queryObj)
          .populate('createdBy', 'username profile.firstName profile.lastName')
          .populate('categories')
          .populate('lastModifiedBy', 'username profile.firstName profile.lastName')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Case.countDocuments(queryObj)
      ]);

      // Add facets if requested
      let facets = null;
      if (includeFacets) {
        facets = await this.generateFacets(queryObj);
      }

      // Calculate relevance scores if text search was used
      if (query) {
        cases.forEach(caseDoc => {
          caseDoc.relevanceScore = this.calculateRelevanceScore(caseDoc, query);
        });
      }

      return {
        cases,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        },
        facets,
        query: {
          filters: Object.keys(filters).filter(key => filters[key] !== undefined && filters[key] !== ''),
          sortBy,
          sortOrder
        }
      };
    } catch (error) {
      console.error('Advanced search error:', error);
      throw error;
    }
  }

  /**
   * Build base query with user access control
   * @param {Object} user - User performing search
   * @returns {Object} - Base query object
   */
  buildBaseQuery(user) {
    if (user && user.primaryRole === 'admin') {
      return {};
    }

    const now = new Date();
    let query = {
      $and: [
        {
          $or: [
            { status: 'published' },
            { status: 'approved' }
          ]
        },
        {
          $or: [
            { 'publicationMetadata.availableFrom': { $exists: false } },
            { 'publicationMetadata.availableFrom': { $lte: now } }
          ]
        },
        {
          $or: [
            { 'publicationMetadata.availableUntil': { $exists: false } },
            { 'publicationMetadata.availableUntil': { $gte: now } }
          ]
        }
      ]
    };

    if (user && user._id) {
      // Add user-specific access conditions
      query.$and.push({
        $or: [
          { createdBy: user._id },
          { 'collaborators.user': user._id },
          { 'publicationMetadata.accessLevel': 'public' },
          {
            'publicationMetadata.accessLevel': 'restricted',
            $or: [
              { 'publicationMetadata.targetAudience': { $size: 0 } },
              {
                'publicationMetadata.targetAudience': {
                  $elemMatch: {
                    $or: [
                      { discipline: user.discipline },
                      { specialty: user.profile?.specialization },
                      { program: user.profile?.program }
                    ]
                  }
                }
              }
            ]
          }
        ]
      });
    } else {
      // For non-authenticated users, only show public cases
      query.$and.push({
        'publicationMetadata.accessLevel': 'public'
      });
    }

    return query;
  }

  /**
   * Build sort options based on criteria
   * @param {string} sortBy - Sort field
   * @param {string} sortOrder - Sort order
   * @param {string} query - Search query for relevance sorting
   * @returns {Object} - Sort options
   */
  buildSortOptions(sortBy, sortOrder, query) {
    const sortOptions = {};
    const order = sortOrder === 'desc' ? -1 : 1;

    switch (sortBy) {
      case 'relevance':
        if (query) {
          // For relevance, we'll sort by a calculated score
          sortOptions.score = order;
        } else {
          sortOptions.createdAt = -1;
        }
        break;
      case 'title':
        sortOptions['case_metadata.title'] = order;
        break;
      case 'created':
        sortOptions.createdAt = order;
        break;
      case 'modified':
        sortOptions.updatedAt = order;
        break;
      case 'usage':
        sortOptions.usageCount = order;
        break;
      case 'rating':
        sortOptions.averageRating = order;
        break;
      case 'accessed':
        sortOptions.lastAccessedAt = order;
        break;
      default:
        sortOptions.createdAt = -1;
    }

    return sortOptions;
  }

  /**
   * Generate search facets for filtering
   * @param {Object} baseQuery - Base query to filter facets
   * @returns {Promise<Object>} - Facet data
   */
  async generateFacets(baseQuery) {
    try {
      const facets = await Case.aggregate([
        { $match: baseQuery },
        {
          $facet: {
            specialties: [
              { $group: { _id: '$case_metadata.specialty', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            difficulties: [
              { $group: { _id: '$case_metadata.difficulty', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            statuses: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            programAreas: [
              { $group: { _id: '$case_metadata.program_area', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            accessLevels: [
              { $group: { _id: '$publicationMetadata.accessLevel', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            licenseTypes: [
              { $group: { _id: '$publicationMetadata.licensing.type', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            multimediaTypes: [
              { $unwind: '$multimediaContent' },
              { $group: { _id: '$multimediaContent.type', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            categories: [
              { $unwind: '$categories' },
              {
                $lookup: {
                  from: 'casecategories',
                  localField: 'categories',
                  foreignField: '_id',
                  as: 'category'
                }
              },
              { $unwind: '$category' },
              { $group: { _id: { id: '$category._id', name: '$category.name' }, count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            tags: [
              { $unwind: '$tags' },
              { $group: { _id: '$tags', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 } // Top 20 tags
            ],
            dateRange: [
              {
                $group: {
                  _id: null,
                  minDate: { $min: '$createdAt' },
                  maxDate: { $max: '$createdAt' }
                }
              }
            ]
          }
        }
      ]);

      return facets[0] || {};
    } catch (error) {
      console.error('Generate facets error:', error);
      return {};
    }
  }

  /**
   * Calculate relevance score for search results
   * @param {Object} caseDoc - Case document
   * @param {string} query - Search query
   * @returns {number} - Relevance score
   */
  calculateRelevanceScore(caseDoc, query) {
    let score = 0;
    const lowerQuery = query.toLowerCase();

    // Title match (highest weight)
    if (caseDoc.case_metadata?.title?.toLowerCase().includes(lowerQuery)) {
      score += 10;
    }

    // Specialty match
    if (caseDoc.case_metadata?.specialty?.toLowerCase().includes(lowerQuery)) {
      score += 8;
    }

    // Description match
    if (caseDoc.description?.toLowerCase().includes(lowerQuery)) {
      score += 6;
    }

    // Tag matches
    const tagMatches = (caseDoc.tags || []).filter(tag =>
      tag.toLowerCase().includes(lowerQuery)
    ).length;
    score += tagMatches * 4;

    // Patient information matches
    if (caseDoc.patient_persona?.name?.toLowerCase().includes(lowerQuery)) {
      score += 3;
    }
    if (caseDoc.patient_persona?.chief_complaint?.toLowerCase().includes(lowerQuery)) {
      score += 3;
    }

    // Recent access bonus
    if (caseDoc.lastAccessedAt) {
      const daysSinceAccess = (Date.now() - new Date(caseDoc.lastAccessedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceAccess < 7) score += 2;
      else if (daysSinceAccess < 30) score += 1;
    }

    // Usage count bonus
    if (caseDoc.usageCount > 10) score += 2;
    else if (caseDoc.usageCount > 5) score += 1;

    return score;
  }

  /**
   * Get search suggestions based on partial query
   * @param {string} query - Partial search query
   * @param {Object} user - User performing search
   * @returns {Promise<Array>} - Search suggestions
   */
  async getSearchSuggestions(query, user) {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      const baseQuery = this.buildBaseQuery(user);
      const regex = new RegExp(`^${query}`, 'i');

      const suggestions = await Case.aggregate([
        { $match: baseQuery },
        {
          $project: {
            title: '$case_metadata.title',
            specialty: '$case_metadata.specialty',
            tags: 1,
            usageCount: 1
          }
        },
        {
          $facet: {
            titles: [
              { $match: { title: regex } },
              { $project: { text: '$title', type: 'title', weight: '$usageCount' } },
              { $sort: { weight: -1 } },
              { $limit: 5 }
            ],
            specialties: [
              { $match: { specialty: regex } },
              { $group: { _id: '$specialty', count: { $sum: 1 }, usage: { $sum: '$usageCount' } } },
              { $project: { text: '$_id', type: 'specialty', weight: '$usage' } },
              { $sort: { weight: -1 } },
              { $limit: 3 }
            ],
            tags: [
              { $unwind: '$tags' },
              { $match: { tags: regex } },
              { $group: { _id: '$tags', count: { $sum: 1 }, usage: { $sum: '$usageCount' } } },
              { $project: { text: '$_id', type: 'tag', weight: '$usage' } },
              { $sort: { weight: -1 } },
              { $limit: 5 }
            ]
          }
        }
      ]);

      const result = suggestions[0] || {};
      return [
        ...(result.titles || []),
        ...(result.specialties || []),
        ...(result.tags || [])
      ].sort((a, b) => (b.weight || 0) - (a.weight || 0));
    } catch (error) {
      console.error('Get search suggestions error:', error);
      return [];
    }
  }

  /**
   * Get popular search terms and filters
   * @param {Object} user - User requesting popular terms
   * @returns {Promise<Object>} - Popular search data
   */
  async getPopularSearchTerms(user) {
    try {
      const baseQuery = this.buildBaseQuery(user);

      const popularData = await Case.aggregate([
        { $match: baseQuery },
        {
          $facet: {
            topSpecialties: [
              { $group: { _id: '$case_metadata.specialty', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            topTags: [
              { $unwind: '$tags' },
              { $group: { _id: '$tags', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 15 }
            ],
            topCategories: [
              { $unwind: '$categories' },
              {
                $lookup: {
                  from: 'casecategories',
                  localField: 'categories',
                  foreignField: '_id',
                  as: 'category'
                }
              },
              { $unwind: '$category' },
              { $group: { _id: { id: '$category._id', name: '$category.name' }, count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            recentCases: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { title: '$case_metadata.title', id: '$_id' } }
            ]
          }
        }
      ]);

      return popularData[0] || {};
    } catch (error) {
      console.error('Get popular search terms error:', error);
      return {};
    }
  }

  /**
   * Save user's search query for analytics
   * @param {string} query - Search query
   * @param {Object} filters - Applied filters
   * @param {number} resultCount - Number of results
   * @param {Object} user - User who performed search
   * @returns {Promise<void>}
   */
  async saveSearchAnalytics(query, filters, resultCount, user) {
    try {
      // This would typically save to a search analytics collection
      // For now, we'll just log it
      console.log('Search analytics:', {
        userId: user._id,
        query,
        filters,
        resultCount,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Save search analytics error:', error);
    }
  }
}

export default new CaseSearchService();