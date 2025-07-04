import fs from 'fs/promises'; // Using promises version of fs for async/await
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from '../src/models/CaseModel.js'; // Adjust path as necessary
// Assuming db.js exports the connectDB function and handles the connection internally
// If not, we might need to duplicate minimal connection logic here or import connectDB
// For this script, a direct connection is often simpler if connectDB is tied to app startup.

dotenv.config({ path: path.resolve(process.cwd(), '.env') }); // Ensure .env is loaded from project root

const connectToDBForScript = async () => {
  if (mongoose.connection.readyState >= 1) {
    return; // Already connected
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for script...');
  } catch (error) {
    console.error('MongoDB connection error for script:', error.message);
    process.exit(1);
  }
};

const migrateCases = async () => {
  try {
    await connectToDBForScript();

    const casesDir = path.join(process.cwd(), 'cases'); // Assuming 'cases' is in project root
    const files = await fs.readdir(casesDir);

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(casesDir, file);
        try {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const caseData = JSON.parse(fileContent);

          // Basic validation/transformation if needed.
          // For now, assuming the JSON structure directly matches the CaseModel schema.
          // The schema itself will perform validation based on its definition.

          if (!caseData.case_metadata || !caseData.case_metadata.case_id) {
            console.error(`Skipping file ${file}: Missing case_metadata.case_id.`);
            errorCount++;
            continue;
          }

          // Ensure evaluation_criteria is a Map as expected by the schema if it's an object
          if (caseData.evaluation_criteria && typeof caseData.evaluation_criteria === 'object' && !(caseData.evaluation_criteria instanceof Map)) {
            caseData.evaluation_criteria = new Map(Object.entries(caseData.evaluation_criteria));
          }


          const result = await Case.findOneAndUpdate(
            { 'case_metadata.case_id': caseData.case_metadata.case_id },
            caseData,
            { upsert: true, new: true, runValidators: true }
          );
          console.log(`Successfully upserted case: ${result.case_metadata.title} (ID: ${result.case_metadata.case_id})`);
          successCount++;
        } catch (err) {
          console.error(`Error processing file ${file}:`, err.message);
          if (err.errors) { // Mongoose validation errors
            for (const field in err.errors) {
              console.error(`  - Validation Error (${field}): ${err.errors[field].message}`);
            }
          }
          errorCount++;
        }
      }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Successfully upserted cases: ${successCount}`);
    console.log(`Failed cases/errors: ${errorCount}`);

  } catch (error) {
    console.error('Migration script failed:', error);
  } finally {
    // Only close connection if this script initiated it and it's not part of a larger app context
    if (mongoose.connection.readyState >= 1) {
        await mongoose.disconnect();
        console.log('MongoDB disconnected for script.');
    }
  }
};

migrateCases();
