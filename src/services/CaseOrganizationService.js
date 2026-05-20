import Case, { CaseCategory } from '../models/CaseModel.js';
import User from '../models/UserModel.js';
import auditLogger from './AuditLoggerService.js';

/**
 * Case Organization Service
 * Handles case categorization, tagging, and organization features
 */
class CaseOrganizationService {
  constructor() {
    this.defaultCategories = [
      { name: 'Cardiology', color: '#EF4444', icon: '❤️' },
      { name: 'Neurology', color: '#8B5CF6', icon: '🧠' },
      { name: 'Pulmonology', color: '#06B6D4', icon: '🫁' },
      { name: 'Gastroenterology', color: '#10B981', icon: '🫄' },
      { name: 'Endocrinology', color: '#F59E0B', icon: '🦋' },
      { name: 'Nephrology', color: '#3B82F6', icon: '🫘' },
      { name: 'Hematology', color: '#DC2626', icon: '🩸' },
      { name: 'Infectious Disease', color: '#84CC16', icon: '🦠' },
      { name: 'Emergency Medicine', color: '#F97316', icon: '🚑' },
      { name: 'Surgery', color: '#6366F1', icon: '🔪' }
    ];
  }

  /**
   * Create a new case category
   * @param {Object} categoryData - Category data
   * @param {Object} user - User creating the category
   * @returns {Promise<Object>} - Created category
   */
  async createCategory(categoryData, user) {
    try {
      const { name, description, parentCategory, color, icon } = categoryData;

      // Check if category already exists
      const existingCategory = await CaseCategory.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        isActive: true
      });

      if (existingCategory) {
        throw new Error('Category with this name already exists');
      }

      // Validate parent category if provided
      if (parentCategory) {
        const parent = await CaseCategory.findById(parentCategory);
        if (!parent) {
          throw new Error('Parent category not found');
        }
      }

      const category = new CaseCategory({
        name,
        description,
        parentCategory,
        color: color || '#3B82F6',
        icon: icon || '📁',
        createdBy: user._id
      });

      await category.save();

      // Log category creation
      await auditLogger.logAuthEvent({
        event: 'CASE_CATEGORY_CREATED',
        userId: user._id,
        username: user.username,
        metadata: {
          categoryId: category._id,
          categoryName: name,
          parentCategory: parentCategory
        }
      });

      return category;
    } catch (error) {
      console.error('Create category error:', error);
      throw error;
    }
  }

  /**
   * Get all case categories
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Categories list
   */
  async getCategories(options = {}) {
    try {
      const { includeInactive = false, parentOnly = false } = options;

      let query = {};
      if (!includeInactive) {
        query.isActive = true;
      }

      if (parentOnly) {
        query.parentCategory = { $exists: false };
      }

      const categories = await CaseCategory.find(query)
        .populate('parentCategory', 'name color icon')
        .populate('createdBy', 'username profile.firstName profile.lastName')
        .sort({ name: 1 })
        .lean();

      return categories;
    } catch (error) {
      console.error('Get categories error:', error);
      throw error;
    }
  }

  /**
   * Update a case category
   * @param {string} categoryId - Category ID
   * @param {Object} updateData - Update data
   * @param {Object} user - User updating the category
   * @returns {Promise<Object>} - Updated category
   */
  async updateCategory(categoryId, updateData, user) {
    try {
      const category = await CaseCategory.findById(categoryId);

      if (!category) {
        throw new Error('Category not found');
      }

      // Check permissions (only creator or admin can update)
      if (category.createdBy.toString() !== user._id.toString() && user.primaryRole !== 'admin') {
        throw new Error('Access denied');
      }

      const { name, description, color, icon, isActive } = updateData;

      // Check for name conflicts if name is being updated
      if (name && name !== category.name) {
        const existingCategory = await CaseCategory.findOne({
          name: { $regex: new RegExp(`^${name}$`, 'i') },
          _id: { $ne: categoryId },
          isActive: true
        });

        if (existingCategory) {
          throw new Error('Category with this name already exists');
        }
      }

      // Update fields
      if (name) category.name = name;
      if (description !== undefined) category.description = description;
      if (color) category.color = color;
      if (icon) category.icon = icon;
      if (isActive !== undefined) category.isActive = isActive;

      await category.save();

      // Log category update
      await auditLogger.logAuthEvent({
        event: 'CASE_CATEGORY_UPDATED',
        userId: user._id,
        username: user.username,
        metadata: {
          categoryId: category._id,
          categoryName: category.name,
          changes: Object.keys(updateData)
        }
      });

      return category;
    } catch (error) {
      console.error('Update category error:', error);
      throw error;
    }
  }

  /**
   * Delete a case category
   * @param {string} categoryId - Category ID
   * @param {Object} user - User deleting the category
   * @returns {Promise<boolean>} - Success status
   */
  async deleteCategory(categoryId, user) {
    try {
      const category = await CaseCategory.findById(categoryId);

      if (!category) {
        throw new Error('Category not found');
      }

      // Check permissions
      if (category.createdBy.toString() !== user._id.toString() && user.primaryRole !== 'admin') {
        throw new Error('Access denied');
      }

      // Check if category has child categories
      const childCategories = await CaseCategory.countDocuments({ parentCategory: categoryId });
      if (childCategories > 0) {
        throw new Error('Cannot delete category with child categories');
      }

      // Check if category is used by cases
      const casesUsingCategory = await Case.countDocuments({ categories: categoryId });
      if (casesUsingCategory > 0) {
        throw new Error('Cannot delete category that is being used by cases');
      }

      // Soft delete
      category.isActive = false;
      await category.save();

      // Log category deletion
      await auditLogger.logAuthEvent({
        event: 'CASE_CATEGORY_DELETED',
        userId: user._id,
        username: user.username,
        metadata: {
          categoryId: category._id,
          categoryName: category.name
        }
      });

      return true;
    } catch (error) {
      console.error('Delete category error:', error);
      throw error;
    }
  }

  /**
   * Add categories to a case
   * @param {string} caseId - Case ID
   * @param {Array} categoryIds - Category IDs to add
   * @param {Object} user - User adding categories
   * @returns {Promise<Object>} - Updated case
   */
  async addCategoriesToCase(caseId, categoryIds, user) {
    try {
      const caseDoc = await Case.findById(caseId);

      if (!caseDoc) {
        throw new Error('Case not found');
      }

      // Check permissions
      if (!this.canUserEditCase(caseDoc, user)) {
        throw new Error('Access denied');
      }

      // Validate categories exist
      const categories = await CaseCategory.find({
        _id: { $in: categoryIds },
        isActive: true
      });

      if (categories.length !== categoryIds.length) {
        throw new Error('One or more categories not found');
      }

      // Add categories (avoid duplicates)
      const existingCategoryIds = caseDoc.categories.map(cat => cat.toString());
      const newCategoryIds = categoryIds.filter(id => !existingCategoryIds.includes(id.toString()));

      if (newCategoryIds.length > 0) {
        caseDoc.categories.push(...newCategoryIds);
        caseDoc.lastModifiedBy = user._id;
        caseDoc.lastModifiedAt = new Date();

        await caseDoc.save();
      }

      // Log category addition
      await auditLogger.logAuthEvent({
        event: 'CASE_CATEGORIES_ADDED',
        userId: user._id,
        username: user.username,
        metadata: {
          caseId: caseDoc._id,
          caseTitle: caseDoc.case_metadata.title,
          categoryIds: newCategoryIds,
          categoryNames: categories.filter(cat => newCategoryIds.includes(cat._id.toString())).map(cat => cat.name)
        }
      });

      return await Case.findById(caseId).populate('categories');
    } catch (error) {
      console.error('Add categories to case error:', error);
      throw error;
    }
  }

  /**
   * Remove categories from a case
   * @param {string} caseId - Case ID
   * @param {Array} categoryIds - Category IDs to remove
   * @param {Object} user - User removing categories
   * @returns {Promise<Object>} - Updated case
   */
  async removeCategoriesFromCase(caseId, categoryIds, user) {
    try {
      const caseDoc = await Case.findById(caseId);

      if (!caseDoc) {
        throw new Error('Case not found');
      }

      // Check permissions
      if (!this.canUserEditCase(caseDoc, user)) {
        throw new Error('Access denied');
      }

      // Remove categories
      caseDoc.categories = caseDoc.categories.filter(
        cat => !categoryIds.includes(cat.toString())
      );

      caseDoc.lastModifiedBy = user._id;
      caseDoc.lastModifiedAt = new Date();

      await caseDoc.save();

      // Log category removal
      await auditLogger.logAuthEvent({
        event: 'CASE_CATEGORIES_REMOVED',
        userId: user._id,
        username: user.username,
        metadata: {
          caseId: caseDoc._id,
          caseTitle: caseDoc.case_metadata.title,
          categoryIds: categoryIds
        }
      });

      return await Case.findById(caseId).populate('categories');
    } catch (error) {
      console.error('Remove categories from case error:', error);
      throw error;
    }
  }

  /**
   * Add tags to a case
   * @param {string} caseId - Case ID
   * @param {Array} tags - Tags to add
   * @param {Object} user - User adding tags
   * @returns {Promise<Object>} - Updated case
   */
  async addTagsToCase(caseId, tags, user) {
    try {
      const caseDoc = await Case.findById(caseId);

      if (!caseDoc) {
        throw new Error('Case not found');
      }

      // Check permissions
      if (!this.canUserEditCase(caseDoc, user)) {
        throw new Error('Access denied');
      }

      // Normalize and deduplicate tags
      const normalizedTags = tags.map(tag => tag.toLowerCase().trim());
      const existingTags = (caseDoc.tags || []).map(tag => tag.toLowerCase().trim());
      const newTags = normalizedTags.filter(tag => !existingTags.includes(tag));

      if (newTags.length > 0) {
        caseDoc.tags = [...(caseDoc.tags || []), ...newTags];
        caseDoc.lastModifiedBy = user._id;
        caseDoc.lastModifiedAt = new Date();

        await caseDoc.save();
      }

      // Log tag addition
      await auditLogger.logAuthEvent({
        event: 'CASE_TAGS_ADDED',
        userId: user._id,
        username: user.username,
        metadata: {
          caseId: caseDoc._id,
          caseTitle: caseDoc.case_metadata.title,
          tags: newTags
        }
      });

      return caseDoc;
    } catch (error) {
      console.error('Add tags to case error:', error);
      throw error;
    }
  }

  /**
   * Remove tags from a case
   * @param {string} caseId - Case ID
   * @param {Array} tags - Tags to remove
   * @param {Object} user - User removing tags
   * @returns {Promise<Object>} - Updated case
   */
  async removeTagsFromCase(caseId, tags, user) {
    try {
      const caseDoc = await Case.findById(caseId);

      if (!caseDoc) {
        throw new Error('Case not found');
      }

      // Check permissions
      if (!this.canUserEditCase(caseDoc, user)) {
        throw new Error('Access denied');
      }

      // Remove tags (case-insensitive)
      const normalizedTags = tags.map(tag => tag.toLowerCase().trim());
      caseDoc.tags = (caseDoc.tags || []).filter(
        tag => !normalizedTags.includes(tag.toLowerCase().trim())
      );

      caseDoc.lastModifiedBy = user._id;
      caseDoc.lastModifiedAt = new Date();

      await caseDoc.save();

      // Log tag removal
      await auditLogger.logAuthEvent({
        event: 'CASE_TAGS_REMOVED',
        userId: user._id,
        username: user.username,
        metadata: {
          caseId: caseDoc._id,
          caseTitle: caseDoc.case_metadata.title,
          tags: tags
        }
      });

      return caseDoc;
    } catch (error) {
      console.error('Remove tags from case error:', error);
      throw error;
    }
  }

  /**
   * Search cases by categories and tags
   * @param {Object} filters - Search filters
   * @param {Object} options - Search options
   * @param {Object} user - User performing search
   * @returns {Promise<Object>} - Search results
   */
  async searchCases(filters, options = {}, user) {
    try {
      const { categories, tags, specialty, difficulty, status } = filters;
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;

      let query = {};

      // Build user access query
      if (user.primaryRole !== 'admin') {
        query.$or = [
          { createdBy: user._id },
          { 'collaborators.user': user._id },
          { status: 'published' }
        ];
      }

      // Add category filter
      if (categories && categories.length > 0) {
        query.categories = { $in: categories };
      }

      // Add tag filter
      if (tags && tags.length > 0) {
        query.tags = { $in: tags.map(tag => new RegExp(tag, 'i')) };
      }

      // Add other filters
      if (specialty) {
        query['case_metadata.specialty'] = specialty;
      }

      if (difficulty) {
        query['case_metadata.difficulty'] = difficulty;
      }

      if (status) {
        query.status = status;
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const cases = await Case.find(query)
        .populate('createdBy', 'username profile.firstName profile.lastName')
        .populate('categories')
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await Case.countDocuments(query);

      return {
        cases,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Search cases error:', error);
      throw error;
    }
  }

  /**
   * Get category statistics
   * @returns {Promise<Object>} - Category statistics
   */
  async getCategoryStatistics() {
    try {
      const stats = await Case.aggregate([
        { $unwind: '$categories' },
        {
          $group: {
            _id: '$categories',
            caseCount: { $sum: 1 },
            specialties: { $addToSet: '$case_metadata.specialty' },
            difficulties: { $addToSet: '$case_metadata.difficulty' }
          }
        },
        {
          $lookup: {
            from: 'casecategories',
            localField: '_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: '$category' },
        {
          $project: {
            name: '$category.name',
            color: '$category.color',
            icon: '$category.icon',
            caseCount: 1,
            specialtyCount: { $size: '$specialties' },
            difficultyCount: { $size: '$difficulties' }
          }
        },
        { $sort: { caseCount: -1 } }
      ]);

      return stats;
    } catch (error) {
      console.error('Get category statistics error:', error);
      throw error;
    }
  }

  /**
   * Initialize default categories
   * @param {Object} user - Admin user
   * @returns {Promise<Array>} - Created categories
   */
  async initializeDefaultCategories(user) {
    try {
      const createdCategories = [];

      for (const categoryData of this.defaultCategories) {
        const existingCategory = await CaseCategory.findOne({
          name: { $regex: new RegExp(`^${categoryData.name}$`, 'i') }
        });

        if (!existingCategory) {
          const category = await this.createCategory({
            ...categoryData,
            createdBy: user._id
          }, user);
          createdCategories.push(category);
        }
      }

      return createdCategories;
    } catch (error) {
      console.error('Initialize default categories error:', error);
      throw error;
    }
  }

  // Helper methods

  canUserEditCase(caseDoc, user) {
    if (user.primaryRole === 'admin') return true;
    if (caseDoc.createdBy && caseDoc.createdBy.toString() === user._id.toString()) return true;
    if (caseDoc.collaborators) {
      const collaborator = caseDoc.collaborators.find(collab => collab.user.toString() === user._id.toString());
      if (collaborator && collaborator.permissions.includes('write')) return true;
    }
    return false;
  }
}

export default new CaseOrganizationService();