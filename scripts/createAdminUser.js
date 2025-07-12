import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/UserModel.js';
import connectDB from '../src/config/db.js';
import logger from '../src/config/logger.js';

dotenv.config();

// Connect to MongoDB
connectDB();

// Admin user details
const adminUser = {
  username: 'admin',
  email: 'admin@example.com',
  password: 'admin123', // This should be changed after first login
  role: 'admin'
};

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { username: adminUser.username },
        { email: adminUser.email }
      ] 
    });

    if (existingUser) {
      logger.info(`Admin user already exists with username: ${existingUser.username} and email: ${existingUser.email}`);
      
      // Update role to admin if not already
      if (existingUser.role !== 'admin') {
        existingUser.role = 'admin';
        await existingUser.save();
        logger.info(`Updated user ${existingUser.username} to admin role`);
      }
    } else {
      // Create new admin user
      const newAdmin = new User(adminUser);
      await newAdmin.save();
      logger.info(`Created new admin user with username: ${newAdmin.username} and email: ${newAdmin.email}`);
    }

    logger.info('Admin user setup complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the function
createAdminUser();