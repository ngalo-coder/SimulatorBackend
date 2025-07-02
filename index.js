// index.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const simulationRoutes = require('./src/routes/simulationRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable parsing of JSON request bodies

// API Routes
app.use('/api/simulation', simulationRoutes);

// Health check route
app.get('/', (req, res) => {
    res.send('Virtual Patient Simulation API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});