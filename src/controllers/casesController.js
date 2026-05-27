/**
 * Cases Controller
 * Orchestrates case management, publishing, reviews, and template operations
 */

import caseManagementService from '../services/CaseManagementService.js';
import caseTemplateService from '../services/CaseTemplateService.js';
import caseCreationWorkflowService from '../services/CaseCreationWorkflowService.js';
import CasePublishingService from '../services/CasePublishingService.js';
import CaseReviewService from '../services/CaseReviewService.js';
import studentDashboardService from '../services/StudentDashboardService.js';
import educatorDashboardService from '../services/EducatorDashboardService.js';
import Case from '../models/CaseModel.js';

export async function getCases(req, res) {
  try {
    const filters = {
      difficulty: req.query.difficulty ? req.query.difficulty.split(',') : undefined,
      caseType: req.query.caseType ? req.query.caseType.split(',') : undefined,
      status: req.query.status,
      discipline: req.query.discipline,
      specialty: req.query.specialty,
      search: req.query.search || '',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 12,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc'
    };

    let result;
    const role = req.user?.role;

    if (role === 'student') {
      result = await studentDashboardService.getAvailableCases(req.user, filters, filters);
    } else if (role === 'educator') {
      result = await educatorDashboardService.getCaseManagementData(req.user, filters);
    } else {
      // Admin: get all cases with full management data
      result = await educatorDashboardService.getCaseManagementData(req.user, { ...filters, all: true });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get cases error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load cases' });
  }
}

export async function getPublishedCases(req, res) {
  try {
    const filters = {
      query: req.query.query,
      specialties: req.query.specialties?.split(','),
      difficulties: req.query.difficulties?.split(','),
      programAreas: req.query.programAreas?.split(','),
      locations: req.query.locations?.split(','),
      tags: req.query.tags?.split(','),
      accessLevel: req.query.accessLevel,
      sortBy: req.query.sortBy || 'publishedAt',
      sortOrder: req.query.sortOrder || 'desc',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await CasePublishingService.getPublishedCases(filters, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get published cases error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch published cases' });
  }
}

export async function getPopularCases(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const popularCases = await CasePublishingService.getPopularCases(limit);
    res.json({ success: true, data: popularCases });
  } catch (error) {
    console.error('Get popular cases error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch popular cases' });
  }
}

export async function getCaseById(req, res) {
  try {
    const { id } = req.params;

    // Try published case lookup with access control
    const accessInfo = await CasePublishingService.checkCaseAccess(id, req.user);
    if (accessInfo.accessible) {
      // Track usage for authenticated users
      if (req.user?._id) {
        CasePublishingService.trackCaseUsage(id, req.user._id).catch(() => {});
      }
      return res.json({ success: true, data: accessInfo.case });
    }

    // Fall back to direct lookup for educators/admins
    if (req.user && ['educator', 'admin'].includes(req.user.role)) {
      const caseDoc = await Case.findById(id)
        .populate('createdBy', 'username profile.firstName profile.lastName');
      if (caseDoc) return res.json({ success: true, data: caseDoc });
    }

    res.status(403).json({ success: false, message: accessInfo.reason || 'Access denied', requiresAuth: accessInfo.requiresAuth });
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch case' });
  }
}

export async function createCase(req, res) {
  try {
    const newCase = await caseManagementService.createCase(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Case created successfully',
      data: newCase
    });
  } catch (error) {
    console.error('Create case error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create case' });
  }
}

export async function updateCase(req, res) {
  try {
    const { id } = req.params;
    const updatedCase = await caseManagementService.updateCase(id, req.body, req.user);
    res.json({ success: true, message: 'Case updated successfully', data: updatedCase });
  } catch (error) {
    console.error('Update case error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update case' });
  }
}

export async function deleteCase(req, res) {
  try {
    const { id } = req.params;
    await caseManagementService.deleteCase(id, req.user);
    res.json({ success: true, message: 'Case archived successfully' });
  } catch (error) {
    console.error('Delete case error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to archive case' });
  }
}

export async function duplicateCase(req, res) {
  try {
    const { id } = req.params;
    const { title, description, includeMultimedia, createAsTemplate } = req.body;
    const duplicatedCase = await caseCreationWorkflowService.duplicateCase(id, req.user, {
      title, description,
      includeMultimedia: includeMultimedia || false,
      createAsTemplate: createAsTemplate || false
    });
    res.status(201).json({ success: true, message: 'Case duplicated successfully', data: duplicatedCase });
  } catch (error) {
    console.error('Duplicate case error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to duplicate case' });
  }
}

export async function getPendingReviews(req, res) {
  try {
    const pendingReviews = await CaseReviewService.getPendingReviews(req.user.id);
    res.json(pendingReviews);
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
}

export async function submitReview(req, res) {
  try {
    const { caseId, review } = req.body;
    const result = await CaseReviewService.submitReview(caseId, req.user, review);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to submit review' });
  }
}

export async function publishCase(req, res) {
  try {
    const { id } = req.params;
    const { accessLevel, tags } = req.body;
    const result = await CasePublishingService.publishCase(id, req.user, { accessLevel, tags });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Publish case error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to publish case' });
  }
}

export async function unpublishCase(req, res) {
  try {
    const { id } = req.params;
    const result = await CasePublishingService.unpublishCase(id, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Unpublish case error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to unpublish case' });
  }
}
