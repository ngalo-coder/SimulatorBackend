import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import simulationRoutes from './src/routes/simulationRoutes.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.use('/api/simulation', simulationRoutes);

app.get('/', (req, res) => {
    res.send('Virtual Patient Simulation API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});