import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Session from '../models/SessionModel.js';
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
 * Get all users for admin dashboard
 */
export async function getAllUsers(req, res) {
  const log = req.log || logger;

  try {
    const users = await User.find({}).select('-password');
    
    // Transform the data to match the frontend's expected format
    const formattedUsers = users.map(user => ({
      id: user._id.toString(),
      name: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin || user.createdAt, // Use createdAt as fallback if lastLogin doesn't exist
      casesCompleted: 0 // Default value, will be updated with actual data in a future implementation
    }));
    
    log.info({ count: users.length }, 'Retrieved all users for admin dashboard');
    
    res.status(200).json(formattedUsers); // Return the array directly as expected by the frontend
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
 * Get all program areas from cases
 */
export async function getProgramAreas(req, res) {
  const log = req.log || logger;

  try {
    // Use distinct to get unique program areas
    const programAreas = await Case.distinct('case_metadata.program_area');
    log.info({ count: programAreas.length }, 'Retrieved all program areas');
    
    res.status(200).json({
      message: 'Program areas retrieved successfully.',
      programAreas
    });
  } catch (error) {
    log.error(error, 'Server error while retrieving program areas.');
    res.status(500).json({ message: 'Server error while retrieving program areas.' });
  }
}

/**
 * Get all specialties from cases
 */
export async function getSpecialties(req, res) {
  const log = req.log || logger;

  try {
    // Use distinct to get unique specialties
    const specialties = await Case.distinct('case_metadata.specialty');
    log.info({ count: specialties.length }, 'Retrieved all specialties');
    
    res.status(200).json({
      message: 'Specialties retrieved successfully.',
      specialties
    });
  } catch (error) {
    log.error(error, 'Server error while retrieving specialties.');
    res.status(500).json({ message: 'Server error while retrieving specialties.' });
  }
}

/**
 * Get all cases for admin dashboard
 */
export async function getAllCases(req, res) {
  const log = req.log || logger;

  try {
    // Project only the fields needed for the admin dashboard
    const cases = await Case.find({}, {
      'case_metadata.case_id': 1,
      'case_metadata.title': 1,
      'case_metadata.specialty': 1,
      'case_metadata.program_area': 1,
      'case_metadata.difficulty': 1,
      'createdAt': 1
    });

    // Transform the data to match the frontend's expected format
    const formattedCases = cases.map(caseItem => ({
      id: caseItem.case_metadata.case_id,
      title: caseItem.case_metadata.title,
      programArea: caseItem.case_metadata.program_area,
      specialty: caseItem.case_metadata.specialty,
      difficulty: caseItem.case_metadata.difficulty,
      createdAt: caseItem.createdAt,
      // Default values for fields that might not be in the database yet
      timesCompleted: 0,
      averageScore: 0
    }));

    log.info({ count: cases.length }, 'Retrieved all cases for admin');
    
    res.status(200).json({
      message: 'Cases retrieved successfully.',
      data: formattedCases
    });
  } catch (error) {
    log.error(error, 'Server error while retrieving cases.');
    res.status(500).json({ message: 'Server error while retrieving cases.' });
  }
}

/**
 * Update a case
 */
export async function updateCase(req, res) {
  const { caseId } = req.params;
  const { programArea, specialty } = req.body;
  const log = req.log || logger;

  try {
    // Find the case by case_id
    const caseToUpdate = await Case.findOne({ 'case_metadata.case_id': caseId });
    
    if (!caseToUpdate) {
      log.warn({ caseId }, 'Case not found for update.');
      return res.status(404).json({ message: 'Case not found.' });
    }

    // Update the case metadata
    if (programArea) {
      caseToUpdate.case_metadata.program_area = programArea;
    }
    
    if (specialty) {
      caseToUpdate.case_metadata.specialty = specialty;
    }

    await caseToUpdate.save();
    log.info({ caseId, programArea, specialty }, 'Case updated successfully.');

    res.status(200).json({
      message: 'Case updated successfully.',
      data: {
        id: caseToUpdate.case_metadata.case_id,
        title: caseToUpdate.case_metadata.title,
        programArea: caseToUpdate.case_metadata.program_area,
        specialty: caseToUpdate.case_metadata.specialty,
        difficulty: caseToUpdate.case_metadata.difficulty
      }
    });
  } catch (error) {
    log.error(error, 'Server error during case update.');
    res.status(500).json({ message: 'Server error during case update.' });
  }
}

/**
 * Delete a case
 */
export async function deleteCase(req, res) {
  const { caseId } = req.params;
  const log = req.log || logger;

  try {
    const result = await Case.findOneAndDelete({ 'case_metadata.case_id': caseId });
    
    if (!result) {
      log.warn({ caseId }, 'Case not found for deletion.');
      return res.status(404).json({ message: 'Case not found.' });
    }

    log.info({ caseId }, 'Case deleted successfully.');

    res.status(200).json({
      message: 'Case deleted successfully.'
    });
  } catch (error) {
    log.error(error, 'Server error during case deletion.');
    res.status(500).json({ message: 'Server error during case deletion.' });
  }
}

/**
 * Get all users with their performance scores
 */
export async function getUsersWithScores(req, res) {
  const log = req.log || logger;

  try {
    // Get all users
    const users = await User.find({}).select('-password');
    
    // Get performance metrics aggregated by user
    const performanceMetrics = await PerformanceMetrics.aggregate([
      { $match: { user_ref: { $exists: true } } },
      { 
        $group: {
          _id: '$user_ref',
          averageScore: { $avg: '$metrics.overall_score' },
          casesCompleted: { $sum: 1 }
        }
      }
    ]);
    
    // Create a map of user IDs to their performance metrics
    const userMetricsMap = new Map();
    performanceMetrics.forEach(metric => {
      userMetricsMap.set(metric._id.toString(), {
        averageScore: Math.round(metric.averageScore || 0),
        casesCompleted: metric.casesCompleted || 0
      });
    });
    
    // Combine user data with their performance metrics
    const usersWithScores = users.map(user => {
      const userId = user._id.toString();
      const metrics = userMetricsMap.get(userId) || { averageScore: 0, casesCompleted: 0 };
      
      return {
        id: userId,
        name: user.username,
        email: user.email,
        role: user.role,
        averageScore: metrics.averageScore,
        casesCompleted: metrics.casesCompleted,
        createdAt: user.createdAt
      };
    });
    
    log.info({ count: usersWithScores.length }, 'Retrieved all users with scores');
    
    res.status(200).json(usersWithScores);
  } catch (error) {
    log.error(error, 'Server error while retrieving users with scores.');
    res.status(500).json({ message: 'Server error while retrieving users with scores.' });
  }
}
/**
 * Get system statistics for admin dashboard
 */
export async function getSystemStats(req, res) {
  const log = req.log || logger;

  try {
    // Get total users count
    const totalUsers = await User.countDocuments();
    
    // Get users by role
    const adminCount = await User.countDocuments({ role: 'admin' });
    const userCount = totalUsers - adminCount;
    
    // Get total cases count
    const totalCases = await Case.countDocuments();
    
    // Get cases by difficulty
    const beginnerCases = await Case.countDocuments({ 'case_metadata.difficulty': 'Easy' });
    const intermediateCases = await Case.countDocuments({ 'case_metadata.difficulty': 'Intermediate' });
    const advancedCases = await Case.countDocuments({ 'case_metadata.difficulty': 'Hard' });
    
    // Get cases by program area
    const programAreaCounts = {};
    const programAreas = await Case.distinct('case_metadata.program_area');
    
    for (const area of programAreas) {
      const count = await Case.countDocuments({ 'case_metadata.program_area': area });
      programAreaCounts[area] = count;
    }
    
    // Get total sessions count
    const totalSessions = await Session.countDocuments();
    
    // Get active sessions count (sessions that haven't ended)
    const activeSessions = await Session.countDocuments({ sessionEnded: false });
    
    // Compile all stats
    const systemStats = {
      totalUsers,
      totalCases,
      totalSessions,
      activeSessions,
      casesByDifficulty: {
        Beginner: beginnerCases,
        Intermediate: intermediateCases,
        Advanced: advancedCases
      },
      casesByProgramArea: programAreaCounts,
      usersByRole: {
        Admin: adminCount,
        Clinician: userCount,
        Instructor: 0 // Default value, update if you have an instructor role
      }
    };
    
    log.info('Retrieved system statistics for admin dashboard');
    
    res.status(200).json(systemStats);
  } catch (error) {
    log.error(error, 'Server error while retrieving system statistics.');
    res.status(500).json({ message: 'Server error while retrieving system statistics.' });
  }
}