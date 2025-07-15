import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import mongoose from 'mongoose';
import logger from '../config/logger.js';

/**
 * Create a new admin user
 */
export async function createAdmin(req, res) {
  const { username, email, password } = req.body;
  const log = req.log || logger;

  if (!username || !email || !password) {
    log.warn({ body: req.body }, 'Admin creation attempt with missing fields.');
    return res.status(400).json({ message: 'Please provide username, email, and password.' });
  }

  try {
    // Check if the user making the request is an admin
    if (req.user.role !== 'admin') {
      log.warn({ userId: req.user.id }, 'Non-admin user attempted to create admin account');
      return res.status(403).json({ message: 'Access denied. Only admins can create admin accounts.' });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      log.info({ username, email }, 'Admin creation failed: User already exists.');
      return res.status(409).json({ message: 'User already exists with this username or email.' });
    }

    const newAdmin = new User({ 
      username, 
      email, 
      password,
      role: 'admin' 
    });
    
    await newAdmin.save();
    log.info({ userId: newAdmin._id, username }, 'Admin user created successfully.');

    res.status(201).json({
      message: 'Admin user created successfully.',
      data: {
        user: {
          id: newAdmin._id,
          username: newAdmin.username,
          email: newAdmin.email,
          role: newAdmin.role,
        },
      }
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(error.errors).map(val => val.message);
      log.error({ errors: messages, body: req.body }, 'Admin creation validation failed.');
      return res.status(400).json({ message: 'Validation failed.', errors: messages });
    }
    log.error(error, 'Server error during admin creation.');
    res.status(500).json({ message: 'Server error during admin creation.' });
  }
}

/**
 * Get all users
 */
export async function getAllUsers(req, res) {
  const log = req.log || logger;

  try {
    const users = await User.find({}).select('-password');
    log.info({ count: users.length }, 'Retrieved all users');
    
    res.status(200).json({
      message: 'Users retrieved successfully.',
      data: users
    });
  } catch (error) {
    log.error(error, 'Server error while retrieving users.');
    res.status(500).json({ message: 'Server error while retrieving users.' });
  }
}

/**
 * Update a user's role
 */
export async function updateUserRole(req, res) {
  const { userId } = req.params;
  const { role } = req.body;
  const log = req.log || logger;

  if (!role || !['user', 'admin'].includes(role)) {
    log.warn({ body: req.body }, 'Invalid role provided for user update.');
    return res.status(400).json({ message: 'Please provide a valid role (user or admin).' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      log.warn({ userId }, 'User not found for role update.');
      return res.status(404).json({ message: 'User not found.' });
    }

    user.role = role;
    await user.save();
    log.info({ userId, role }, 'User role updated successfully.');

    res.status(200).json({
      message: 'User role updated successfully.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      }
    });
  } catch (error) {
    log.error(error, 'Server error during user role update.');
    res.status(500).json({ message: 'Server error during user role update.' });
  }
}

/**
 * Delete a user
 */
export async function deleteUser(req, res) {
  const { userId } = req.params;
  const log = req.log || logger;

  try {
    const user = await User.findById(userId);
    if (!user) {
      log.warn({ userId }, 'User not found for deletion.');
      return res.status(404).json({ message: 'User not found.' });
    }

    await User.findByIdAndDelete(userId);
    log.info({ userId }, 'User deleted successfully.');

    res.status(200).json({
      message: 'User deleted successfully.'
    });
  } catch (error) {
    log.error(error, 'Server error during user deletion.');
    res.status(500).json({ message: 'Server error during user deletion.' });
  }
}

/**
 * Update a case
 */
export async function updateCase(req, res) {
  const { caseId } = req.params;
  const { program_area, specialty } = req.body;
  const log = req.log || logger;

  if (!program_area && !specialty) {
    log.warn({ body: req.body }, 'No fields to update provided for case update.');
    return res.status(400).json({ message: 'Please provide at least one field to update (program_area or specialty).' });
  }

  try {
    const caseToUpdate = await Case.findOne({ 'case_metadata.case_id': caseId });
    if (!caseToUpdate) {
      log.warn({ caseId }, 'Case not found for update.');
      return res.status(404).json({ message: 'Case not found.' });
    }

    if (program_area) {
      caseToUpdate.case_metadata.program_area = program_area;
    }
    if (specialty) {
      caseToUpdate.case_metadata.specialty = specialty;
    }

    await caseToUpdate.save();
    log.info({ caseId }, 'Case updated successfully.');

    res.status(200).json({
      message: 'Case updated successfully.',
      data: caseToUpdate,
    });
  } catch (error) {
    log.error(error, 'Server error during case update.');
    res.status(500).json({ message: 'Server error during case update.' });
  }
}