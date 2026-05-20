/**
 * Unified Users Routes
 * 
 * RESOURCE-CENTRIC: All user-related operations consolidated here.
 * Replaces: userRoutes.js, adminUserRoutes.js, privacyRoutes.js (parts)
 */

import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAnyRole } from '../middleware/rbacMiddleware.js';
import User, { UserRole, HealthcareDiscipline } from '../models/UserModel.js';
import userPreferencesService from '../services/UserPreferencesService.js';
import userRegistrationService from '../services/UserRegistrationService.js';
import adminUserManagementService from '../services/AdminUserManagementService.js';

const router = express.Router();

// Configure multer for file uploads (admin CSV import)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// ──────────────────────────────────────────────
// REGISTRATION & UTILITY (no auth required)
// ──────────────────────────────────────────────

/**
 * POST /api/users/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
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
});

/**
 * GET /api/users/disciplines
 * Available healthcare disciplines
 */
router.get('/disciplines', (req, res) => {
  const disciplines = Object.values(HealthcareDiscipline).map(d => ({
    value: d,
    label: d.charAt(0).toUpperCase() + d.slice(1)
  }));
  res.json({ success: true, disciplines });
});

/**
 * GET /api/users/roles
 * Available user roles
 */
router.get('/roles', (req, res) => {
  const roles = Object.values(UserRole).map(r => ({
    value: r,
    label: r.charAt(0).toUpperCase() + r.slice(1)
  }));
  res.json({ success: true, roles });
});

/**
 * GET /api/users/registration-config
 * Complete registration form configuration
 */
router.get('/registration-config', (req, res) => {
  const config = {
    disciplines: Object.values(HealthcareDiscipline).map(d => ({
      value: d, label: d.charAt(0).toUpperCase() + d.slice(1),
      description: getDisciplineDescription(d)
    })),
    roles: Object.values(UserRole).map(r => ({
      value: r, label: r.charAt(0).toUpperCase() + r.slice(1),
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
});

// ──────────────────────────────────────────────
// USER LISTING & LOOKUP (authenticated)
// ──────────────────────────────────────────────

/**
 * GET /api/users
 * List users - role-aware (admin sees all, educator sees students, student sees self)
 */
router.get('/', authenticateToken, async (req, res) => {
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
});

/**
 * GET /api/users/:id
 * Get a single user by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const userRole = req.user?.role || req.user?.primaryRole;

    // Access control: student can only see themselves
    if (userRole === 'student' && req.user._id.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = await User.findById(id).select('-password -refreshToken -resetPasswordToken -resetPasswordExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load user' });
  }
});

/**
 * PUT /api/users/:id
 * Update a user (admin can update anyone, user can update themselves)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Only admin or the user themselves can update
    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { username, email, profile, status, role } = req.body;

    // Only admin can change role
    const updateData = { username, email, profile };
    if (status && (req.user.role === 'admin' || req.user._id.toString() === id)) updateData.status = status;
    if (role && req.user.role === 'admin') updateData.role = role;

    const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .select('-password -refreshToken -resetPasswordToken -resetPasswordExpires');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'User updated successfully', data: user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update user' });
  }
});

/**
 * DELETE /api/users/:id
 * Soft-delete a user (admin only)
 */
router.delete('/:id', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { status: 'deleted', isActive: false }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete user' });
  }
});

// ──────────────────────────────────────────────
// USER PROFILE MANAGEMENT
// ──────────────────────────────────────────────

/**
 * POST /api/users/:id/complete-profile
 * Complete user profile after registration
 */
router.post('/:id/complete-profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.userId;
    if (userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const result = await userRegistrationService.completeProfile(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Profile completion error:', error);
    if (error.message === 'User not found') return res.status(404).json({ success: false, message: 'User not found' });
    res.status(500).json({ success: false, message: 'Profile completion failed.' });
  }
});

/**
 * GET /api/users/:id/profile
 * Get user profile
 */
router.get('/:id/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.userId;
    if (userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const result = await userRegistrationService.getProfile(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Get profile error:', error);
    if (error.message === 'User not found') return res.status(404).json({ success: false, message: 'User not found' });
    res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
});

/**
 * PUT /api/users/:id/profile
 * Update user profile
 */
router.put('/:id/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.userId;
    if (userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const result = await userRegistrationService.updateProfile(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Profile update error:', error);
    if (error.message === 'User not found') return res.status(404).json({ success: false, message: 'User not found' });
    if (error.message.includes('Invalid') || error.message.includes('must be')) return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Profile update failed.' });
  }
});

/**
 * PUT /api/users/:id/password
 * Change user password
 */
router.put('/:id/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.userId;
    if (userId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }
    const result = await userRegistrationService.changePassword(req.params.id, currentPassword, newPassword);
    res.json(result);
  } catch (error) {
    console.error('Password change error:', error);
    if (error.message === 'User not found') return res.status(404).json({ success: false, message: 'User not found' });
    if (error.message === 'Current password is incorrect') return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    if (error.message.includes('Password must be')) return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Password change failed.' });
  }
});

/**
 * GET /api/users/:id/profile-wizard
 * Get profile completion steps for guided profile setup
 */
router.get('/:id/profile-wizard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.userId;
    if (userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const profile = await userRegistrationService.getProfile(req.params.id);
    const user = profile.user;

    const steps = [
      {
        id: 'basic-info', title: 'Basic Information',
        description: 'Complete your basic profile information',
        completed: !!(user.profile?.firstName && user.profile?.lastName && user.profile?.institution),
        fields: ['firstName', 'lastName', 'institution']
      },
      {
        id: 'academic-info', title: 'Academic Information',
        description: 'Add your academic and professional details',
        completed: !!(user.profile?.specialization || user.profile?.yearOfStudy || user.profile?.licenseNumber),
        fields: ['specialization', 'yearOfStudy', 'licenseNumber', 'competencyLevel']
      },
      {
        id: 'preferences', title: 'Learning Preferences',
        description: 'Set your learning preferences',
        completed: !!(user.profile?.preferences?.learningStyle && user.profile?.preferences?.difficultyPreference),
        fields: ['learningStyle', 'difficultyPreference', 'notifications']
      },
      {
        id: 'competencies', title: 'Competency Assessment',
        description: 'Review and adjust your competency targets',
        completed: user.competencies && user.competencies.length > 0,
        fields: ['competencies']
      }
    ];

    const overallProgress = steps.filter(s => s.completed).length / steps.length * 100;

    res.json({ success: true, steps, overallProgress, profileComplete: profile.profileComplete });
  } catch (error) {
    console.error('Profile wizard error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile wizard information' });
  }
});

// ──────────────────────────────────────────────
// USER PREFERENCES
// ──────────────────────────────────────────────

/**
 * GET /api/users/:id/preferences
 */
router.get('/:id/preferences', authenticateToken, async (req, res) => {
  try {
    // Only self or admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const preferences = await userPreferencesService.getUserPreferences(req.user);
    res.json({ success: true, data: preferences });
  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load preferences' });
  }
});

/**
 * PUT /api/users/:id/preferences
 */
router.put('/:id/preferences', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const validationErrors = userPreferencesService.validatePreferences(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: 'Invalid preference updates', errors: validationErrors });
    }
    const updatedPreferences = await userPreferencesService.updateUserPreferences(req.user, req.body);
    res.json({ success: true, data: updatedPreferences });
  } catch (error) {
    console.error('Update user preferences error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update preferences' });
  }
});

/**
 * DELETE /api/users/:id/preferences
 * Reset preferences to defaults
 */
router.delete('/:id/preferences', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const defaultPreferences = await userPreferencesService.resetToDefaults(req.user);
    res.json({ success: true, data: defaultPreferences, message: 'Preferences reset to defaults' });
  } catch (error) {
    console.error('Reset preferences error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to reset preferences' });
  }
});

// ──────────────────────────────────────────────
// ADMIN USER MANAGEMENT
// ──────────────────────────────────────────────

/**
 * POST /api/users/admin/reset-password/:userId
 * Admin: Reset another user's password
 */
router.post('/admin/reset-password/:userId', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ success: false, message: 'New password is required' });
    await adminUserManagementService.resetUserPassword(req.params.userId, newPassword, req.user);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    if (error.message === 'User not found') return res.status(404).json({ success: false, message: 'User not found' });
    if (error.message.includes('Password must be')) return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

/**
 * POST /api/users/admin/bulk/status
 */
router.post('/admin/bulk/status', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const { userIds, isActive } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ success: false, message: 'User IDs array is required' });
    if (typeof isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
    const result = await adminUserManagementService.bulkUpdateActiveStatus(userIds, isActive, req.user);
    res.json(result);
  } catch (error) {
    console.error('Bulk status update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
});

/**
 * POST /api/users/admin/bulk/roles
 */
router.post('/admin/bulk/roles', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const { userIds, role, operation } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ success: false, message: 'User IDs array is required' });
    if (!role || !Object.values(UserRole).includes(role)) return res.status(400).json({ success: false, message: 'Valid role is required' });
    if (!['add', 'remove'].includes(operation)) return res.status(400).json({ success: false, message: 'Operation must be "add" or "remove"' });
    const result = await adminUserManagementService.bulkRoleAssignment(userIds, role, operation, req.user);
    res.json(result);
  } catch (error) {
    console.error('Bulk role assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign roles' });
  }
});

/**
 * GET /api/users/admin/export
 */
router.get('/admin/export', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const { role, discipline, isActive, emailVerified, createdAfter, createdBefore } = req.query;
    const filters = {};
    if (role) filters.role = Array.isArray(role) ? role : [role];
    if (discipline) filters.discipline = Array.isArray(discipline) ? discipline : [discipline];
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (emailVerified !== undefined) filters.emailVerified = emailVerified === 'true';
    if (createdAfter) filters.createdAfter = createdAfter;
    if (createdBefore) filters.createdBefore = createdBefore;

    const csvData = await adminUserManagementService.exportUsers(filters, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
    res.send(csvData);
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({ success: false, message: 'Failed to export users' });
  }
});

/**
 * POST /api/users/admin/import
 */
router.post('/admin/import', authenticateToken, requireAnyRole(['admin']), upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required' });
    const result = await adminUserManagementService.importUsers(req.file.buffer, req.user);
    res.json({ success: true, message: 'Import completed', result });
  } catch (error) {
    console.error('Import users error:', error);
    res.status(500).json({ success: false, message: 'Failed to import users' });
  }
});

/**
 * GET /api/users/admin/import-template
 */
router.get('/admin/import-template', authenticateToken, requireAnyRole(['admin']), (req, res) => {
  const template = [
    'username,email,password,primaryRole,secondaryRoles,discipline,firstName,lastName,institution,specialization,yearOfStudy,licenseNumber,competencyLevel,isActive,emailVerified',
    'johnsmith,john@example.com,password123,student,,medicine,John,Smith,Medical University,Internal Medicine,3,,competent,true,false',
    'janedoe,jane@example.com,password456,educator,student,nursing,Jane,Doe,Nursing College,Critical Care,,,proficient,true,true'
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=user-import-template.csv');
  res.send(template);
});

/**
 * GET /api/users/admin/statistics
 */
router.get('/admin/statistics', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const statistics = await adminUserManagementService.getUserStatistics();
    res.json({ success: true, statistics });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve statistics' });
  }
});

/**
 * GET /api/users/admin/config
 */
router.get('/admin/config', authenticateToken, requireAnyRole(['admin']), (req, res) => {
  const config = {
    roles: Object.values(UserRole).map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1), description: getRoleDescription(r) })),
    disciplines: Object.values(HealthcareDiscipline).map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1), description: getDisciplineDescription(d) })),
    competencyLevels: [
      { value: 'novice', label: 'Novice', description: 'Beginning level with limited experience' },
      { value: 'advanced_beginner', label: 'Advanced Beginner', description: 'Some experience with guidance needed' },
      { value: 'competent', label: 'Competent', description: 'Adequate performance with planning' },
      { value: 'proficient', label: 'Proficient', description: 'Efficient performance with experience' },
      { value: 'expert', label: 'Expert', description: 'Intuitive performance with deep understanding' }
    ],
    sortOptions: [
      { value: 'createdAt', label: 'Created Date' }, { value: 'username', label: 'Username' },
      { value: 'email', label: 'Email' }, { value: 'profile.lastName', label: 'Last Name' }, { value: 'lastLogin', label: 'Last Login' }
    ],
    filterOptions: {
      roles: Object.values(UserRole), disciplines: Object.values(HealthcareDiscipline),
      activeStatus: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }],
      verificationStatus: [{ value: true, label: 'Verified' }, { value: false, label: 'Unverified' }]
    }
  };
  res.json({ success: true, config });
});

/**
 * GET /api/users/admin/stats
 * Legacy: Registration statistics for admin dashboard
 */
router.get('/admin/stats', authenticateToken, requireAnyRole(['admin']), async (req, res) => {
  try {
    const stats = await userRegistrationService.getRegistrationStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Stats retrieval error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve statistics' });
  }
});

// ──────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────

function getRoleDescription(role) {
  const descriptions = {
    [UserRole.STUDENT]: 'Learning healthcare skills and knowledge through simulations',
    [UserRole.EDUCATOR]: 'Teaching and mentoring healthcare students, creating content',
    [UserRole.ADMIN]: 'System administration, user management, and platform oversight'
  };
  return descriptions[role] || '';
}

function getDisciplineDescription(discipline) {
  const descriptions = {
    [HealthcareDiscipline.MEDICINE]: 'Medical practice, diagnosis, and treatment',
    [HealthcareDiscipline.NURSING]: 'Patient care, health promotion, and disease prevention',
    [HealthcareDiscipline.LABORATORY]: 'Diagnostic testing and laboratory analysis',
    [HealthcareDiscipline.RADIOLOGY]: 'Medical imaging and diagnostic radiology',
    [HealthcareDiscipline.PHARMACY]: 'Medication management and pharmaceutical care'
  };
  return descriptions[discipline] || '';
}

export default router;
