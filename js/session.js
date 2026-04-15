/**
 * Session Manager
 * Handles user session creation, validation, and destruction
 */

class SessionManager {
  constructor(storage) {
    this.storage = storage;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
  }

  /**
   * Generate secure session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create new session
   * @param {Object} user - Authenticated user
   * @returns {Object} Session object
   */
  createSession(user) {
    const session = {
      sessionId: this.generateSessionId(),
      userId: user.id,
      username: user.username,
      role: user.role,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString()
    };

    this.storage.saveSession('currentSession', session);
    return session;
  }

  /**
   * Validate current session
   * @returns {boolean} True if session valid
   */
  validateSession() {
    const session = this.getCurrentSession();
    
    if (!session) {
      return false;
    }

    // Check if session expired
    if (this.isSessionExpired()) {
      this.destroySession();
      return false;
    }

    // Refresh session activity
    this.refreshSession();
    
    return true;
  }

  /**
   * Get current session
   * @returns {Object|null} Current session or null
   */
  getCurrentSession() {
    return this.storage.loadSession('currentSession');
  }

  /**
   * Destroy session
   * @returns {void}
   */
  destroySession() {
    this.storage.removeSession('currentSession');
  }

  /**
   * Check session timeout
   * @returns {boolean} True if session expired
   */
  isSessionExpired() {
    const session = this.getCurrentSession();
    
    if (!session) {
      return true;
    }

    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();

    return now >= expiresAt;
  }

  /**
   * Refresh session activity
   * @returns {void}
   */
  refreshSession() {
    const session = this.getCurrentSession();
    
    if (session) {
      session.lastActivity = new Date().toISOString();
      session.expiresAt = new Date(Date.now() + this.sessionTimeout).toISOString();
      this.storage.saveSession('currentSession', session);
    }
  }

  /**
   * Get current user from session
   * @returns {Object|null} User object or null
   */
  getCurrentUser() {
    const session = this.getCurrentSession();
    
    if (!session) {
      return null;
    }

    return {
      id: session.userId,
      username: session.username,
      role: session.role
    };
  }

  /**
   * Check if user is logged in
   * @returns {boolean} True if logged in
   */
  isLoggedIn() {
    return this.validateSession();
  }
}

// Export singleton instance
const sessionManager = new SessionManager(storageManager);
