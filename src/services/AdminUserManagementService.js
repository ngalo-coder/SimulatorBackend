import User, { UserRole, HealthcareDiscipline } from '../models/UserModel.js';
import auditLogger from './AuditLoggerService.js';
import bcrypt from 'bcryptjs';
import csv from 'csv-parser';
import { Readable } from 'stream';

/**
 * Admin User Management Service
 * Handles administrative user operations including CRUD, bulk operations, and role management
 */
class AdminUserManagementService {
  constructor() {
    this.defaultPageSize = 20;
    this.maxPageSize = 100;
  }

  /**
   * Get paginated list of users with filtering and sorting
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Promise<Object>} - Paginated user list
   */
  async getUsers(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = this.defaultPageSize,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search = ''
      } = options;

      // Build query
      const query = {};

      // Role filter
      if (filters.role) {
        if (Array.isArray(filters.role)) {
          query.$or = [
            { primaryRole: { $in: filters.role } },
            { secondaryRoles: { $in: filters.role } }
          ];
        } else {
          query.$or = [
            { primaryRole: filters.role },
            { secondaryRoles: filters.role }
          ];
        }
      }

      // Discipline filter
      if (filters.discipline) {
        if (Array.isArray(filters.discipline)) {
          query.discipline = { $in: filters.discipline };
        } else {
          query.discipline = filters.discipline;
        }
      }

      // Active status filter
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      // Email verified filter
      if (filters.emailVerified !== undefined) {
        query.emailVerified = filters.emailVerified;
      }

      // Date range filters
      if (filters.createdAfter || filters.createdBefore) {
        query.createdAt = {};
        if (filters.createdAfter) {
          query.createdAt.$gte = new Date(filters.createdAfter);
        }
        if (filters.createdBefore) {
          query.createdAt.$lte = new Date(filters.createdBefore);
        }
      }

      // Search filter
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'profile.firstName': { $regex: search, $options: 'i' } },
          { 'profile.lastName': { $regex: search, $options: 'i' } },
          { 'profile.institution': { $regex: search, $options: 'i' } }
        ];
      }

      // Pagination
      const pageSize = Math.min(parseInt(limit), this.maxPageSize);
      const skip = (parseInt(page) - 1) * pageSize;

      // Sorting
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password') // Exclude password field
          .sort(sort)
          .skip(skip)
          .limit(pageSize)
          .lean(),
        User.countDocuments(query)
      ]);

      return {
        users,
        pagination: {
          page: parseInt(page),
          limit: pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: skip + pageSize < total,
          hasPrev: page > 1
        },
        filters: filters,
        sort: { sortBy, sortOrder }
      };
    } catch (error) {
      console.error('Get users error:', error);
      throw new Error('Failed to retrieve users');
    }
  }

  /**
   * Get user by ID with full details
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User details
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId).select('-password').lean();
      
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      console.error('Get user by ID error:', error);
      throw error;
    }
  }

  /**
   * Create a new user (admin function)
   * @param {Object} userData - User data
   * @param {Object} adminUser - Admin user performing the action
   * @returns {Promise<Object>} - Created user
   */
  async createUser(userData, adminUser) {
    try {
      // Validate required fields
      const requiredFields = ['username', 'email', 'password', 'discipline', 'firstName', 'lastName', 'institution'];
      for (const field of requiredFields) {
        if (!userData[field]) {
          throw new Error(`${field} is required`);
        }
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { username: userData.username.toLowerCase().trim() },
          { email: userData.email.toLowerCase().trim() }
        ]
      });

      if (existingUser) {
        throw new Error('Username or email already exists');
      }

      // Create user profile
      const profile = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        institution: userData.institution,
        specialization: userData.specialization || '',
        yearOfStudy: userData.yearOfStudy || null,
        licenseNumber: userData.licenseNumber || '',
        competencyLevel: userData.competencyLevel || 'novice',
        preferences: userData.preferences || {}
      };

      // Create new user
      const user = new User({
        username: userData.username.toLowerCase().trim(),
        email: userData.email.toLowerCase().trim(),
        password: userData.password,
        primaryRole: userData.primaryRole || UserRole.STUDENT,
        secondaryRoles: userData.secondaryRoles || [],
        discipline: userData.discipline,
        profile,
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        emailVerified: userData.emailVerified || false
      });

      // Add custom permissions if provided
      if (userData.permissions && Array.isArray(userData.permissions)) {
        userData.permissions.forEach(permission => {
          user.addPermission(permission.resource, permission.action, permission.conditions);
        });
      }

      await user.save();

      // Log user creation (disabled)
      // await auditLogger.logAuthEvent({
      //   event: 'USER_CREATED',
      //   userId: user._id,
      //   username: user.username,
      //   adminUserId: adminUser._id,
      //   adminUsername: adminUser.username,
      //   metadata: {
      //     createdUserRole: user.primaryRole,
      //     createdUserDiscipline: user.discipline
      //   }
      // });

      // Return user without password
      const userResponse = user.toObject();
      delete userResponse.password;

      return userResponse;
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  /**
   * Update user information (admin function)
   * @param {string} userId - User ID to update
   * @param {Object} updateData - Update data
   * @param {Object} adminUser - Admin user performing the action
   * @returns {Promise<Object>} - Updated user
   */
  async updateUser(userId, updateData, adminUser) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const originalData = {
        primaryRole: user.primaryRole,
        secondaryRoles: [...user.secondaryRoles],
        discipline: user.discipline,
        isActive: user.isActive
      };

      // Update basic fields
      const basicFields = ['email', 'primaryRole', 'secondaryRoles', 'discipline', 'isActive', 'emailVerified'];
      basicFields.forEach(field => {
        if (updateData[field] !== undefined) {
          user[field] = updateData[field];
        }
      });

      // Update profile fields
      if (updateData.profile) {
        const profileFields = ['firstName', 'lastName', 'institution', 'specialization', 'yearOfStudy', 'licenseNumber', 'competencyLevel'];
        profileFields.forEach(field => {
          if (updateData.profile[field] !== undefined) {
            user.profile[field] = updateData.profile[field];
          }
        });

        // Update preferences
        if (updateData.profile.preferences) {
          user.profile.preferences = {
            ...user.profile.preferences.toObject(),
            ...updateData.profile.preferences
          };
        }
      }

      // Update permissions
      if (updateData.permissions) {
        user.permissions = [];
        updateData.permissions.forEach(permission => {
          user.addPermission(permission.resource, permission.action, permission.conditions);
        });
      }

      await user.save();

      // Log user update (disabled)
      // await auditLogger.logAuthEvent({
      //   event: 'USER_UPDATED',
      //   userId: user._id,
      //   username: user.username,
      //   adminUserId: adminUser._id,
      //   adminUsername: adminUser.username,
      //   metadata: {
      //     originalData,
      //     updatedFields: Object.keys(updateData)
      //   }
      // });

      // Return user without password
      const userResponse = user.toObject();
      delete userResponse.password;

      return userResponse;
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  /**
   * Delete user (admin function)
   * @param {string} userId - User ID to delete
   * @param {Object} adminUser - Admin user performing the action
   * @returns {Promise<boolean>} - Success status
   */
  async deleteUser(userId, adminUser) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Prevent deletion of the last admin
      if (user.primaryRole === UserRole.ADMIN || user.secondaryRoles.includes(UserRole.ADMIN)) {
        const adminCount = await User.countDocuments({
          $or: [
            { primaryRole: UserRole.ADMIN },
            { secondaryRoles: UserRole.ADMIN }
          ],
          isActive: true
        });

        if (adminCount <= 1) {
          throw new Error('Cannot delete the last admin user');
        }
      }

      await User.findByIdAndDelete(userId);

      // Log user deletion (disabled)
      // await auditLogger.logAuthEvent({
      //   event: 'USER_DELETED',
      //   userId: userId,
      //   username: user.username,
      //   adminUserId: adminUser._id,
      //   adminUsername: adminUser.username,
      //   metadata: {
      //     deletedUserRole: user.primaryRole,
      //     deletedUserDiscipline: user.discipline
      //   }
      // });

      return true;
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  /**
   * Bulk activate/deactivate users
   * @param {Array<string>} userIds - Array of user IDs
   * @param {boolean} isActive - Active status to set
   * @param {Object} adminUser - Admin user performing the action
   * @returns {Promise<Object>} - Bulk operation result
   */
  async bulkUpdateActiveStatus(userIds, isActive, adminUser) {
    try {
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { isActive: isActive }
      );

      // Log bulk operation (disabled)
      // await auditLogger.logAuthEvent({
      //   event: 'BULK_USER_STATUS_UPDATE',
      //   adminUserId: adminUser._id,
      //   adminUsername: adminUser.username,
      //   metadata: {
      //     userIds,
      //     isActive,
      //     modifiedCount: result.modifiedCount
      //   }
      // });

      return {
        success: true,
        modifiedCount: result.modifiedCount,
        message: `${result.modifiedCount} users ${isActive ? 'activated' : 'deactivated'}`
      };
    } catch (error) {
      console.error('Bulk update active status error:', error);
      throw error;
    }
  }

  /**
   * Bulk role assignment
   * @param {Array<string>} userIds - Array of user IDs
   * @param {string} role - Role to assign
   * @param {string} operation - 'add' or 'remove'
   * @param {Object} adminUser - Admin user performing the action
   * @returns {Promise<Object>} - Bulk operation result
   */
  async bulkRoleAssignment(userIds, role, operation, adminUser) {
    try {
      let updateOperation;
      
      if (operation === 'add') {
        updateOperation = { $addToSet: { secondaryRoles: role } };
      } else if (operation === 'remove') {
        updateOperation = { $pull: { secondaryRoles: role } };
      } else {
        throw new Error('Invalid operation. Use "add" or "remove"');
      }

      const result = await User.updateMany(
        { _id: { $in: userIds } },
        updateOperation
      );

      // Log bulk role assignment (disabled)
      // await auditLogger.logAuthEvent({
      //   event: 'BULK_ROLE_ASSIGNMENT',
      //   adminUserId: adminUser._id,
      //   adminUsername: adminUser.username,
      //   metadata: {
      //     userIds,
      //     role,
      //     operation,
      //     modifiedCount: result.modifiedCount
      //   }
      // });

      return {
        success: true,
        modifiedCount: result.modifiedCount,
        message: `Role ${role} ${operation === 'add' ? 'added to' : 'removed from'} ${result.modifiedCount} users`
      };
    } catch (error) {
      console.error('Bulk role assignment error:', error);
      throw error;
    }
  }

  /**
   * Export users to CSV
   * @param {Object} filters - Filter criteria
   * @param {Object} adminUser - Admin user performing the action
   * @returns {Promise<string>} - CSV data
   */
  async exportUsers(filters = {}, adminUser) {
    try {
      // Get all users matching filters (no pagination)
      const query = this.buildQuery(filters);
      const users = await User.find(query)
        .select('-password')
        .lean();

      // Convert to CSV format
      const csvData = this.convertUsersToCSV(users);

      // Log export operation (disabled)
      // await auditLogger.logAuthEvent({
      //   event: 'USERS_EXPORTED',
      //   adminUserId: adminUser._id,
      //   adminUsername: adminUser.username,
      //   metadata: {
      //     filters,
      //     exportedCount: users.length
      //   }
      // });

      return csvData;
    } catch (error) {
      console.error('Export users error:', error);
      throw error;
    }
  }

  /**
   * Import users from CSV
   * @param {Buffer} csvBuffer - CSV file buffer
   * @param {Object} adminUser - Admin user performing the action
   * @returns {Promise<Object>} - Import result
   */
  async importUsers(csvBuffer, adminUser) {
    try {
      const users = await this.parseCSVBuffer(csvBuffer);
      const results = {
        total: users.length,
        created: 0,
        updated: 0,
        errors: []
      };

      for (let i = 0; i < users.length; i++) {
        try {
          const userData = users[i];
          
          // Check if user exists
          const existingUser = await User.findOne({
            $or: [
              { username: userData.username?.toLowerCase().trim() },
              { email: userData.email?.toLowerCase().trim() }
            ]
          });

          if (existingUser) {
            // Update existing user
            await this.updateUser(existingUser._id, userData, adminUser);
            results.updated++;
          } else {
            // Create new user
            await this.createUser(userData, adminUser);
            results.created++;
          }
        } catch (error) {
          results.errors.push({
            row: i + 1,
            data: users[i],
            error: error.message
          });
        }
      }

      // Log import operation (disabled)
      // await auditLogger.logAuthEvent({
      //   event: 'USERS_IMPORTED',
      //   adminUserId: adminUser._id,
      //   adminUsername: adminUser.username,
      //   metadata: results
      // });

      return results;
    } catch (error) {
      console.error('Import users error:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} - User statistics
   */
  async getUserStatistics() {
    try {
      const [
        totalUsers,
        activeUsers,
        verifiedUsers,
        usersByRole,
        usersByDiscipline,
        recentUsers
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ emailVerified: true }),
        
        User.aggregate([
          { $group: { _id: '$primaryRole', count: { $sum: 1 } } }
        ]),
        
        User.aggregate([
          { $group: { _id: '$discipline', count: { $sum: 1 } } }
        ]),
        
        User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
      ]);

      return {
        totalUsers,
        activeUsers,
        verifiedUsers,
        inactiveUsers: totalUsers - activeUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        recentUsers,
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        usersByDiscipline: usersByDiscipline.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Get user statistics error:', error);
      throw error;
    }
  }

  /**
   * Reset user password (admin function)
   * @param {string} userId - User ID
   * @param {string} newPassword - New password
   * @param {Object} adminUser - Admin user performing the action
   * @returns {Promise<boolean>} - Success status
   */
  async resetUserPassword(userId, newPassword, adminUser) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Validate password
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      user.password = newPassword;
      await user.save();

      // Log password reset (disabled)
      // await auditLogger.logAuthEvent({
      //   event: 'PASSWORD_RESET_BY_ADMIN',
      //   userId: user._id,
      //   username: user.username,
      //   adminUserId: adminUser._id,
      //   adminUsername: adminUser.username
      // });

      return true;
    } catch (error) {
      console.error('Reset user password error:', error);
      throw error;
    }
  }

  /**
   * Helper method to build query from filters
   * @param {Object} filters - Filter criteria
   * @returns {Object} - MongoDB query
   */
  buildQuery(filters) {
    const query = {};

    if (filters.role) {
      if (Array.isArray(filters.role)) {
        query.$or = [
          { primaryRole: { $in: filters.role } },
          { secondaryRoles: { $in: filters.role } }
        ];
      } else {
        query.$or = [
          { primaryRole: filters.role },
          { secondaryRoles: filters.role }
        ];
      }
    }

    if (filters.discipline) {
      if (Array.isArray(filters.discipline)) {
        query.discipline = { $in: filters.discipline };
      } else {
        query.discipline = filters.discipline;
      }
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.emailVerified !== undefined) {
      query.emailVerified = filters.emailVerified;
    }

    return query;
  }

  /**
   * Convert users array to CSV format
   * @param {Array} users - Users array
   * @returns {string} - CSV data
   */
  convertUsersToCSV(users) {
    const headers = [
      'username', 'email', 'primaryRole', 'secondaryRoles', 'discipline',
      'firstName', 'lastName', 'institution', 'specialization', 'yearOfStudy',
      'licenseNumber', 'competencyLevel', 'isActive', 'emailVerified', 'createdAt'
    ];

    const csvRows = [headers.join(',')];

    users.forEach(user => {
      const row = [
        user.username,
        user.email,
        user.primaryRole,
        user.secondaryRoles?.join(';') || '',
        user.discipline,
        user.profile?.firstName || '',
        user.profile?.lastName || '',
        user.profile?.institution || '',
        user.profile?.specialization || '',
        user.profile?.yearOfStudy || '',
        user.profile?.licenseNumber || '',
        user.profile?.competencyLevel || '',
        user.isActive,
        user.emailVerified,
        user.createdAt
      ].map(field => `"${String(field || '').replace(/"/g, '""')}"`);

      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Parse CSV buffer to users array
   * @param {Buffer} csvBuffer - CSV file buffer
   * @returns {Promise<Array>} - Parsed users array
   */
  async parseCSVBuffer(csvBuffer) {
    return new Promise((resolve, reject) => {
      const users = [];
      const stream = Readable.from(csvBuffer.toString());

      stream
        .pipe(csv())
        .on('data', (row) => {
          const user = {
            username: row.username?.trim(),
            email: row.email?.trim(),
            password: row.password || 'defaultPassword123',
            primaryRole: row.primaryRole || UserRole.STUDENT,
            secondaryRoles: row.secondaryRoles ? row.secondaryRoles.split(';') : [],
            discipline: row.discipline,
            firstName: row.firstName?.trim(),
            lastName: row.lastName?.trim(),
            institution: row.institution?.trim(),
            specialization: row.specialization?.trim(),
            yearOfStudy: row.yearOfStudy ? parseInt(row.yearOfStudy) : null,
            licenseNumber: row.licenseNumber?.trim(),
            competencyLevel: row.competencyLevel || 'novice',
            isActive: row.isActive !== 'false',
            emailVerified: row.emailVerified === 'true'
          };

          users.push(user);
        })
        .on('end', () => {
          resolve(users);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
}

// Create singleton instance
const adminUserManagementService = new AdminUserManagementService();

export default adminUserManagementService;
export { AdminUserManagementService };