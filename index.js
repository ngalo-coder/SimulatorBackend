import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import logger from './src/config/logger.js';
import simulationRoutes from './src/routes/simulationRoutes.js';
import authRoutes from './src/routes/authRoutes.js'; // Import auth routes
import queueRoutes from './src/routes/queueRoutes.js'; // Import queue routes
import connectDB from './src/config/db.js'; // Import connectDB

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5001;

// --- Centralized Logging ---
app.use(pinoHttp({ logger }));
// --- End Centralized Logging ---

// --- CORS Configuration ---
const allowedOrigins = [
  'https://kuiga.online', // Your production frontend
  'http://localhost:3000', // Your local development frontend (if applicable)
  'http://localhost:5173', // Another common local dev port (Vite)
  // Add any other origins you need to allow
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      logger.error(`CORS Error: Origin ${origin} not allowed.`); // Use logger
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // Important if your frontend sends cookies or Authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Ensure 'Authorization' is included if you use tokens
}));
// --- End CORS Configuration ---

app.use(express.json());

// Mount Routers
app.use('/api/auth', authRoutes);
app.use('/api/users', queueRoutes); // Mount queue routes under /api/users
app.use('/api/simulation', simulationRoutes);

app.get('/', (req, res) => {
    res.send('Virtual Patient Simulation API is running!');
});

app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});