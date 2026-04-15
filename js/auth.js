/**
 * Authentication Manager
 * Регистрация, вход, смена пароля — всё через Supabase.
 */

class AuthManager {
  async hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  generateSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── REGISTER ───────────────────────────────────────────────────────────────

  async register(username, password) {
    // 1. Проверяем что сотрудник существует
    const employee = await db_getEmployeeByUsername(username);
    if (!employee) {
      return { success: false, error: 'Пользователь не найден в базе сотрудников', user: null };
    }

    // 2. Проверяем что не зарегистрирован
    const existing = await db_getUserByUsername(username);
    if (existing) {
      return { success: false, error: 'Пользователь уже зарегистрирован', user: null };
    }

    // 3. Валидация пароля
    const validation = policyEngine.validatePassword(password);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', '), user: null };
    }

    // 4. Хэшируем пароль
    const salt = this.generateSalt();
    const passwordHash = await this.hashPassword(password, salt);

    // 5. Создаём пользователя в Supabase
    const newUser = {
      username,
      password_hash: passwordHash,
      salt,
      role: 'user',
      is_active: true,
      failed_attempts: 0,
      locked_until: null,
      last_login: null,
      password_history: [passwordHash],
      mfa_enabled: false,
      mfa_secret: null,
      email: null
    };

    const result = await db_createUser(newUser);
    if (!result.success) {
      return { success: false, error: result.error, user: null };
    }

    return { success: true, error: null, user: result.data };
  }

  // ─── LOGIN ──────────────────────────────────────────────────────────────────

  async login(username, password) {
    const user = await db_getUserByUsername(username);
    if (!user) {
      return { success: false, error: 'Неверное имя пользователя или пароль', user: null };
    }

    const hash = await this.hashPassword(password, user.salt);
    if (hash !== user.password_hash) {
      return { success: false, error: 'Неверное имя пользователя или пароль', user };
    }

    // Обновляем last_login
    await db_updateUser(user.id, { last_login: new Date().toISOString() });
    user.last_login = new Date().toISOString();

    // Нормализуем поля для совместимости с остальным кодом
    return { success: true, error: null, user: this._normalize(user) };
  }

  // ─── CHANGE PASSWORD ────────────────────────────────────────────────────────

  async changePassword(username, oldPassword, newPassword) {
    const user = await db_getUserByUsername(username);
    if (!user) return { success: false, error: 'Пользователь не найден' };

    const oldHash = await this.hashPassword(oldPassword, user.salt);
    if (oldHash !== user.password_hash) return { success: false, error: 'Текущий пароль неверен' };

    const validation = policyEngine.validatePassword(newPassword);
    if (!validation.valid) return { success: false, error: validation.errors.join(', ') };

    const newSalt = this.generateSalt();
    const newHash = await this.hashPassword(newPassword, newSalt);

    const history = user.password_history || [];
    if (policyEngine.isPasswordInHistory(history, newHash)) {
      return { success: false, error: 'Этот пароль уже использовался. Выберите другой.' };
    }

    const policy = policyEngine.getCurrentPolicy();
    history.push(newHash);
    if (history.length > policy.passwordHistoryCount) history.splice(0, history.length - policy.passwordHistoryCount);

    await db_updateUser(user.id, { password_hash: newHash, salt: newSalt, password_history: history });
    return { success: true, error: null };
  }

  // ─── RESET PASSWORD (admin) ─────────────────────────────────────────────────

  async resetPassword(userId, newPassword) {
    const user = await db_getUserById(userId);
    if (!user) return { success: false, error: 'Пользователь не найден' };

    const validation = policyEngine.validatePassword(newPassword);
    if (!validation.valid) return { success: false, error: validation.errors.join(', ') };

    const newSalt = this.generateSalt();
    const newHash = await this.hashPassword(newPassword, newSalt);

    const policy = policyEngine.getCurrentPolicy();
    const history = user.password_history || [];
    history.push(newHash);
    if (history.length > policy.passwordHistoryCount) history.splice(0, history.length - policy.passwordHistoryCount);

    await db_updateUser(userId, { password_hash: newHash, salt: newSalt, password_history: history });
    return { success: true, error: null };
  }

  // ─── GETTERS ────────────────────────────────────────────────────────────────

  async getUser(username) {
    const u = await db_getUserByUsername(username);
    return u ? this._normalize(u) : null;
  }

  async getUserById(id) {
    const u = await db_getUserById(id);
    return u ? this._normalize(u) : null;
  }

  async getAllUsers() {
    const users = await db_getUsers();
    return users.map(u => this._normalize(u));
  }

  async getEmployee(username) {
    return await db_getEmployeeByUsername(username);
  }

  /**
   * Нормализация: snake_case из БД → camelCase для остального кода
   */
  _normalize(u) {
    return {
      id: u.id,
      username: u.username,
      passwordHash: u.password_hash,
      salt: u.salt,
      role: u.role,
      isActive: u.is_active,
      failedAttempts: u.failed_attempts,
      lockedUntil: u.locked_until,
      registeredAt: u.registered_at,
      lastLogin: u.last_login,
      passwordHistory: u.password_history,
      mfaEnabled: u.mfa_enabled,
      email: u.email
    };
  }
}

const authManager = new AuthManager();
