/**
 * Role-Based Access Control Manager
 */

class RBACManager {
  constructor() {
    this.rolePermissions = {
      superadmin: ['dashboard','profile','change-password','policy-config','user-management','employee-database','audit-logs','system-settings','role-management'],
      admin:      ['dashboard','profile','change-password','policy-config','user-management','employee-database','audit-logs'],
      operator:   ['dashboard','profile','change-password'],
      user:       ['profile','change-password']
    };
  }

  hasPermission(role, feature) {
    return (this.rolePermissions[role] || []).includes(feature);
  }

  getAccessibleFeatures(role) {
    return this.rolePermissions[role] || [];
  }

  async assignRole(userId, role) {
    const validRoles = ['superadmin', 'admin', 'operator', 'user'];
    if (!validRoles.includes(role)) return { success: false, error: 'Недопустимая роль' };
    const result = await db_updateUser(userId, { role });
    return result;
  }

  getRoleDisplayName(role) {
    const names = { superadmin: 'Супер Администратор', admin: 'Администратор', operator: 'Оператор', user: 'Пользователь' };
    return names[role] || role;
  }

  isSuperAdmin(role) { return role === 'superadmin'; }
  isAdmin(role)      { return role === 'admin' || role === 'superadmin'; }
}

const rbacManager = new RBACManager();
