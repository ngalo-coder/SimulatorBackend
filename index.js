import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import logger from './src/config/logger.js';
import simulationRoutes from './src/routes/simulationRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import queueRoutes from './src/routes/queueRoutes.js';
import clinicianProgressRoutes from './src/routes/clinicianProgressRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import adminProgramRoutes from './src/routes/adminProgramRoutes.js';
import contributeCaseRoutes from './src/routes/contributeCaseRoutes.js';
import performanceRoutes from './src/routes/performanceRoutes.js';
import connectDB from './src/config/db.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Centralized Logging ---
app.use(pinoHttp({ logger }));
// --- End Centralized Logging ---

// --- CORS Configuration ---
const allowedOrigins = [
  'https://kuiga.online', // Your production frontend
  'https://simuatech.netlify.app', // Netlify deployment
  'http://localhost:3000', // Your local development frontend (if applicable)
  'http://localhost:5173', // Another common local dev port (Vite)
  'http://localhost:5174', // Additional Vite dev port
  'http://localhost:5002', // Backend server port (for same-origin requests)
  'http://localhost:5003', // Backend server port (for same-origin requests)
  // Add any other origins you need to allow
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          'The CORS policy for this site does not allow access from the specified Origin.';
        logger.error(`CORS Error: Origin ${origin} not allowed. Allowed origins: ${allowedOrigins.join(', ')}`); // Use logger
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true, // Important if your frontend sends cookies or Authorization headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Timestamp', 'X-Client-Version'], // Ensure 'Authorization' is included if you use tokens
    exposedHeaders: ['X-Request-ID'], // Allow frontend to access these headers
    preflightContinue: false,
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
  })
);
// --- End CORS Configuration ---

// Debug middleware to log all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
  next();
});

app.use(express.json());

// Add redirect for incorrect auth path
app.use('/auth/login', (req, res) => {
  res.redirect(307, '/api/auth/login');
});

// Mount Routers - WITHOUT Redis cache
app.use('/api/auth', authRoutes);
app.use('/api/users', queueRoutes);
app.use('/api/simulation', simulationRoutes); // Removed Redis cache
app.use('/api/progress', clinicianProgressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminProgramRoutes);
app.use('/api/contribute', contributeCaseRoutes);
app.use('/api/performance', performanceRoutes);

app.get('/', (req, res) => {
  res.send('Virtual Patient Simulation API is running!');
});

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});