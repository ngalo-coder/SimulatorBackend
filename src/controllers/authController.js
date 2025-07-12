import User from '../models/UserModel.js';
import { generateToken } from '../services/authService.js';
import mongoose from 'mongoose';
import logger from '../config/logger.js'; // Import logger

/**
 * Handles user registration.
 */
export async function register(req, res) {
  const { username, email, password } = req.body;
  const log = req.log; // Get logger from request

  if (!username || !email || !password) {
    log.warn({ body: req.body }, 'Registration attempt with missing fields.');
    return res.status(400).json({ message: 'Please provide username, email, and password.' });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      log.info({ username, email }, 'Registration failed: User already exists.');
      return res.status(409).json({ message: 'User already exists with this username or email.' });
    }

    const newUser = new User({ username, email, password });
    await newUser.save();
    log.info({ userId: newUser._id, username }, 'User registered successfully.');

    const token = generateToken(newUser._id, newUser.username, newUser.role);

    res.status(201).json({
      message: 'User registered successfully.',
      data: {
        token,
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
        },
      }
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(error.errors).map(val => val.message);
      log.error({ errors: messages, body: req.body }, 'Registration validation failed.');
      return res.status(400).json({ message: 'Validation failed.', errors: messages });
    }
    log.error(error, 'Server error during registration.');
    res.status(500).json({ message: 'Server error during registration.' });
  }
}

/**
 * Handles user login.
 */
export async function login(req, res) {
  const { email, password } = req.body;
  const log = req.log;

  if (!email || !password) {
    log.warn({ body: req.body }, 'Login attempt with missing fields.');
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      log.warn({ email }, 'Login failed: User not found.');
      return res.status(401).json({ message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      log.warn({ email }, 'Login failed: Password incorrect.');
      return res.status(401).json({ message: 'Invalid credentials. Password incorrect.' });
    }

    log.info({ userId: user._id, email }, 'User logged in successfully.');
    const token = generateToken(user._id, user.username, user.role);

    res.status(200).json({
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      }
    });
  } catch (error) {
    log.error(error, 'Server error during login.');
    res.status(500).json({ message: 'Server error during login.' });
  }
}
