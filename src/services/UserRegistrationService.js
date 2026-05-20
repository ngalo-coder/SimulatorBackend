import User, { UserRole, HealthcareDiscipline } from '../models/UserModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * User Registration Service
 * Handles user registration, profile completion, and profile management
 */
class UserRegistrationService {
  constructor() {
    // JWT configuration will be handled dynamically in generateToken method
  }

  /**
   * Register a new user with basic information
   * @param {Object} registrationData - User registration data
   * @returns {Promise<Object>} - Registration result with user and token
   */
  async registerUser(registrationData) {
    let {
      username,
      email,
      password,
      primaryRole = UserRole.STUDENT,
      discipline,
      firstName,
      lastName,
      institution,
      specialization,
      yearOfStudy,
      licenseNumber
    } = registrationData;

    // Backwards-compatible: allow minimal registration payloads
    // If username not provided, derive from email local part
    if (!username && email) {
      username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    }

    // If discipline is missing, set a safe default
    if (!discipline) {
      discipline = HealthcareDiscipline.MEDICINE;
    }

    // Validate required fields
    this.validateRegistrationData(registrationData);

    // Check if user already exists
    await this.checkUserExists(username, email);

    // Create user profile
    const profile = {
      firstName,
      lastName,
      institution,
      specialization,
      yearOfStudy,
      licenseNumber,
      preferences: this.getDefaultPreferences()
    };

    // Create new user
    const user = new User({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password,
      primaryRole,
      discipline,
      profile,
      isActive: true,
      emailVerified: false
    });

    // Add default competencies based on discipline
    this.addDefaultCompetencies(user, discipline);

    // Save user
    await user.save();

    // Generate JWT token
    const token = await this.generateToken(user);

    // Return user data (without password)
    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      success: true,
      message: 'User registered successfully',
      user: userResponse,
      token,
      profileComplete: this.isProfileComplete(user)
    };
  }

  /**
   * Complete user profile after initial registration
   * @param {string} userId - User ID
   * @param {Object} profileData - Additional profile data
   * @returns {Promise<Object>} - Updated user profile
   */
  async completeProfile(userId, profileData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update profile fields
    const allowedFields = [
      'specialization',
      'yearOfStudy',
      'licenseNumber',
      'competencyLevel',
      'preferences'
    ];

    allowedFields.forEach(field => {
      if (profileData[field] !== undefined) {
        if (field === 'preferences') {
          user.profile.preferences = {
            ...user.profile.preferences.toObject(),
            ...profileData[field]
          };
        } else {
          user.profile[field] = profileData[field];
        }
      }
    });

    // Add any additional competencies
    if (profileData.competencies && Array.isArray(profileData.competencies)) {
      profileData.competencies.forEach(competency => {
        user.addCompetency(competency);
      });
    }

    // Add any custom permissions
    if (profileData.permissions && Array.isArray(profileData.permissions)) {
      profileData.permissions.forEach(permission => {
        user.addPermission(permission.resource, permission.action, permission.conditions);
      });
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      success: true,
      message: 'Profile completed successfully',
      user: userResponse,
      profileComplete: this.isProfileComplete(user)
    };
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Profile update data
   * @returns {Promise<Object>} - Updated user profile
   */
  async updateProfile(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate update data
    this.validateProfileUpdate(updateData);

    // Update basic user fields
    const basicFields = ['email'];
    basicFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'email') {
          user[field] = updateData[field].toLowerCase().trim();
        } else {
          user[field] = updateData[field];
        }
      }
    });

    // Update profile fields
    const profileFields = [
      'firstName',
      'lastName',
      'specialization',
      'yearOfStudy',
      'institution',
      'licenseNumber',
      'competencyLevel'
    ];

    profileFields.forEach(field => {
      if (updateData[field] !== undefined) {
        user.profile[field] = updateData[field];
      }
    });

    // Update preferences
    if (updateData.preferences) {
      user.profile.preferences = {
        ...user.profile.preferences.toObject(),
        ...updateData.preferences
      };
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      success: true,
      message: 'Profile updated successfully',
      user: userResponse
    };
  }

  /**
   * Update user preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - New preferences
   * @returns {Promise<Object>} - Updated preferences
   */
  async updatePreferences(userId, preferences) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate preferences
    this.validatePreferences(preferences);

    // Update preferences
    user.profile.preferences = {
      ...user.profile.preferences.toObject(),
      ...preferences
    };

    await user.save();

    return {
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.profile.preferences
    };
  }

  /**
   * Get user profile
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User profile
   */
  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      success: true,
      user: userResponse,
      profileComplete: this.isProfileComplete(user)
    };
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} - Success response
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Update password
    user.password = newPassword;
    await user.save();

    return {
      success: true,
      message: 'Password changed successfully'
    };
  }

  /**
   * Validate registration data
   * @param {Object} data - Registration data
   */
  validateRegistrationData(data) {
    // Minimal required fields: email, password, firstName, lastName, institution
    const required = ['email', 'password', 'firstName', 'lastName', 'institution'];

    for (const field of required) {
      if (!data[field] || data[field].toString().trim() === '') {
        throw new Error(`${field} is required`);
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email format');
    }

    // If username is present validate it, otherwise it's derived earlier
    if (data.username) {
      const usernameRegex = /^[a-zA-Z0-9]+$/;
      if (!usernameRegex.test(data.username)) {
        throw new Error('Username can only contain letters and numbers');
      }
    }

    // Validate password strength
    this.validatePassword(data.password);

    // Validate discipline if provided
    if (data.discipline && !Object.values(HealthcareDiscipline).includes(data.discipline)) {
      throw new Error('Invalid healthcare discipline');
    }

    // Validate role
    if (data.primaryRole && !Object.values(UserRole).includes(data.primaryRole)) {
      throw new Error('Invalid user role');
    }

    // Validate year of study if provided
    if (data.yearOfStudy && (data.yearOfStudy < 1 || data.yearOfStudy > 10)) {
      throw new Error('Year of study must be between 1 and 10');
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   */
  validatePassword(password) {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Optional: Add more password strength requirements
    // const hasUpperCase = /[A-Z]/.test(password);
    // const hasLowerCase = /[a-z]/.test(password);
    // const hasNumbers = /\d/.test(password);
    // const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    //   throw new Error('Password must contain uppercase, lowercase, and numbers');
    // }
  }

  /**
   * Validate profile update data
   * @param {Object} data - Profile update data
   */
  validateProfileUpdate(data) {
    // Validate email if provided
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error('Invalid email format');
      }
    }

    // Validate year of study if provided
    if (data.yearOfStudy && (data.yearOfStudy < 1 || data.yearOfStudy > 10)) {
      throw new Error('Year of study must be between 1 and 10');
    }

    // Validate competency level if provided
    const validCompetencyLevels = ['novice', 'advanced_beginner', 'competent', 'proficient', 'expert'];
    if (data.competencyLevel && !validCompetencyLevels.includes(data.competencyLevel)) {
      throw new Error('Invalid competency level');
    }
  }

  /**
   * Validate user preferences
   * @param {Object} preferences - Preferences to validate
   */
  validatePreferences(preferences) {
    const validLearningStyles = ['visual', 'auditory', 'kinesthetic', 'reading'];
    const validDifficultyPreferences = ['beginner', 'intermediate', 'advanced', 'adaptive'];

    if (preferences.learningStyle && !validLearningStyles.includes(preferences.learningStyle)) {
      throw new Error('Invalid learning style');
    }

    if (preferences.difficultyPreference && !validDifficultyPreferences.includes(preferences.difficultyPreference)) {
      throw new Error('Invalid difficulty preference');
    }

    if (preferences.notifications) {
      const validBooleanFields = ['email', 'push', 'caseReminders', 'progressUpdates'];
      validBooleanFields.forEach(field => {
        if (preferences.notifications[field] !== undefined && typeof preferences.notifications[field] !== 'boolean') {
          throw new Error(`Notification ${field} must be a boolean`);
        }
      });
    }
  }

  /**
   * Check if user already exists
   * @param {string} username - Username to check
   * @param {string} email - Email to check
   */
  async checkUserExists(username, email) {
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase().trim() },
        { email: email.toLowerCase().trim() }
      ]
    });

    if (existingUser) {
      if (existingUser.username === username.toLowerCase().trim()) {
        throw new Error('Username already exists');
      }
      if (existingUser.email === email.toLowerCase().trim()) {
        throw new Error('Email already exists');
      }
    }
  }

  /**
   * Generate JWT token for user
   * @param {Object} user - User object
   * @returns {string} - JWT token
   */
  async generateToken(user) {
    const { getJwtSecret, getJwtExpiresIn } = await import('../config/auth.js');
    const jwtSecret = getJwtSecret();
    const jwtExpiresIn = getJwtExpiresIn();
    
    const payload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      primaryRole: user.primaryRole,
      discipline: user.discipline
    };

    return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
  }

  /**
   * Get default preferences for new users
   * @returns {Object} - Default preferences
   */
  getDefaultPreferences() {
    return {
      language: 'en',
      timezone: 'UTC',
      notifications: {
        email: true,
        push: true,
        caseReminders: true,
        progressUpdates: true
      },
      learningStyle: 'visual',
      difficultyPreference: 'adaptive'
    };
  }

  /**
   * Add default competencies based on discipline
   * @param {Object} user - User object
   * @param {string} discipline - Healthcare discipline
   */
  addDefaultCompetencies(user, discipline) {
    const disciplineCompetencies = {
      [HealthcareDiscipline.MEDICINE]: [
        { competencyId: 'MED001', competencyName: 'Clinical Reasoning', targetLevel: 4 },
        { competencyId: 'MED002', competencyName: 'Patient Communication', targetLevel: 4 },
        { competencyId: 'MED003', competencyName: 'Diagnostic Skills', targetLevel: 4 },
        { competencyId: 'MED004', competencyName: 'Treatment Planning', targetLevel: 4 }
      ],
      [HealthcareDiscipline.NURSING]: [
        { competencyId: 'NUR001', competencyName: 'Patient Care', targetLevel: 4 },
        { competencyId: 'NUR002', competencyName: 'Medication Administration', targetLevel: 4 },
        { competencyId: 'NUR003', competencyName: 'Care Planning', targetLevel: 4 },
        { competencyId: 'NUR004', competencyName: 'Patient Safety', targetLevel: 5 }
      ],
      [HealthcareDiscipline.LABORATORY]: [
        { competencyId: 'LAB001', competencyName: 'Specimen Processing', targetLevel: 4 },
        { competencyId: 'LAB002', competencyName: 'Quality Control', targetLevel: 5 },
        { competencyId: 'LAB003', competencyName: 'Result Interpretation', targetLevel: 4 },
        { competencyId: 'LAB004', competencyName: 'Laboratory Safety', targetLevel: 5 }
      ],
      [HealthcareDiscipline.RADIOLOGY]: [
        { competencyId: 'RAD001', competencyName: 'Image Interpretation', targetLevel: 4 },
        { competencyId: 'RAD002', competencyName: 'Technique Selection', targetLevel: 3 },
        { competencyId: 'RAD003', competencyName: 'Radiation Safety', targetLevel: 5 },
        { competencyId: 'RAD004', competencyName: 'Report Writing', targetLevel: 4 }
      ],
      [HealthcareDiscipline.PHARMACY]: [
        { competencyId: 'PHR001', competencyName: 'Medication Therapy Management', targetLevel: 4 },
        { competencyId: 'PHR002', competencyName: 'Drug Interactions', targetLevel: 4 },
        { competencyId: 'PHR003', competencyName: 'Patient Counseling', targetLevel: 4 },
        { competencyId: 'PHR004', competencyName: 'Pharmaceutical Care', targetLevel: 4 }
      ]
    };

    const competencies = disciplineCompetencies[discipline] || [];
    competencies.forEach(competency => {
      user.addCompetency(competency);
    });
  }

  /**
   * Check if user profile is complete
   * @param {Object} user - User object
   * @returns {boolean} - Whether profile is complete
   */
  isProfileComplete(user) {
    const requiredFields = [
      'profile.firstName',
      'profile.lastName',
      'profile.institution',
      'discipline'
    ];

    return requiredFields.every(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], user);
      return value && value.toString().trim() !== '';
    });
  }

  /**
   * Get registration statistics
   * @returns {Promise<Object>} - Registration statistics
   */
  async getRegistrationStats() {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ emailVerified: true });

    const usersByRole = await User.aggregate([
      { $group: { _id: '$primaryRole', count: { $sum: 1 } } }
    ]);

    const usersByDiscipline = await User.aggregate([
      { $group: { _id: '$discipline', count: { $sum: 1 } } }
    ]);

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      usersByDiscipline: usersByDiscipline.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
  }
}

// Create singleton instance
const userRegistrationService = new UserRegistrationService();

export default userRegistrationService;
export { UserRegistrationService };