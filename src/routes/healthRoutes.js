import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Basic health check
router.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };
  
  res.status(200).json(healthCheck);
});

// Detailed health check with dependencies
router.get('/health/detailed', async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    services: {}
  };
  
  // Check MongoDB connection
  try {
    const dbState = mongoose.connection.readyState;
    healthCheck.services.mongodb = {
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      state: dbState,
      message: dbState === 1 ? 'Connected' : 'Disconnected'
    };
  } catch (error) {
    healthCheck.services.mongodb = {
      status: 'unhealthy',
      message: error.message
    };
  }
  
  // Check memory usage
  const memUsage = process.memoryUsage();
  healthCheck.services.memory = {
    status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning', // 500MB threshold
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
  };
  
  // Overall health status
  const allHealthy = Object.values(healthCheck.services).every(
    service => service.status === 'healthy'
  );
  
  const statusCode = allHealthy ? 200 : 503;
  healthCheck.status = allHealthy ? 'healthy' : 'unhealthy';
  
  res.status(statusCode).json(healthCheck);
});

// Readiness check (for load balancers)
router.get('/ready', async (req, res) => {
  try {
    // Check if MongoDB is ready
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ status: 'not ready', reason: 'database not connected' });
    }
    
    // Add other readiness checks here (Redis, external APIs, etc.)
    
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

export default router;