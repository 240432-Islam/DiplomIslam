/**
 * Role-Based Access Control Manager
 * Handles role permissions and feature access control
 */

class RBACManager {
  constructor() {
    this.rolePermissions = {
      superadmin: [
        'dashboard',
        'profile',
        'change-password',
        'policy-config',
        'user-management',
        'employee-database',
        'audit-logs',
        'system-settings',
        'role-management'
      ],
      admin: [
        'dashboard',
        'profile',
        'change-password',
        'policy-config',
        'user-management',
        'employee-database',
        'audit-logs'
      ],
      operator: [
        'dashboard',
        'profile',
        'change-password'
      ],
      user: [
        'profile',
        'change-password'
      ]
    };
  }

  /**
   * Check if user has permission for feature
   * @param {string} role - User role
   * @param {string} feature - Feature name
   * @returns {boolean} True if authorized
   */
  hasPermission(role, feature) {
    const permissions = this.rolePermissions[role];
    if (!permissions) {
      return false;
    }
    return permissions.includes(feature);
  }

  /**
   * Get accessible features for role
   * @param {string} role - User role
   * @returns {Array} Array of accessible features
   */
  getAccessibleFeatures(role) {
    return this.rolePermissions[role] || [];
  }

  /**
   * Assign role to user (admin only)
   * @param {number} userId - User ID
   * @param {string} role - Role to assign
   * @param {Object} storage - Storage manager instance
   * @returns {Object} Result with success flag
   */
  assignRole(userId, role, storage) {
    const validRoles = ['superadmin', 'admin', 'operator', 'user'];
    if (!validRoles.includes(role)) {
      return {
        success: false,
        error: 'Invalid role'
      };
    }

    const users = storage.loadLocal('users') || [];
    const user = users.find(u => u.id === userId);

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    user.role = role;
    storage.saveLocal('users', users);

    return {
      success: true,
      error: null
    };
  }

  /**
   * Get role display name
   * @param {string} role - Role identifier
   * @returns {string} Display name
   */
  getRoleDisplayName(role) {
    const displayNames = {
      superadmin: 'Super Administrator',
      admin: 'Administrator',
      operator: 'Operator',
      user: 'User'
    };
    return displayNames[role] || role;
  }

  /**
   * Check if role is super admin
   * @param {string} role - Role to check
   * @returns {boolean} True if super admin
   */
  isSuperAdmin(role) {
    return role === 'superadmin';
  }

  /**
   * Check if role is admin
   * @param {string} role - Role to check
   * @returns {boolean} True if admin
   */
  isAdmin(role) {
    return role === 'admin' || role === 'superadmin';
  }

  /**
   * Check if role is operator or higher
   * @param {string} role - Role to check
   * @returns {boolean} True if operator or admin
   */
  isOperatorOrHigher(role) {
    return role === 'admin' || role === 'operator';
  }
}

// Export singleton instance
const rbacManager = new RBACManager();
