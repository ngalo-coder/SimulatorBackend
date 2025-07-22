import mongoose from 'mongoose';
import ClinicianPerformance from '../src/models/ClinicianPerformanceModel.js';
import 'dotenv/config';

const verifyPerformanceCollection = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected...');

    const userPerformance = await ClinicianPerformance.findOne({ userId: 'otienodominic@gmail.com' });
    console.log('User Performance Record:', userPerformance);

    const evaluationHistory = await ClinicianPerformance.findOne({ userId: 'otienodominic@gmail.com' }, { evaluationHistory: 1, contributorStatus: 1 });
    console.log('Evaluation History:', evaluationHistory);

    await mongoose.disconnect();
    console.log('MongoDB Disconnected.');
  } catch (error) {
    console.error('Error verifying performance collection:', error);
    process.exit(1);
  }
};

verifyPerformanceCollection();
