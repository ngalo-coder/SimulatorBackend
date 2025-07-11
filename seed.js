// seed.js

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import Case from './src/models/CaseModel.js';
import generateCase from './utils/generateCase.js';

dotenv.config();

// Get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB URI
const MONGO_URI = process.env.MONGODB_URI;

// Output directory for JSON files
const OUTPUT_DIR = path.join(__dirname, 'data', 'cases');

// Number of cases to generate
const CASE_COUNT = 1000;

// Define program areas
const PROGRAM_AREAS = [
  // Basic Program
  { label: 'Internal Medicine', program: 'Basic Program' },
  { label: 'Pediatrics', program: 'Basic Program' },
  { label: 'Reproductive Health', program: 'Basic Program' },
  { label: 'General Surgery', program: 'Basic Program' },

  // Specialty Program
  { label: 'Ophthalmology', program: 'Specialty Program' },
  { label: 'ENT', program: 'Specialty Program' },
  { label: 'Advanced Pediatrics', program: 'Specialty Program' },
  { label: 'Obstetrics and Gynecology', program: 'Specialty Program' },
  { label: 'Anesthesia', program: 'Specialty Program' }
];

const specialtyCount = {};

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing cases
    await Case.deleteMany({});
    console.log('🗑️ Cleared existing cases');

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Seed cases
    for (let i = 1; i <= CASE_COUNT; i++) {
      const programIndex = (i - 1) % PROGRAM_AREAS.length;
      const { label: specialty, program: program_area } = PROGRAM_AREAS[programIndex];

      const caseData = generateCase(i, specialty, program_area);

      // Count specialties
      specialtyCount[specialty] = (specialtyCount[specialty] || 0) + 1;

      // Save to file
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `case_${String(i).padStart(4, '0')}.json`),
        JSON.stringify(caseData, null, 2)
      );

      // Save to MongoDB
      await Case.create(caseData);
      console.log(`📦 Inserted case ${i}: ${caseData.case_metadata.title}`);
    }

    // Summary log
    console.log('\n📊 Specialty Summary:');
    Object.entries(specialtyCount).forEach(([spec, count]) =>
      console.log(` - ${spec}: ${count} cases`)
    );

    console.log(`\n✅ Successfully seeded ${CASE_COUNT} cases.\n`);
    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error during seeding:', err.message);
    process.exit(1);
  }
}

seedDatabase();
