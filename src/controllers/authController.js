import User from '../models/UserModel.js';
import { generateToken } from '../services/authService.js'; // Corrected import statement
import mongoose from 'mongoose';

/**
 * Handles user registration.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export async function register(req, res) {
  const { username, email, password } = req.body;

  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please provide username, email, and password.' });
  }

  try {
    // Check if user already exists (by username or email)
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with this username or email.' });
    }

    // Create new user (password will be hashed by the pre-save hook in UserModel)
    const newUser = new User({ username, email, password });
    await newUser.save();

    // Generate JWT
    const token = generateToken(newUser._id, newUser.username);

    res.status(201).json({
      message: 'User registered successfully.',
      data: { // Nest token and user under 'data'
        token,
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
        },
      }
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      // Extract validation messages
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: 'Validation failed.', errors: messages });
    }
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
}

/**
 * Handles user login.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export async function login(req, res) {
  const { email, password } = req.body; // Using email to login, can be username too

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. User not found.' });
    }

    // Compare password (using the method defined in UserModel)
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials. Password incorrect.' });
    }

    // Generate JWT
    const token = generateToken(user._id, user.username);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
}
