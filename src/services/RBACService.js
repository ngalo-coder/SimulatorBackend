import { UserRole, HealthcareDiscipline } from '../models/UserModel.js';

/**
 * Role-Based Access Control Service
 * Handles permission checking and authorization logic
 */
class RBACService {
  constructor() {
    // Define base permissions for each role
    this.rolePermissions = new Map([
      [UserRole.STUDENT, [
        { resource: 'cases', action: 'read', conditions: { disciplineMatch: true } },
        { resource: 'cases', action: 'attempt', conditions: { disciplineMatch: true } },
        { resource: 'simulations', action: 'create', conditions: { ownData: true } },
        { resource: 'simulations', action: 'read', conditions: { ownData: true } },
        { resource: 'progress', action: 'read', conditions: { ownData: true } },
        { resource: 'feedback', action: 'read', conditions: { ownData: true } },
        { resource: 'profile', action: 'read', conditions: { ownData: true } },
        { resource: 'profile', action: 'update', conditions: { ownData: true } },
        { resource: 'competencies', action: 'read', conditions: { ownData: true } },
        { resource: 'achievements', action: 'read', conditions: { ownData: true } },
        { resource: 'help', action: 'read' },
        { resource: 'resources', action: 'read', conditions: { disciplineMatch: true } }
      ]],
      [UserRole.EDUCATOR, [
        // Educator inherits all student permissions
        ...this.getStudentPermissions(),
        // Plus additional educator-specific permissions
        { resource: 'cases', action: 'create', conditions: { disciplineMatch: true } },
        { resource: 'cases', action: 'edit', conditions: { ownCases: true, disciplineMatch: true } },
        { resource: 'cases', action: 'delete', conditions: { ownCases: true, disciplineMatch: true } },
        { resource: 'cases', action: 'review', conditions: { disciplineMatch: true } },
        { resource: 'students', action: 'read', conditions: { ownStudents: true, disciplineMatch: true } },
        { resource: 'students', action: 'manage', conditions: { ownStudents: true, disciplineMatch: true } },
        { resource: 'analytics', action: 'read', conditions: { ownClasses: true, disciplineMatch: true } },
        { resource: 'feedback', action: 'create', conditions: { disciplineMatch: true } },
        { resource: 'assessments', action: 'create', conditions: { disciplineMatch: true } },
        { resource: 'assessments', action: 'grade', conditions: { ownStudents: true, disciplineMatch: true } },
        { resource: 'reports', action: 'generate', conditions: { ownClasses: true, disciplineMatch: true } }
      ]],
      [UserRole.ADMIN, [
        // Admin has full access
        { resource: '*', action: '*' }
      ]]
    ]);
  }

  /**
   * Get student permissions (used for role inheritance)
   */
  getStudentPermissions() {
    return [
      { resource: 'cases', action: 'read', conditions: { disciplineMatch: true } },
      { resource: 'cases', action: 'attempt', conditions: { disciplineMatch: true } },
      { resource: 'simulations', action: 'create', conditions: { ownData: true } },
      { resource: 'simulations', action: 'read', conditions: { ownData: true } },
      { resource: 'progress', action: 'read', conditions: { ownData: true } },
      { resource: 'feedback', action: 'read', conditions: { ownData: true } },
      { resource: 'profile', action: 'read', conditions: { ownData: true } },
      { resource: 'profile', action: 'update', conditions: { ownData: true } },
      { resource: 'competencies', action: 'read', conditions: { ownData: true } },
      { resource: 'achievements', action: 'read', conditions: { ownData: true } },
      { resource: 'help', action: 'read' },
      { resource: 'resources', action: 'read', conditions: { disciplineMatch: true } }
    ];
  }

  /**
   * Check if a user has permission to perform an action on a resource
   * @param {Object} user - User object with roles and permissions
   * @param {string} resource - Resource being accessed
   * @param {string} action - Action being performed
   * @param {Object} context - Additional context for permission evaluation
   * @returns {Promise<boolean>} - Whether the user has permission
   */
  async checkPermission(user, resource, action, context = {}) {
    if (!user) {
      return false;
    }

    // Get all permissions for the user (role-based + custom)
    const userPermissions = this.getUserPermissions(user);

    // Check each permission
    for (const permission of userPermissions) {
      if (this.matchesPermission(permission, resource, action)) {
        // If permission matches, evaluate conditions
        if (permission.conditions && Object.keys(permission.conditions).length > 0) {
          const conditionsMet = await this.evaluateConditions(permission.conditions, user, context);
          if (conditionsMet) {
            return true;
          }
        } else {
          // No conditions, permission granted
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all permissions for a user (role-based + custom)
   * @param {Object} user - User object
   * @returns {Array} - Array of permissions
   */
  getUserPermissions(user) {
    const permissions = [];

    // Add primary role permissions
    const primaryRolePermissions = this.rolePermissions.get(user.primaryRole) || [];
    permissions.push(...primaryRolePermissions);

    // Add secondary role permissions
    if (user.secondaryRoles && user.secondaryRoles.length > 0) {
      for (const role of user.secondaryRoles) {
        const rolePermissions = this.rolePermissions.get(role) || [];
        permissions.push(...rolePermissions);
      }
    }

    // Add user-specific permissions
    if (user.permissions && user.permissions.length > 0) {
      permissions.push(...user.permissions);
    }

    return permissions;
  }

  /**
   * Check if a permission matches the requested resource and action
   * @param {Object} permission - Permission object
   * @param {string} resource - Requested resource
   * @param {string} action - Requested action
   * @returns {boolean} - Whether the permission matches
   */
  matchesPermission(permission, resource, action) {
    // Admin wildcard permission
    if (permission.resource === '*' && permission.action === '*') {
      return true;
    }

    // Resource wildcard
    if (permission.resource === '*' && permission.action === action) {
      return true;
    }

    // Action wildcard
    if (permission.resource === resource && permission.action === '*') {
      return true;
    }

    // Exact match
    if (permission.resource === resource && permission.action === action) {
      return true;
    }

    return false;
  }

  /**
   * Evaluate permission conditions
   * @param {Object} conditions - Conditions to evaluate
   * @param {Object} user - User object
   * @param {Object} context - Context for evaluation
   * @returns {Promise<boolean>} - Whether conditions are met
   */
  async evaluateConditions(conditions, user, context) {
    // Check ownData condition
    if (conditions.ownData) {
      if (!context.targetUserId || context.targetUserId !== user._id?.toString()) {
        return false;
      }
    }

    // Check disciplineMatch condition
    if (conditions.disciplineMatch) {
      if (context.targetDiscipline && context.targetDiscipline !== user.discipline) {
        return false;
      }
    }

    // Check ownCases condition
    if (conditions.ownCases) {
      if (!context.caseCreatorId || context.caseCreatorId !== user._id?.toString()) {
        return false;
      }
    }

    // Check ownStudents condition
    if (conditions.ownStudents) {
      if (!context.studentId || !await this.isUserStudent(user._id, context.studentId)) {
        return false;
      }
    }

    // Check ownClasses condition
    if (conditions.ownClasses) {
      if (!context.classId || !await this.isUserClass(user._id, context.classId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a student belongs to an educator
   * @param {string} educatorId - Educator's ID
   * @param {string} studentId - Student's ID
   * @returns {Promise<boolean>} - Whether the student belongs to the educator
   */
  async isUserStudent(educatorId, studentId) {
    // This would typically query a database to check educator-student relationships
    // For now, return true as a placeholder
    // TODO: Implement actual database query
    return true;
  }

  /**
   * Check if a class belongs to an educator
   * @param {string} educatorId - Educator's ID
   * @param {string} classId - Class ID
   * @returns {Promise<boolean>} - Whether the class belongs to the educator
   */
  async isUserClass(educatorId, classId) {
    // This would typically query a database to check educator-class relationships
    // For now, return true as a placeholder
    // TODO: Implement actual database query
    return true;
  }

  /**
   * Check if user has any of the specified roles
   * @param {Object} user - User object
   * @param {Array<string>} roles - Array of roles to check
   * @returns {boolean} - Whether user has any of the roles
   */
  hasAnyRole(user, roles) {
    if (!user || !roles || roles.length === 0) {
      return false;
    }

    const userRoles = user.getAllRoles ? user.getAllRoles() : [user.primaryRole];
    return roles.some(role => userRoles.includes(role));
  }

  /**
   * Check if user has all of the specified roles
   * @param {Object} user - User object
   * @param {Array<string>} roles - Array of roles to check
   * @returns {boolean} - Whether user has all of the roles
   */
  hasAllRoles(user, roles) {
    if (!user || !roles || roles.length === 0) {
      return false;
    }

    const userRoles = user.getAllRoles ? user.getAllRoles() : [user.primaryRole];
    return roles.every(role => userRoles.includes(role));
  }

  /**
   * Get permissions for a specific role
   * @param {string} role - Role to get permissions for
   * @returns {Array} - Array of permissions
   */
  getRolePermissions(role) {
    return this.rolePermissions.get(role) || [];
  }

  /**
   * Add a custom permission to a role
   * @param {string} role - Role to add permission to
   * @param {Object} permission - Permission object
   */
  addRolePermission(role, permission) {
    const rolePermissions = this.rolePermissions.get(role) || [];
    rolePermissions.push(permission);
    this.rolePermissions.set(role, rolePermissions);
  }

  /**
   * Remove a permission from a role
   * @param {string} role - Role to remove permission from
   * @param {string} resource - Resource of permission to remove
   * @param {string} action - Action of permission to remove
   */
  removeRolePermission(role, resource, action) {
    const rolePermissions = this.rolePermissions.get(role) || [];
    const filteredPermissions = rolePermissions.filter(
      perm => !(perm.resource === resource && perm.action === action)
    );
    this.rolePermissions.set(role, filteredPermissions);
  }
}

// Create singleton instance
const rbacService = new RBACService();

export default rbacService;
export { RBACService };