/**
 * Run this script to drop all cases and re-seed with updated sample data.
 * Usage: node scripts/reseed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Case = require('../models/Case');
const sampleCases = require('./sampleCases');

async function reseed() {
  await connectDB();

  // Drop all existing cases
  await Case.deleteMany({});
  console.log('🗑️  Dropped all existing cases');

  // Insert fresh sample cases
  await Case.insertMany(sampleCases);
  console.log(`✅ Seeded ${sampleCases.length} updated sample cases`);

  await mongoose.disconnect();
  console.log('✅ Done');
  process.exit(0);
}

reseed().catch(err => {
  console.error('❌', err);
  process.exit(1);
});
