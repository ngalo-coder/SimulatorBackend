/**
 * Users Controller
 * Orchestrates user management, registration, preferences, and profile operations
 */

import User, { UserRole, HealthcareDiscipline } from '../models/UserModel.js';
import userPreferencesService from '../services/UserPreferencesService.js';
import userRegistrationService from '../services/UserRegistrationService.js';
import adminUserManagementService from '../services/AdminUserManagementService.js';

export async function registerUser(req, res) {
  try {
    let registrationData = { ...req.body };
    if (req.body.profile) {
      const { profile, ...otherData } = req.body;
      registrationData = { ...otherData, ...profile };
    }
    const result = await userRegistrationService.registerUser(registrationData);
    res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error);
    if (error.message.includes('already exists') || error.message.includes('required') || error.message.includes('Invalid')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
}

export async function getDisciplines(req, res) {
  try {
    const disciplines = Object.values(HealthcareDiscipline).map(d => ({
      value: d,
      label: d.charAt(0).toUpperCase() + d.slice(1)
    }));
    res.json({ success: true, disciplines });
  } catch (error) {
    console.error('Get disciplines error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load disciplines' });
  }
}

export async function getRoles(req, res) {
  try {
    const roles = Object.values(UserRole).map(r => ({
      value: r,
      label: r.charAt(0).toUpperCase() + r.slice(1)
    }));
    res.json({ success: true, roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load roles' });
  }
}

export async function getRegistrationConfig(req, res) {
  try {
    const config = {
      disciplines: Object.values(HealthcareDiscipline).map(d => ({
        value: d,
        label: d.charAt(0).toUpperCase() + d.slice(1),
        description: getDisciplineDescription(d)
      })),
      roles: Object.values(UserRole).map(r => ({
        value: r,
        label: r.charAt(0).toUpperCase() + r.slice(1),
        description: getRoleDescription(r)
      })),
      competencyLevels: [
        { value: 'novice', label: 'Novice', description: 'Beginning level with limited experience' },
        { value: 'advanced_beginner', label: 'Advanced Beginner', description: 'Some experience with guidance needed' },
        { value: 'competent', label: 'Competent', description: 'Adequate performance with planning' },
        { value: 'proficient', label: 'Proficient', description: 'Efficient performance with experience' },
        { value: 'expert', label: 'Expert', description: 'Intuitive performance with deep understanding' }
      ],
      learningStyles: [
        { value: 'visual', label: 'Visual', description: 'Learn best through images and diagrams' },
        { value: 'auditory', label: 'Auditory', description: 'Learn best through listening and discussion' },
        { value: 'kinesthetic', label: 'Kinesthetic', description: 'Learn best through hands-on activities' },
        { value: 'reading', label: 'Reading/Writing', description: 'Learn best through text and written materials' }
      ],
      difficultyPreferences: [
        { value: 'beginner', label: 'Beginner', description: 'Start with basic concepts' },
        { value: 'intermediate', label: 'Intermediate', description: 'Moderate challenge level' },
        { value: 'advanced', label: 'Advanced', description: 'Complex scenarios and challenges' },
        { value: 'adaptive', label: 'Adaptive', description: 'Automatically adjust based on performance' }
      ]
    };
    res.json({ success: true, config });
  } catch (error) {
    console.error('Get registration config error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load configuration' });
  }
}

export async function getUsers(req, res) {
  try {
    const role = req.user?.role || req.user?.primaryRole;
    const { page = 1, limit = 20, role: filterRole, search, status } = req.query;

    const query = {};
    if (filterRole) query.role = filterRole;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }
    if (status && status !== 'all') {
      query.status = status;
    }

    // Role-based access control
    if (role === 'student') {
      // Students can only see themselves
      query._id = req.user._id;
    } else if (role === 'educator') {
      // Educators see students (plus themselves)
      query.$or = [{ role: 'student' }, { _id: req.user._id }];
    }
    // Admin sees all

    const users = await User.find(query)
      .select('-password -refreshToken -resetPasswordToken -resetPasswordExpires')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load users' });
  }
}

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role || req.user?.primaryRole;

    // Access control: student can only see themselves
    if (userRole === 'student' && req.user._id.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = await User.findById(id).select('-password -refreshToken -resetPasswordToken -resetPasswordExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load user' });
  }
}

export async function updateUserProfile(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role || req.user?.primaryRole;

    // Access control: users can only update themselves
    if (req.user._id.toString() !== id && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = await User.findByIdAndUpdate(id, req.body, { new: true }).select(
      '-password -refreshToken -resetPasswordToken -resetPasswordExpires'
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update user' });
  }
}

export async function getUserPreferences(req, res) {
  try {
    const { userId } = req.params;

    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const preferences = await userPreferencesService.getUserPreferences(userId);
    res.json({ success: true, data: preferences });
  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load preferences' });
  }
}

export async function updateUserPreferences(req, res) {
  try {
    const { userId } = req.params;

    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const preferences = await userPreferencesService.updateUserPreferences(userId, req.body);
    res.json({ success: true, data: preferences });
  } catch (error) {
    console.error('Update user preferences error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update preferences' });
  }
}

export async function importUsersCSV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const result = await adminUserManagementService.importUsersFromCSV(req.file.buffer);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Import users CSV error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to import users' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete user' });
  }
}

// Helper functions
function getDisciplineDescription(discipline) {
  const descriptions = {
    nursing: 'Nursing professionals',
    pharmacy: 'Pharmacy professionals',
    radiology: 'Radiology technicians',
    laboratory: 'Laboratory technicians',
    ophthalmology: 'Ophthalmology specialists'
  };
  return descriptions[discipline] || discipline;
}

function getRoleDescription(role) {
  const descriptions = {
    student: 'Healthcare student or learner',
    educator: 'Educational professional or instructor',
    admin: 'System administrator'
  };
  return descriptions[role] || role;
}
