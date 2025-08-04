import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import logger from './src/config/logger.js';
import corsOptions from './src/config/corsConfig.js';
import connectDB from './src/config/db.js';

// Route imports
import authRoutes from './src/routes/authRoutes.js';
import simulationRoutes from './src/routes/simulationRoutes.js';
import queueRoutes from './src/routes/queueRoutes.js';
import clinicianProgressRoutes from './src/routes/clinicianProgressRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import adminProgramRoutes from './src/routes/adminProgramRoutes.js';
import adminContributionRoutes from './src/routes/adminContributionRoutes.js';
import contributeCaseRoutes from './src/routes/contributeCaseRoutes.js';
import performanceRoutes from './src/routes/performanceRoutes.js';

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5003;

// Middleware
app.use(pinoHttp({ logger }));
app.use(cors(corsOptions));
app.use(express.json());
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
  next();
});

// Legacy redirect
app.use('/auth/login', (_, res) => res.redirect(307, '/api/auth/login'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/users', queueRoutes);
app.use('/api/progress', clinicianProgressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminProgramRoutes);
app.use('/api/admin', adminContributionRoutes);
app.use('/api/contribute', contributeCaseRoutes);
app.use('/api/performance', performanceRoutes);

// Health endpoints
app.get('/', (_, res) => res.send('Virtual Patient Simulation API is running!'));
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    origin: req.get('Origin') || 'none',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
