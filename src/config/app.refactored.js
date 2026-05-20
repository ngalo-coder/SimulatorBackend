/**
 * REFACTORED app.js
 * 
 * This file shows the completed migration with ALL new unified routes
 * replacing the old role-based routes.
 * 
 * To use: Replace src/config/app.js with this file
 * (after frontend has been updated to use new endpoints)
 */

import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import logger from './logger.js';
import corsOptions from './corsConfig.js';
import { globalErrorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { swaggerSpec, swaggerUi, swaggerUiOptions } from './swagger.js';

// ─── UNIFIED RESOURCE-CENTRIC ROUTES ───
import authRoutes from '../routes/auth.routes.js';          // NEW: renamed for consistency
import casesRoutes from '../routes/cases.routes.js';        // NEW: replaces 7+ files
import usersRoutes from '../routes/users.routes.js';        // NEW: replaces 3+ files
import simulationsRoutes from '../routes/simulations.routes.js'; // NEW: cleans up simulationRoutes.js
import analyticsRoutes from '../routes/analytics.routes.js';     // NEW: replaces 3+ files
import progressRoutes from '../routes/progress.routes.js';       // NEW: replaces 4+ files
import dashboardRoutes from '../routes/dashboard.routes.js';     // NEW: replaces 3+ files

export function createApp() {
  const app = express();

  // Global Middleware
  app.use(pinoHttp({ logger }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
    next();
  });

  return app;
}

export function setupRoutes(app) {
  // ============================================
  // Health & Root
  // ============================================
  app.get('/', (_req, res) => {
    res.json({
      message: 'Virtual Patient Simulation API is running!',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', async (req, res) => {
    try {
      const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        origin: req.get('Origin') || 'none',
        environment: process.env.NODE_ENV || 'development',
        database: dbStatus,
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });

  // ============================================
  // UNIFIED API ROUTES (Resource-Centric)
  // ============================================
  app.use('/api/auth', authRoutes);
  app.use('/api/simulations', simulationsRoutes);
  app.use('/api/cases', casesRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/tracking', interactionTrackingRoutes);
  app.use('/api/feedback', feedbackRoutes);

  // Learning modules (next phase consolidation)
  app.use('/api/learning', learningGoalRoutes);
  app.use('/api/learning-paths', learningPathRoutes);
  app.use('/api/competency', competencyAssessmentRoutes);

  // ============================================
  // LEGACY COMPATIBILITY REDIRECTS
  // Remove these after frontend is fully migrated
  // ============================================

  // Cases (moved to /api/cases)
  app.use('/api/contribute', (req, res) => {
    const path = req.url.replace(/^\//, '');
    if (path.startsWith('form-data')) res.redirect(301, '/api/cases/contributions/form-data');
    else if (path.startsWith('draft')) res.redirect(301, '/api/cases/contributions/draft');
    else if (path.startsWith('submit')) res.redirect(301, '/api/cases/contributions/submit');
    else if (path.startsWith('my-cases')) res.redirect(301, '/api/cases/contributions/mine');
    else if (path.startsWith('edit/')) res.redirect(301, '/api/cases/' + path.replace('edit/', ''));
    else if (path.startsWith('update/')) res.redirect(301, '/api/cases/' + path.replace('update/', ''));
    else if (path.startsWith('delete/')) res.redirect(301, '/api/cases/' + path.replace('delete/', ''));
    else res.redirect(301, '/api/cases');
  });
  app.use('/api/case-templates', (req, res) => res.redirect(301, '/api/cases/templates' + req.url));
  app.use('/api/case-workflow', (req, res) => res.redirect(301, '/api/cases/workflow' + req.url));
  app.use('/api/case-publishing', (req, res) => res.redirect(301, '/api/cases/published' + req.url));
  app.use('/api/reviews', (req, res) => res.redirect(301, '/api/cases/reviews' + req.url));
  app.use('/api/admin/contributions', (req, res) => res.redirect(301, '/api/cases/contributions' + req.url));

  // Users (moved to /api/users)
  app.use('/api/admin/users', (req, res) => res.redirect(301, '/api/users' + req.url));
  app.use('/api/privacy', (req, res) => res.redirect(301, '/api/users/' + req.user?._id + '/preferences'));

  // Analytics (moved to /api/analytics)
  app.use('/api/progress-analytics', (req, res) => res.redirect(301, '/api/analytics/progress' + req.url));

  // Progress/Performance (moved to /api/progress)
  app.use('/api/performance', (req, res) => res.redirect(301, '/api/progress' + req.url));
  app.use('/api/performance-review', (req, res) => res.redirect(301, '/api/progress' + req.url));
  app.use('/api/progress', (req, res) => res.redirect(301, '/api/progress' + req.url)); // was clinicianProgressRoutes
  app.use('/api/student/progress', (req, res) => res.redirect(301, '/api/progress' + req.url));

  // Leaderboard (moved to /api/progress/leaderboard)
  app.use('/api/leaderboard', (req, res) => res.redirect(301, '/api/progress/leaderboard' + req.url));

  // Dashboards (moved to /api/dashboard)
  app.use('/api/student', (req, res) => res.redirect(301, '/api/dashboard/student' + req.url));
  app.use('/api/educator', (req, res) => res.redirect(301, '/api/dashboard/educator' + req.url));
  app.use('/api/admin', (req, res) => {
    if (req.url.startsWith('/users')) res.redirect(301, '/api/users' + req.url.replace('/users', ''));
    else if (req.url.startsWith('/analytics')) res.redirect(301, '/api/analytics' + req.url.replace('/analytics', ''));
    else res.redirect(301, '/api/dashboard' + req.url);
  });

  // Simulations (moved to /api/simulations)
  app.use('/api/simulation', (req, res) => res.redirect(301, '/api/simulations' + req.url));

  // Legacy redirect
  app.use('/auth/login', (_req, res) => res.redirect(307, '/api/auth/login'));

  // ============================================
  // Swagger API Documentation
  // ============================================
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // ============================================
  // Error Handling
  // ============================================
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

export default { createApp, setupRoutes };
