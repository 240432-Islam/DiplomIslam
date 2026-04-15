/**
 * Session Manager
 * Сессия хранится в sessionStorage браузера (не в Supabase).
 * При закрытии вкладки сессия автоматически уничтожается.
 */

class SessionManager {
  constructor() {
    this.sessionTimeout = 30 * 60 * 1000; // 30 минут
  }

  _generateId() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  createSession(user) {
    const session = {
      sessionId: this._generateId(),
      userId: user.id,
      username: user.username,
      role: user.role,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString()
    };
    storageManager.saveSession('currentSession', session);
    return session;
  }

  getCurrentSession() {
    return storageManager.loadSession('currentSession');
  }

  destroySession() {
    storageManager.removeSession('currentSession');
  }

  isSessionExpired() {
    const session = this.getCurrentSession();
    if (!session) return true;
    return Date.now() >= new Date(session.expiresAt).getTime();
  }

  refreshSession() {
    const session = this.getCurrentSession();
    if (session) {
      session.lastActivity = new Date().toISOString();
      session.expiresAt = new Date(Date.now() + this.sessionTimeout).toISOString();
      storageManager.saveSession('currentSession', session);
    }
  }

  validateSession() {
    const session = this.getCurrentSession();
    if (!session) return false;
    if (this.isSessionExpired()) { this.destroySession(); return false; }
    this.refreshSession();
    return true;
  }

  getCurrentUser() {
    const session = this.getCurrentSession();
    if (!session) return null;
    return { id: session.userId, username: session.username, role: session.role };
  }

  isLoggedIn() {
    return this.validateSession();
  }
}

const sessionManager = new SessionManager();
