import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import simulationRoutes from './src/routes/simulationRoutes.js';
import authRoutes from './src/routes/authRoutes.js'; // Import auth routes
import queueRoutes from './src/routes/queueRoutes.js'; // Import queue routes
import connectDB from './src/config/db.js'; // Import connectDB

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Mount Routers
app.use('/api/auth', authRoutes);
app.use('/api/users', queueRoutes); // Mount queue routes under /api/users
app.use('/api/simulation', simulationRoutes);

app.get('/', (req, res) => {
    res.send('Virtual Patient Simulation API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});