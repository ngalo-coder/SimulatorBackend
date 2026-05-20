import mongoose from 'mongoose';
import dotenv from 'dotenv';

const connectDB = async () => {
  try {
    // Check if already connected
    // Serverless-optimized connection check
    if (mongoose.connection?.readyState === 1) {
      console.log('Reusing existing MongoDB connection');
      return mongoose.connection;
    }

    // Validate MongoDB URI
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    // Modern MongoDB connection options
    const options = {
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 1,  // Minimum number of connections in the pool
      serverSelectionTimeoutMS: 5000, // How long to try to connect
      socketTimeoutMS: 45000, // How long a send or receive on a socket can take
      maxIdleTimeMS: 30000 // Close connections after 30 seconds of inactivity
    };

    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Don't add process listeners in serverless environments
    if (process.env.NODE_ENV !== 'production') {
      // Graceful shutdown - only for local development
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      });
    }
    
    return conn.connection;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // In production serverless, don't exit process
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      console.error('Failed to connect to database in production, exiting...');
      process.exit(1);
    }
    throw error;
  }
};

export default connectDB;
