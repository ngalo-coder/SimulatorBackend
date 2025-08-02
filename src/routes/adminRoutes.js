import express from 'express';
import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Note: Contribution-related endpoints have been moved to adminContributionRoutes.js

// Get system statistics
router.get('/stats', protect, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCases = await Case.countDocuments();
    const totalSessions = await PerformanceMetrics.countDocuments();
    
    // Get user registrations in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsers = await User.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo } 
    });
    
    // Get active users (users who have completed at least one case)
    const activeUsers = await PerformanceMetrics.distinct('user_ref').then(userIds => userIds.length);
    
    // Get cases by specialty
    const casesBySpecialty = await Case.aggregate([
      {
        $group: {
          _id: '$case_metadata.specialty',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSessions = await PerformanceMetrics.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });
    
    res.json({
      totalUsers,
      totalCases,
      totalSessions,
      recentUsers,
      activeUsers,
      recentSessions,
      casesBySpecialty
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system statistics' });
  }
});

// Get all users
router.get('/users', protect, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all cases for admin
router.get('/cases', protect, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, specialty, programArea } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (specialty) {
      query['case_metadata.specialty'] = specialty;
    }
    if (programArea) {
      query['case_metadata.program_area'] = programArea;
    }
    
    const cases = await Case.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Case.countDocuments(query);
    
    res.json({
      cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Delete user
router.delete('/users/:userId', protect, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't allow deleting other admin users
    if (user.role === 'admin' && user._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Cannot delete other admin users' });
    }
    
    // Delete user's performance metrics
    await PerformanceMetrics.deleteMany({ user_ref: userId });
    
    // Delete the user
    await User.findByIdAndDelete(userId);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Delete case
router.delete('/cases/:caseId', protect, isAdmin, async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const case_ = await Case.findById(caseId);
    if (!case_) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Delete related performance metrics
    await PerformanceMetrics.deleteMany({ case_ref: caseId });
    
    // Delete the case
    await Case.findByIdAndDelete(caseId);
    
    res.json({ message: 'Case deleted successfully' });
  } catch (error) {
    console.error('Error deleting case:', error);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

// Create admin user
router.post('/users/admin', protect, isAdmin, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }
    
    // Create new admin user
    const newUser = new User({
      username,
      email,
      password, // Will be hashed by the User model pre-save hook
      role: 'admin'
    });
    
    await newUser.save();
    
    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      message: 'Admin user created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// Update user role
router.put('/users/:userId/role', protect, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't allow changing your own role
    if (user._id.toString() === req.user.id) {
      return res.status(403).json({ error: 'Cannot change your own role' });
    }
    
    user.role = role;
    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.json({
      message: `User role updated to ${role} successfully`,
      user: userResponse
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Update case metadata
router.put('/cases/:caseId', protect, isAdmin, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { programArea, specialty } = req.body;
    
    const case_ = await Case.findById(caseId);
    if (!case_) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Update case metadata
    if (programArea) {
      case_.case_metadata.program_area = programArea;
    }
    if (specialty) {
      case_.case_metadata.specialty = specialty;
    }
    
    await case_.save();
    
    res.json({
      message: 'Case updated successfully',
      case: case_
    });
  } catch (error) {
    console.error('Error updating case:', error);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// Get users with their performance scores
router.get('/users/scores', protect, isAdmin, async (req, res) => {
  try {
    const usersWithScores = await User.aggregate([
      {
        $lookup: {
          from: 'performancemetrics',
          localField: '_id',
          foreignField: 'user_ref',
          as: 'performances'
        }
      },
      {
        $addFields: {
          totalCases: { $size: '$performances' },
          averageScore: {
            $cond: {
              if: { $gt: [{ $size: '$performances' }, 0] },
              then: { $avg: '$performances.metrics.overall_score' },
              else: 0
            }
          },
          excellentCount: {
            $size: {
              $filter: {
                input: '$performances',
                cond: { $eq: ['$$this.metrics.performance_label', 'Excellent'] }
              }
            }
          }
        }
      },
      {
        $project: {
          username: 1,
          email: 1,
          role: 1,
          createdAt: 1,
          totalCases: 1,
          averageScore: { $round: ['$averageScore', 2] },
          excellentCount: 1,
          excellentRate: {
            $cond: {
              if: { $gt: ['$totalCases', 0] },
              then: { $round: [{ $multiply: [{ $divide: ['$excellentCount', '$totalCases'] }, 100] }, 1] },
              else: 0
            }
          }
        }
      },
      { $sort: { averageScore: -1 } }
    ]);
    
    res.json(usersWithScores);
  } catch (error) {
    console.error('Error fetching users with scores:', error);
    res.status(500).json({ error: 'Failed to fetch users with scores' });
  }
});

export default router;