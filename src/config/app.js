import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import logger from './logger.js';
import corsOptions from './corsConfig.js';
import { globalErrorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { swaggerSpec, swaggerUi, swaggerUiOptions } from './swagger.js';

// RESOURCE-CENTRIC ROUTES
import authRoutes from '../routes/auth.routes.js';
import usersRoutes from '../routes/users.routes.js';
import casesRoutes from '../routes/cases.routes.js';
import analyticsRoutes from '../routes/analytics.routes.js';
import progressRoutes from '../routes/progress.routes.js';
import dashboardRoutes from '../routes/dashboard.routes.js';
import simulationsRoutes from '../routes/simulations.routes.js';

export function createApp() {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use((req, _res, next) => {
    logger.debug(req.method + ' ' + req.path + ' - Origin: ' + (req.get('Origin') || 'none'));
    next();
  });

  // Disable caching for API endpoints that return dynamic data
  app.use('/api/', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

  return app;
}

export function setupRoutes(app) {
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

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/cases', casesRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/simulations', simulationsRoutes);

  app.use('/auth/login', (_req, res) => res.redirect(307, '/api/auth/login'));

  // Specialty visibility & program area counts
  app.get('/api/admin/specialties/visibility-public', async (req, res) => {
    try {
      const Specialty = (await import('../models/SpecialtyModel.js')).default;
      const specialties = await Specialty.find({ active: true }).lean();
      const result = [];
      for (const s of specialties) {
        const isVisible = s.isVisible !== false;
        let programAreas;
        if (s.programArea === 'all') {
          programAreas = ['Basic Program', 'Specialty Program'];
        } else if (s.programArea === 'basic') {
          programAreas = ['Basic Program'];
        } else if (s.programArea === 'specialty') {
          programAreas = ['Specialty Program'];
        } else {
          programAreas = [s.programArea];
        }
        result.push({
          specialtyId: s.name,
          isVisible,
          programAreas,
          programArea: programAreas[0], // backward compatibility for admin
          lastModified: s.lastModified || s.updatedAt
        });
      }
      res.json({ success: true, data: { specialties: result } });
    } catch (error) {
      logger.error(error, 'Error fetching specialty visibility');
      res.status(500).json({ success: false, message: 'Failed to fetch specialty visibility' });
    }
  });

  app.get('/api/admin/programs/program-areas/counts-public', async (req, res) => {
    try {
      const Case = (await import('../models/CaseModel.js')).default;
      const Specialty = (await import('../models/SpecialtyModel.js')).default;
      const programAreaNames = await Case.distinct('case_metadata.program_area');
      const programAreasWithCounts = await Promise.all(
        programAreaNames.filter(n => n && n.trim() !== '').map(async (name) => {
          const count = await Case.countDocuments({ 'case_metadata.program_area': name });
          return { name, casesCount: count };
        })
      );
      const specialtyProgramAreas = await Specialty.distinct('programArea');
      for (const area of specialtyProgramAreas) {
        if (area === 'all') {
          if (!programAreasWithCounts.find(pa => pa.name === 'Basic Program')) {
            programAreasWithCounts.push({ name: 'Basic Program', casesCount: 0 });
          }
          if (!programAreasWithCounts.find(pa => pa.name === 'Specialty Program')) {
            programAreasWithCounts.push({ name: 'Specialty Program', casesCount: 0 });
          }
        } else {
          const normalized = area === 'basic' ? 'Basic Program' : area === 'specialty' ? 'Specialty Program' : area;
          if (!programAreasWithCounts.find(pa => pa.name === normalized)) {
            programAreasWithCounts.push({ name: normalized, casesCount: 0 });
          }
        }
      }
      res.json({ success: true, data: { programAreas: programAreasWithCounts } });
    } catch (error) {
      logger.error(error, 'Error fetching program areas with counts');
      res.status(500).json({ success: false, message: 'Failed to fetch program areas with counts' });
    }
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

export default { createApp, setupRoutes };

