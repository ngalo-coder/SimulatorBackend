const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectDB = async () => {
  try {
    // Check for a valid MONGODB_URI (skip placeholder/default URIs)
    const uri = process.env.MONGODB_URI;
    const hasValidUri = uri && uri !== ''
      && !uri.includes('your_') 
      && !uri.includes('localhost')
      && !uri.includes('127.0.0.1')
      ;

    if (hasValidUri) {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ MongoDB connected (external)');
        return;
      } catch (externalErr) {
        console.warn('⚠️ External MongoDB unreachable, falling back to in-memory...');
        console.warn(`   ${externalErr.message}`);
      }
    }

    // Fall back to in-memory MongoDB
    if (!mongoServer) {
      mongoServer = await MongoMemoryServer.create();
    }
    const memUri = mongoServer.getUri();
    await mongoose.connect(memUri);
    console.log('✅ MongoDB connected (in-memory)');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  process.exit(0);
});

module.exports = connectDB;
