/**
 * Audit Logger
 * Все события записываются в Supabase (таблица audit_logs).
 */

class AuditLogger {
  _simulatedIP() {
    return '192.168.1.' + Math.floor(Math.random() * 255);
  }

  async logEvent(event) {
    await db_createAuditLog({
      username: event.username || 'unknown',
      action: event.action,
      details: event.details || '',
      status: event.status,
      ip: this._simulatedIP(),
      userAgent: navigator.userAgent
    });
  }

  async getAuditLogs(filter = {}) {
    return await db_getAuditLogs(filter);
  }

  async getAuditStats() {
    const logs = await db_getAuditLogs();
    const stats = {};
    logs.forEach(log => {
      if (!stats[log.action]) {
        stats[log.action] = { action: log.action, total: 0, successful: 0, failed: 0 };
      }
      stats[log.action].total++;
      if (log.status === 'success') stats[log.action].successful++;
      else stats[log.action].failed++;
    });
    return Object.values(stats);
  }

  async getRecentActivity(limit = 10) {
    const logs = await db_getAuditLogs();
    return logs.slice(0, limit);
  }

  getActionDisplayName(action) {
    const names = {
      login: 'Вход', logout: 'Выход', registration: 'Регистрация',
      password_change: 'Смена пароля', password_reset: 'Сброс пароля',
      account_lockout: 'Блокировка', account_unlock: 'Разблокировка',
      policy_change: 'Изменение политики', role_change: 'Изменение роли'
    };
    return names[action] || action;
  }
}

const auditLogger = new AuditLogger();
