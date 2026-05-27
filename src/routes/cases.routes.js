/**
 * Unified Cases Routes
 * 
 * RESOURCE-CENTRIC ROUTING: All case-related operations consolidated here.
 * Replaces: adminRoutes.js (case parts), caseTemplateRoutes.js, 
 *           caseWorkflowRoutes.js, casePublishingRoutes.js, caseReviewRoutes.js,
 *           contributeCaseRoutes.js
 * 
 * Pattern: Single endpoint per action → role-based behavior via middleware
 */

import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAnyRole, requirePermission } from '../middleware/rbacMiddleware.js';
import * as casesController from '../controllers/casesController.js';
import { getCaseCategories } from '../controllers/simulationController.js';
import ContributedCase from '../models/ContributedCaseModel.js';

const router = express.Router();

// ──────────────────────────────────────────────
// PUBLIC / LIGHTLY AUTHENTICATED ENDPOINTS
// ──────────────────────────────────────────────

/**
 * GET /api/cases
 * Get cases - behavior differs by role via service layer
 * Student → available cases they can attempt
 * Educator → cases they manage
 * Admin → all cases with management data
 */
router.get('/', authenticateToken, casesController.getCases);

/**
 * GET /api/cases/published
 * Publicly-accessible published cases with filtering
 */
router.get('/published', casesController.getPublishedCases);

/**
 * GET /api/cases/popular
 * Get most popular cases by usage
 */
router.get('/popular', casesController.getPopularCases);

/**
 * GET /api/cases/categories
 * Get case categories
 */
router.get('/categories', getCaseCategories);

// ──────────────────────────────────────────────
// SINGLE CASE ENDPOINTS
// ──────────────────────────────────────────────

/**
 * GET /api/cases/:id
 * Get a single case (with access control)
 */
router.get('/:id', authenticateToken, casesController.getCaseById);

/**
 * POST /api/cases
 * Create a new case (educator/admin only)
 */
router.post('/', authenticateToken, requireAnyRole(['educator', 'admin']), casesController.createCase);

/**
 * PUT /api/cases/:id
 * Update a case (educator/admin only)
 */
router.put('/:id', authenticateToken, requireAnyRole(['educator', 'admin']), casesController.updateCase);

/**
 * DELETE /api/cases/:id
 * Archive/delete a case (educator/admin only)
 */
router.delete('/:id', authenticateToken, requireAnyRole(['educator', 'admin']), casesController.deleteCase);

/**
 * POST /api/cases/:id/duplicate
 * Duplicate a case (educator/admin only)
 */
router.post('/:id/duplicate', authenticateToken, requireAnyRole(['educator', 'admin']), casesController.duplicateCase);

// ──────────────────────────────────────────────
// CASE REVIEW ENDPOINTS
// ──────────────────────────────────────────────

/**
 * GET /api/cases/reviews/pending
 * Get pending reviews for a reviewer
 */
router.get('/reviews/pending', authenticateToken, requireAnyRole(['educator', 'admin']), casesController.getPendingReviews);

/**
 * GET /api/cases/reviews/queue
 * Get review queue (admin only)
 */
router.get('/reviews/queue', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const { status, specialty, priority, page = 1, limit = 20 } = req.query;
    const query = { status: 'submitted' };
    if (specialty && specialty !== 'all') query['caseData.case_metadata.specialty'] = specialty;
    if (priority && priority !== 'all') query.priority = priority;

    const cases = await ContributedCase.find(query)
      .select('caseData.case_metadata.title caseData.case_metadata.specialty caseData.case_metadata.difficulty submittedAt priority')
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ContributedCase.countDocuments(query);
    res.json({ cases, totalPages: Math.ceil(total / limit), currentPage: page, total });
  } catch (error) {
    console.error('Get review queue error:', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

/**
 * GET /api/cases/reviews/statistics
 */
router.get('/reviews/statistics', authenticateToken, requireAnyRole(['admin', 'educator']), async (req, res) => {
  try {
    const statistics = await CaseReviewService.getReviewStatistics();
    res.json(statistics);
  } catch (error) {
    console.error('Get review statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch review statistics' });
  }
});

/**
 * GET /api/cases/:id/reviews
 * Get reviews for a specific case
 */
router.get('/:id/reviews', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const reviews = await CaseReviewService.getCaseReviews(id);
    res.json(reviews);
  } catch (error) {
    console.error('Get case reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch case reviews' });
  }
});

/**
 * POST /api/cases/:id/assign-review
 * Assign case for review (admin only)
 */
router.post('/:id/assign-review', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, deadline } = req.body;
    const assignment = await CaseReviewService.assignCaseForReview(id, {
      priority,
      deadline: deadline ? new Date(deadline) : undefined
    });
    res.status(201).json({
      message: 'Case assigned for review successfully',
      review: assignment.review,
      case: assignment.case,
      reviewer: assignment.reviewer
    });
  } catch (error) {
    console.error('Assign for review error:', error);
    res.status(500).json({ error: error.message || 'Failed to assign case for review' });
  }
});

// ──────────────────────────────────────────────
// CASE PUBLISHING ENDPOINTS
// ──────────────────────────────────────────────

/**
 * POST /api/cases/:id/publish
 */
router.post('/:id/publish', authenticateToken, requireAnyRole(['educator', 'admin']), requirePermission('cases', 'publish'), async (req, res) => {
  try {
    const { id } = req.params;
    const publishedCase = await CasePublishingService.publishCase(id, req.body, req.user._id);
    res.json({ success: true, message: 'Case published successfully', data: publishedCase });
  } catch (error) {
    console.error('Publish case error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to publish case' });
  }
});

/**
 * POST /api/cases/:id/unpublish
 */
router.post('/:id/unpublish', authenticateToken, requireAnyRole(['educator', 'admin']), requirePermission('cases', 'publish'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const archivedCase = await CasePublishingService.unpublishCase(id, req.user._id, reason);
    res.json({ success: true, message: 'Case unpublished successfully', data: archivedCase });
  } catch (error) {
    console.error('Unpublish case error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to unpublish case' });
  }
});

/**
 * POST /api/cases/:id/track-usage
 */
router.post('/:id/track-usage', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await CasePublishingService.trackCaseUsage(id, req.user._id);
    res.json({ success: true, message: 'Case usage tracked successfully' });
  } catch (error) {
    console.error('Track case usage error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to track case usage' });
  }
});

// ──────────────────────────────────────────────
// CASE WORKFLOW ENDPOINTS
// ──────────────────────────────────────────────

/**
 * POST /api/cases/workflow/initialize
 */
router.post('/workflow/initialize', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { discipline } = req.body;
    if (!discipline) return res.status(400).json({ success: false, message: 'Discipline is required' });
    const workflowData = await caseCreationWorkflowService.initializeWorkflow(req.user, discipline);
    res.status(201).json({ success: true, message: 'Workflow initialized successfully', data: workflowData });
  } catch (error) {
    console.error('Initialize workflow error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to initialize workflow' });
  }
});

/**
 * GET /api/cases/workflow/steps/:discipline
 */
router.get('/workflow/steps/:discipline', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { discipline } = req.params;
    const steps = caseCreationWorkflowService.getWorkflowSteps(discipline);
    res.json({ success: true, data: { discipline, steps } });
  } catch (error) {
    console.error('Get workflow steps error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to get workflow steps' });
  }
});

/**
 * GET /api/cases/workflow/terminology
 */
router.get('/workflow/terminology', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { query = '', category = 'all' } = req.query;
    const suggestions = caseCreationWorkflowService.getTerminologySuggestions(query, category);
    res.json({ success: true, data: { query, category, suggestions } });
  } catch (error) {
    console.error('Get terminology suggestions error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get terminology suggestions' });
  }
});

// ──────────────────────────────────────────────
// CASE TEMPLATE ENDPOINTS
// ──────────────────────────────────────────────

/**
 * GET /api/cases/templates
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    // Check if requesting discipline-specific templates or all
    if (req.query.discipline) {
      const discipline = req.query.discipline;
      const template = caseTemplateService.getTemplate(discipline);
      return res.json({ success: true, data: template });
    }
    const templates = caseTemplateService.getAllTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve templates' });
  }
});

/**
 * GET /api/cases/templates/:discipline/fields
 */
router.get('/templates/:discipline/fields', authenticateToken, async (req, res) => {
  try {
    const { discipline } = req.params;
    const fields = caseTemplateService.getTemplateFields(discipline);
    res.json({ success: true, data: { discipline, fields } });
  } catch (error) {
    console.error('Get template fields error:', error);
    res.status(404).json({ success: false, message: error.message || 'Template not found' });
  }
});

/**
 * POST /api/cases/templates/:discipline/validate
 */
router.post('/templates/:discipline/validate', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { discipline } = req.params;
    const validation = caseTemplateService.validateCaseData(req.body, discipline);
    res.json({ success: true, data: validation });
  } catch (error) {
    console.error('Validate case data error:', error);
    res.status(400).json({ success: false, message: error.message || 'Validation failed' });
  }
});

/**
 * POST /api/cases/templates/:discipline/create
 */
router.post('/templates/:discipline/create', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { discipline } = req.params;
    const caseData = caseTemplateService.createCaseFromTemplate(discipline, req.body, req.user);
    res.status(201).json({ success: true, message: 'Case created from template successfully', data: caseData });
  } catch (error) {
    console.error('Create case from template error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create case from template' });
  }
});

// ──────────────────────────────────────────────
// USER CONTRIBUTION ENDPOINTS
// ──────────────────────────────────────────────

/**
 * POST /api/cases/contributions/draft
 * Save a contributor's draft
 */
router.post('/contributions/draft', authenticateToken, async (req, res) => {
  try {
    const { caseData } = req.body;
    const { id: contributorId, name: contributorName, email: contributorEmail } = req.user;

    const contributedCase = new ContributedCase({
      contributorId, contributorName, contributorEmail,
      caseData,
      status: 'draft'
    });
    await contributedCase.save();

    res.status(201).json({
      message: 'Case draft saved successfully',
      caseId: contributedCase._id,
      generatedCaseId: contributedCase.caseData?.case_metadata?.case_id
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

/**
 * POST /api/cases/contributions/submit
 * Submit a case for review
 */
router.post('/contributions/submit', authenticateToken, async (req, res) => {
  try {
    const { caseData } = req.body;
    const { id: contributorId, name: contributorName, email: contributorEmail } = req.user;

    // Validate required fields
    const requiredFields = [
      'case_metadata.title', 'case_metadata.specialty', 'case_metadata.program_area',
      'case_metadata.location', 'patient_persona.name', 'patient_persona.age',
      'patient_persona.gender', 'patient_persona.chief_complaint', 'patient_persona.emotional_tone',
      'clinical_dossier.hidden_diagnosis', 'initial_prompt'
    ];

    const missingFields = [];
    requiredFields.forEach(field => {
      const fieldPath = field.split('.');
      let value = caseData;
      for (const path of fieldPath) {
        value = value?.[path];
      }
      if (!value) missingFields.push(field);
    });

    if (missingFields.length > 0) {
      return res.status(400).json({ error: 'Missing required fields', missingFields });
    }

    const contributedCase = new ContributedCase({
      contributorId, contributorName, contributorEmail,
      caseData,
      status: 'submitted',
      submittedAt: new Date()
    });
    await contributedCase.save();

    res.status(201).json({
      message: 'Case submitted successfully for review',
      caseId: contributedCase._id,
      generatedCaseId: contributedCase.caseData.case_metadata.case_id
    });
  } catch (error) {
    console.error('Error submitting case:', error);
    res.status(500).json({ error: 'Failed to submit case' });
  }
});

/**
 * GET /api/cases/contributions/mine
 * Get current user's contributions
 */
router.get('/contributions/mine', authenticateToken, async (req, res) => {
  try {
    const contributorId = req.user.id;
    const cases = await ContributedCase.find({ contributorId })
      .sort({ updatedAt: -1 })
      .select('_id status caseData.case_metadata.title caseData.case_metadata.specialty caseData.case_metadata.case_id submittedAt createdAt reviewComments');
    res.json(cases);
  } catch (error) {
    console.error('Error fetching contributor cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// ──────────────────────────────────────────────
// CASE DRAFT WORKFLOW (Educator/Admin)
// ──────────────────────────────────────────────

router.get('/workflow/drafts', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      status: req.query.status || 'all',
      discipline: req.query.discipline || 'all'
    };
    const draftsData = await caseCreationWorkflowService.getUserDrafts(req.user, options);
    res.json({ success: true, data: draftsData });
  } catch (error) {
    console.error('Get user drafts error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve drafts' });
  }
});

router.get('/workflow/drafts/:draftId', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { draftId } = req.params;
    const draftData = await caseCreationWorkflowService.getDraft(draftId, req.user);
    res.json({ success: true, data: draftData });
  } catch (error) {
    console.error('Get draft error:', error);
    res.status(404).json({ success: false, message: error.message || 'Draft not found' });
  }
});

router.put('/workflow/drafts/:draftId/steps/:stepId', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { draftId, stepId } = req.params;
    const result = await caseCreationWorkflowService.updateWorkflowStep(draftId, stepId, req.body, req.user);
    if (!result.success) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: result.errors, warnings: result.warnings });
    }
    res.json({ success: true, message: 'Workflow step updated successfully', data: result });
  } catch (error) {
    console.error('Update workflow step error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update workflow step' });
  }
});

router.post('/workflow/drafts/:draftId/submit', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { draftId } = req.params;
    const result = await caseCreationWorkflowService.submitCaseForReview(draftId, req.user);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message, errors: result.errors, warnings: result.warnings });
    }
    res.json({ success: true, message: result.message, data: { caseId: result.caseId, draftId: result.draftId } });
  } catch (error) {
    console.error('Submit case for review error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to submit case for review' });
  }
});

router.delete('/workflow/drafts/:draftId', authenticateToken, requireAnyRole(['educator', 'admin']), async (req, res) => {
  try {
    const { draftId } = req.params;
    await caseCreationWorkflowService.deleteDraft(draftId, req.user);
    res.json({ success: true, message: 'Draft deleted successfully' });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to delete draft' });
  }
});

// ──────────────────────────────────────────────
// FORM DATA (for case contribution UI)
// ──────────────────────────────────────────────

router.get('/contributions/form-data', async (req, res) => {
  try {
    // Fetch only specialties that exist in database
    const specialties = await Case.distinct('case_metadata.specialty');
    const filteredSpecialties = specialties.filter(s => s);

    // Fetch modules per specialty from database
    const modules = {};
    for (const specialty of filteredSpecialties) {
      const specialtyModules = await Case.distinct('case_metadata.program_area', {
        'case_metadata.specialty': specialty
      });
      modules[specialty] = specialtyModules.filter(m => m);
    }

    // Fetch program areas from database
    const programAreas = await Case.distinct('case_metadata.program_area');

    // Fetch difficulties from database
    const difficulties = await Case.distinct('case_metadata.difficulty');

    // Fetch locations from database
    const locations = await Case.distinct('case_metadata.location');

    const formData = {
      specialties: filteredSpecialties,
      modules,
      programAreas: programAreas.filter(p => p),
      difficulties: difficulties.filter(d => d),
      locations: locations.filter(l => l),
      genders: ['Male', 'Female', 'Other'],
      emotionalTones: [
        'Anxious and worried', 'Calm but concerned', 'Frustrated and impatient',
        'Scared and vulnerable', 'Hopeful but uncertain', 'Tired and exhausted',
        'Confused and overwhelmed'
      ]
    };
    res.json(formData);
  } catch (error) {
    console.error('Error fetching form data:', error);
    res.status(500).json({ error: 'Failed to fetch form data' });
  }
});

export default router;
