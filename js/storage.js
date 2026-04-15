/**
 * Storage Manager
 * localStorage используется ТОЛЬКО для сессии пользователя.
 * Все данные приложения (users, employees, policies, audit_logs) хранятся в Supabase.
 */

class StorageManager {
  // ─── SESSION (остаётся в браузере) ───────────────────────────────────────────

  saveSession(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('saveSession error:', e);
      return false;
    }
  }

  loadSession(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('loadSession error:', e);
      return null;
    }
  }

  removeSession(key) {
    try { sessionStorage.removeItem(key); } catch (e) { console.error(e); }
  }

  destroySession() {
    this.removeSession('currentSession');
  }
}

const storageManager = new StorageManager();
