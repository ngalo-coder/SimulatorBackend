import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import logger from './src/config/logger.js';
import simulationRoutes from './src/routes/simulationRoutes.js';
import authRoutes from './src/routes/authRoutes.js'; // Import auth routes
import queueRoutes from './src/routes/queueRoutes.js'; // Import queue routes
import clinicianProgressRoutes from './src/routes/clinicianProgressRoutes.js'; // Import clinician progress routes
import adminRoutes from './src/routes/adminRoutes.js'; // Import admin routes
import adminProgramRoutes from './src/routes/adminProgramRoutes.js'; // Import admin program routes
import contributeCaseRoutes from './src/routes/contributeCaseRoutes.js'; // Import contribute case routes
import performanceRoutes from './src/routes/performanceRoutes.js'; // Import performance routes
import connectDB from './src/config/db.js'; // Import connectDB

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT;

// --- Centralized Logging ---
app.use(pinoHttp({ logger }));
// --- End Centralized Logging ---

// --- CORS Configuration ---
const allowedOrigins = [
  'https://kuiga.online', // Your production frontend
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
        logger.error(`CORS Error: Origin ${origin} not allowed.`); // Use logger
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true, // Important if your frontend sends cookies or Authorization headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'], // Ensure 'Authorization' is included if you use tokens
  })
);
// --- End CORS Configuration ---

app.use(express.json());

// Add redirect for incorrect auth path
app.use('/auth/login', (req, res) => {
  res.redirect(307, '/api/auth/login');
});

import { redisCache } from './src/config/redis.js';

// Mount Routers
app.use('/api/auth', authRoutes);
app.use('/api/users', queueRoutes); // Mount queue routes under /api/users
app.use('/api/simulation', redisCache.route(), simulationRoutes);
app.use('/api/progress', clinicianProgressRoutes); // Mount clinician progress routes
app.use('/api/admin', adminRoutes); // Mount admin routes
app.use('/api/admin', adminProgramRoutes); // Mount admin program routes
app.use('/api/contribute', contributeCaseRoutes); // Mount contribute case routes
app.use('/api/performance', performanceRoutes); // Mount performance routes

app.get('/', (req, res) => {
  res.send('Virtual Patient Simulation API is running!');
});

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
