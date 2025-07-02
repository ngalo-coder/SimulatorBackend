import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import simulationRoutes from './src/routes/simulationRoutes.js';


const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/simulation', simulationRoutes);

// Health check route
app.get('/', (req, res) => {
    res.send('Virtual Patient Simulation API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});