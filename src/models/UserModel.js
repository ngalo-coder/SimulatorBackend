import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required.'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-zA-Z0-9]+$/, 'Username can only contain letters and numbers.']
  },
  email: {
    type: String,
    required: [true, 'Email is required.'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address.']
  },
  password: {
    type: String,
    required: [true, 'Password is required.'],
    minlength: [6, 'Password must be at least 6 characters long.']
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Pre-save hook to hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare entered password with hashed password in DB
UserSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);

export default User;
