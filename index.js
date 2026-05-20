import dotenv from 'dotenv';
import mongoose from 'mongoose';
import logger from './src/config/logger.js';
import connectDB from './src/config/db.js';
import { createApp, setupRoutes } from './src/config/app.js';

// Load model registrations (ensure schemas are registered before routes)
import './src/models/CompetencyModel.js';
import './src/models/LearningModuleModel.js';

dotenv.config();

const PORT = process.env.PORT || 5001;

/**
 * Initialize database connection
 */
const initializeDatabase = async () => {
  try {
    await connectDB();
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize database');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Start the server
 */
const startServer = async () => {
  try {
    await initializeDatabase();

    const app = createApp();
    await setupRoutes(app);

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();

// Export for serverless platforms
let _app;

export default async function getApp() {
  if (!_app) {
    await initializeDatabase().catch(() => {});
    _app = createApp();
    await setupRoutes(_app);
  }
  return _app;
}
