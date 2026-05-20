// CORS configuration
const allowedOrigins = [
  'https://kuiga.online',
  'https://simuatech.netlify.app',
  'https://simulatorbackend.onrender.com', // Explicitly add the backend domain
  'https://simulator-olx4.onrender.com', // Current production backend
  'https://preview-virtual-patient-api-kzmoqedp61tnz9rz9idx.vusercontent.net',
  'https://simulator-l9qx.onrender.com',
  // Additional frontend origins
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  // Railway domains
  /^https:\/\/.*\.up\.railway\.app$/,
  // Render domains
  /^https:\/\/.*\.onrender\.com$/,
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5001',
  'http://localhost:5001',
  'http://localhost:5173',
  'http://localhost:5174',
  /^https:\/\/.*-.*\.vercel\.app$/, // All Vercel preview and production deployments
  // Additional origins from environment
  ...(process.env.ADDITIONAL_ORIGINS?.split(',').filter(Boolean) || [])
];

export const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin matches any allowed origins (including regex patterns)
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS policy violation for origin: ${origin}`);
      callback(new Error('CORS policy violation'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Timestamp', 'X-Client-Version'],
  exposedHeaders: ['X-Request-ID'],
  optionsSuccessStatus: 200
};

export default corsOptions;