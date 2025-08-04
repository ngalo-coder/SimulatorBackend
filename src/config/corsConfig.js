// CORS configuration
const allowedOrigins = [
  'https://kuiga.online',
  'https://simuatech.netlify.app',
  'https://preview-virtual-patient-api-kzmoqedp61tnz9rz9idx.vusercontent.net',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5003',
  ...(process.env.ADDITIONAL_ORIGINS?.split(',') || [])
];

export const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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