import User from '../models/UserModel.js';
import { generateToken } from '../services/authService.js';
import mongoose from 'mongoose';
import logger from '../config/logger.js'; // Import logger
import crypto from 'crypto';
import sendEmail from '../services/emailService.js';

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

    const redirectTo = user.role === 'admin' ? '/admin/dashboard' : '/';

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
        redirectTo,
      }
    });
  } catch (error) {
    log.error(error, 'Server error during login.');
    res.status(500).json({ message: 'Server error during login.' });
  }
}

export async function forgotPassword(req, res) {
  const { email } = req.body;
  const log = req.log;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      log.warn({ email }, 'Password reset failed: User not found.');
      return res.status(404).json({ message: 'User not found.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/auth/reset-password/${resetToken}`;

    const message = `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Your password reset token (valid for 10 min)',
        message,
      });

      res.status(200).json({
        status: 'success',
        message: 'Token sent to email!',
      });
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      log.error(err, 'Error sending password reset email.');
      return res.status(500).json({ message: 'There was an error sending the email. Try again later!' });
    }
  } catch (error) {
    log.error(error, 'Server error during forgot password.');
    res.status(500).json({ message: 'Server error during forgot password.' });
  }
}

export async function resetPassword(req, res) {
  const log = req.log;
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      log.warn('Password reset failed: Token is invalid or has expired.');
      return res.status(400).json({ message: 'Token is invalid or has expired.' });
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const token = generateToken(user._id, user.username, user.role);

    res.status(200).json({
      message: 'Password reset successful.',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    log.error(error, 'Server error during password reset.');
    res.status(500).json({ message: 'Server error during password reset.' });
  }
}
