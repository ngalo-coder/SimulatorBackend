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
import { requireAnyRole } from '../middleware/rbacMiddleware.js';
import * as casesController from '../controllers/casesController.js';
import { getCaseCategories } from '../controllers/simulationController.js';

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

export default router;
