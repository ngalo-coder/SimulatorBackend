require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const caseRoutes = require('./routes/caseRoutes');
const simulationRoutes = require('./routes/simulationRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.use('/api/cases', caseRoutes);
app.use('/api/simulate', simulationRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

// Start server after DB connection is ready
async function start() {
  await connectDB();

  // Auto-seed sample data if using in-memory DB (collection will be empty)
  const Case = require('./models/Case');
  const count = await Case.countDocuments();
  if (count === 0) {
    const sampleCases = require('./scripts/sampleCases');
    await Case.insertMany(sampleCases);
    console.log(`✅ Seeded ${sampleCases.length} sample cases`);
  }

  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

start();
