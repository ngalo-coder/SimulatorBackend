import rbacService from '../services/RBACService.js';
import User from '../models/UserModel.js';

/**
 * RBAC Middleware for route-level permission checking
 */

/**
 * Create middleware to check permissions for a specific resource and action
 * @param {string} resource - Resource being accessed
 * @param {string} action - Action being performed
 * @param {Object} options - Additional options for permission checking
 * @returns {Function} - Express middleware function
 */
export const requirePermission = (resource, action, options = {}) => {
  return async (req, res, next) => {
    try {
      // Get user from request (should be set by auth middleware)
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Build context for permission evaluation
      const context = {
        targetUserId: req.params.userId || req.body.userId || req.query.userId,
        targetDiscipline: req.params.discipline || req.body.discipline || req.query.discipline,
        caseCreatorId: req.params.creatorId || req.body.creatorId,
        studentId: req.params.studentId || req.body.studentId,
        classId: req.params.classId || req.body.classId,
        ...options.context
      };

      // Check permission
      const hasPermission = await rbacService.checkPermission(user, resource, action, context);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to access this resource'
        });
      }

      // Permission granted, continue to next middleware
      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during permission check'
      });
    }
  };
};

/**
 * Middleware to check if user has any of the specified roles
 * @param {Array<string>} roles - Array of roles to check
 * @returns {Function} - Express middleware function
 */
export const requireAnyRole = (roles) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const hasRole = rbacService.hasAnyRole(user, roles);

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${roles.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during role check'
      });
    }
  };
};

/**
 * Middleware to check if user has all of the specified roles
 * @param {Array<string>} roles - Array of roles to check
 * @returns {Function} - Express middleware function
 */
export const requireAllRoles = (roles) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const hasAllRoles = rbacService.hasAllRoles(user, roles);

      if (!hasAllRoles) {
        return res.status(403).json({
          success: false,
          message: `Access denied. All required roles needed: ${roles.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during role check'
      });
    }
  };
};

/**
 * Middleware to check if user can access their own data
 * @param {string} userIdParam - Parameter name containing the user ID (default: 'userId')
 * @returns {Function} - Express middleware function
 */
export const requireOwnData = (userIdParam = 'userId') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const targetUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
      
      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'User ID parameter is required'
        });
      }

      // Check if user is accessing their own data or is an admin
      const isOwnData = targetUserId === user._id?.toString();
      const isAdmin = rbacService.hasAnyRole(user, ['admin']);

      if (!isOwnData && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own data'
        });
      }

      next();
    } catch (error) {
      console.error('Own data middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during data access check'
      });
    }
  };
};

/**
 * Middleware to check if user can access data from their discipline
 * @param {string} disciplineParam - Parameter name containing the discipline (default: 'discipline')
 * @returns {Function} - Express middleware function
 */
export const requireSameDiscipline = (disciplineParam = 'discipline') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const targetDiscipline = req.params[disciplineParam] || req.body[disciplineParam] || req.query[disciplineParam];
      
      if (!targetDiscipline) {
        return res.status(400).json({
          success: false,
          message: 'Discipline parameter is required'
        });
      }

      // Check if user is accessing data from their discipline or is an admin
      const isSameDiscipline = targetDiscipline === user.discipline;
      const isAdmin = rbacService.hasAnyRole(user, ['admin']);

      if (!isSameDiscipline && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access data from your discipline'
        });
      }

      next();
    } catch (error) {
      console.error('Discipline middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during discipline check'
      });
    }
  };
};

/**
 * Middleware to populate user object from database
 * This should be used after authentication middleware that sets req.user.id
 * @returns {Function} - Express middleware function
 */
export const populateUser = () => {
  return async (req, res, next) => {
    try {
      if (req.user && req.user._id && !req.user.primaryRole) {
        // User object exists but is not fully populated, fetch from database
        const fullUser = await User.findById(req.user._id);
        if (fullUser) {
          req.user = fullUser;
        }
      }
      next();
    } catch (error) {
      console.error('User population error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during user population'
      });
    }
  };
};

/**
 * Utility function to create context-aware permission middleware
 * @param {string} resource - Resource being accessed
 * @param {string} action - Action being performed
 * @param {Function} contextBuilder - Function to build context from request
 * @returns {Function} - Express middleware function
 */
export const requirePermissionWithContext = (resource, action, contextBuilder) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Build context using the provided function
      const context = contextBuilder ? contextBuilder(req) : {};

      // Check permission
      const hasPermission = await rbacService.checkPermission(user, resource, action, context);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to access this resource'
        });
      }

      next();
    } catch (error) {
      console.error('Context-aware RBAC middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during permission check'
      });
    }
  };
};

// Export commonly used middleware combinations
export const studentOnly = requireAnyRole(['student']);
export const educatorOnly = requireAnyRole(['educator']);
export const adminOnly = requireAnyRole(['admin']);
export const educatorOrAdmin = requireAnyRole(['educator', 'admin']);
export const anyAuthenticated = requireAnyRole(['student', 'educator', 'admin']);

// Export the RBAC service for direct use
export { rbacService };