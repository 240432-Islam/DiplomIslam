/**
 * Audit Logger
 * Records and manages authentication and security events
 */

class AuditLogger {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Log an event
   * @param {Object} event - Event details
   * @returns {void}
   */
  logEvent(event) {
    const auditLogs = this.storage.loadLocal('auditLogs') || [];
    
    const auditEntry = {
      id: auditLogs.length + 1,
      timestamp: new Date().toISOString(),
      username: event.username || 'unknown',
      action: event.action,
      details: event.details || '',
      status: event.status, // 'success' or 'error'
      ip: this.getSimulatedIP(),
      userAgent: navigator.userAgent
    };

    auditLogs.push(auditEntry);
    this.storage.saveLocal('auditLogs', auditLogs);
  }

  /**
   * Get simulated IP address (for demonstration)
   * @returns {string} Simulated IP address
   */
  getSimulatedIP() {
    return '192.168.1.' + Math.floor(Math.random() * 255);
  }

  /**
   * Get audit logs with optional filtering
   * @param {Object} filter - Filter criteria
   * @returns {Array} Array of audit events
   */
  getAuditLogs(filter = {}) {
    let logs = this.storage.loadLocal('auditLogs') || [];

    // Apply filters
    if (filter.username) {
      logs = logs.filter(log => log.username === filter.username);
    }

    if (filter.action) {
      logs = logs.filter(log => log.action === filter.action);
    }

    if (filter.status) {
      logs = logs.filter(log => log.status === filter.status);
    }

    if (filter.startDate) {
      logs = logs.filter(log => new Date(log.timestamp) >= new Date(filter.startDate));
    }

    if (filter.endDate) {
      logs = logs.filter(log => new Date(log.timestamp) <= new Date(filter.endDate));
    }

    // Sort by timestamp (most recent first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return logs;
  }

  /**
   * Get audit statistics
   * @returns {Object} Statistics grouped by action type
   */
  getAuditStats() {
    const logs = this.storage.loadLocal('auditLogs') || [];
    const stats = {};

    logs.forEach(log => {
      if (!stats[log.action]) {
        stats[log.action] = {
          action: log.action,
          total: 0,
          successful: 0,
          failed: 0
        };
      }

      stats[log.action].total++;
      if (log.status === 'success') {
        stats[log.action].successful++;
      } else {
        stats[log.action].failed++;
      }
    });

    return Object.values(stats);
  }

  /**
   * Get recent activity
   * @param {number} limit - Number of recent events
   * @returns {Array} Recent events
   */
  getRecentActivity(limit = 10) {
    const logs = this.storage.loadLocal('auditLogs') || [];
    
    // Sort by timestamp (most recent first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return logs.slice(0, limit);
  }

  /**
   * Get action display name
   * @param {string} action - Action identifier
   * @returns {string} Display name
   */
  getActionDisplayName(action) {
    const displayNames = {
      'login': 'Login',
      'logout': 'Logout',
      'registration': 'Registration',
      'password_change': 'Password Change',
      'password_reset': 'Password Reset',
      'account_lockout': 'Account Lockout',
      'account_unlock': 'Account Unlock',
      'policy_change': 'Policy Change',
      'role_change': 'Role Change'
    };
    return displayNames[action] || action;
  }

  /**
   * Clear all audit logs (admin only, use with caution)
   * @returns {void}
   */
  clearAuditLogs() {
    this.storage.saveLocal('auditLogs', []);
  }
}

// Export singleton instance
const auditLogger = new AuditLogger(storageManager);
