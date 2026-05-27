import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-simulator';

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'educator', 'admin'], default: 'student' },
  verified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createTestUser() {
  try {
    await mongoose.connect(uri);
    console.log('✓ Connected to MongoDB\n');

    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const testUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: hashedPassword,
      role: 'student',
      verified: true
    };

    const existing = await User.findOne({ email: testUser.email });
    if (existing) {
      console.log('✓ Test user already exists');
      console.log(`  Username: ${existing.username}`);
      console.log(`  Email: ${existing.email}`);
      console.log(`  Role: ${existing.role}`);
    } else {
      const user = await User.create(testUser);
      console.log('✓ Test user created successfully!');
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: password123`);
      console.log(`  Role: ${user.role}`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createTestUser();
