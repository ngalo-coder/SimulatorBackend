import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from '../src/models/CaseModel.js';
import logger from '../src/config/logger.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Delete all cases
const deleteAllCases = async () => {
  try {
    // Get count before deletion
    const countBefore = await Case.countDocuments();
    logger.info(`Found ${countBefore} cases in the database`);

    // Delete all cases
    const result = await Case.deleteMany({});
    
    logger.info(`Successfully deleted ${result.deletedCount} cases from the database`);
    return result.deletedCount;
  } catch (error) {
    logger.error(`Error deleting cases: ${error.message}`);
    throw error;
  }
};

// Main function
const main = async () => {
  let connection;
  try {
    connection = await connectDB();
    
    // Confirm with user
    console.log('WARNING: This will delete ALL cases from the database.');
    console.log('This action cannot be undone.');
    console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...');
    
    // Wait for 5 seconds to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const deletedCount = await deleteAllCases();
    console.log(`Successfully deleted ${deletedCount} cases from the database.`);
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Close the connection
    if (connection) {
      await mongoose.disconnect();
      logger.info('MongoDB connection closed');
    }
    process.exit(0);
  }
};

// Run the script
main();