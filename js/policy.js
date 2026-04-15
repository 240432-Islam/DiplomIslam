/**
 * Password Policy Engine
 * Политика загружается из Supabase и кэшируется в памяти.
 */

class PolicyEngine {
  constructor() {
    this._cachedPolicy = null;
  }

  /**
   * Загрузить активную политику из Supabase (с кэшем).
   * Используй await везде где нужна политика.
   */
  async loadPolicy() {
    if (this._cachedPolicy) return this._cachedPolicy;
    const policy = await db_getActivePolicy();
    if (policy) {
      this._cachedPolicy = policy;
    } else {
      // Fallback если БД пуста
      this._cachedPolicy = this._defaultPolicy();
    }
    return this._cachedPolicy;
  }

  /** Синхронная версия — только если политика уже закэширована */
  getCurrentPolicy() {
    return this._cachedPolicy || this._defaultPolicy();
  }

  _defaultPolicy() {
    return {
      id: 1, name: 'Default Policy',
      minLength: 8,
      requireUppercase: true, requireLowercase: true,
      requireNumbers: true, requireSpecial: true,
      maxFailedAttempts: 3, lockoutDurationMinutes: 15,
      passwordExpiryDays: 90, passwordHistoryCount: 5,
      isActive: true
    };
  }

  /**
   * Валидация пароля против политики
   */
  validatePassword(password) {
    const policy = this.getCurrentPolicy();
    const errors = [];
    const requirements = { length: false, uppercase: false, lowercase: false, numbers: false, special: false };

    if (password.length >= policy.minLength) { requirements.length = true; }
    else { errors.push(`Минимум ${policy.minLength} символов`); }

    if (policy.requireUppercase) {
      if (/[A-Z]/.test(password)) { requirements.uppercase = true; }
      else { errors.push('Минимум одна заглавная буква'); }
    } else { requirements.uppercase = true; }

    if (policy.requireLowercase) {
      if (/[a-z]/.test(password)) { requirements.lowercase = true; }
      else { errors.push('Минимум одна строчная буква'); }
    } else { requirements.lowercase = true; }

    if (policy.requireNumbers) {
      if (/[0-9]/.test(password)) { requirements.numbers = true; }
      else { errors.push('Минимум одна цифра'); }
    } else { requirements.numbers = true; }

    if (policy.requireSpecial) {
      if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) { requirements.special = true; }
      else { errors.push('Минимум один специальный символ'); }
    } else { requirements.special = true; }

    return { valid: errors.length === 0, errors, requirements };
  }

  /**
   * Обновить политику — сохраняет в Supabase
   */
  async updatePolicy(policyData) {
    const validation = this._validatePolicySettings(policyData);
    if (!validation.valid) return { success: false, error: validation.errors.join(', ') };

    const result = await db_createPolicy(policyData);
    if (result.success) {
      this._cachedPolicy = result.data; // обновить кэш
    }
    return result;
  }

  _validatePolicySettings(p) {
    const errors = [];
    if (p.minLength < 4 || p.minLength > 32) errors.push('Длина пароля: 4–32 символа');
    if (p.maxFailedAttempts < 1 || p.maxFailedAttempts > 10) errors.push('Попыток входа: 1–10');
    if (p.lockoutDurationMinutes < 1 || p.lockoutDurationMinutes > 1440) errors.push('Блокировка: 1–1440 минут');
    if (p.passwordExpiryDays && (p.passwordExpiryDays < 60 || p.passwordExpiryDays > 90)) errors.push('Срок пароля: 60–90 дней');
    if (p.passwordHistoryCount && (p.passwordHistoryCount < 5 || p.passwordHistoryCount > 10)) errors.push('История паролей: 5–10');
    return { valid: errors.length === 0, errors };
  }

  /**
   * Проверить, использовался ли пароль ранее
   */
  isPasswordInHistory(passwordHistory, passwordHash) {
    if (!passwordHistory || !Array.isArray(passwordHistory)) return false;
    return passwordHistory.includes(passwordHash);
  }

  /**
   * Генерация пароля соответствующего политике
   */
  generatePassword() {
    const policy = this.getCurrentPolicy();
    const length = Math.max(policy.minLength, 12);
    const sets = {
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      nums:  '0123456789',
      spec:  '!@#$%^&*()_+-=[]{};\':"|,.<>/?'
    };
    let charset = '';
    let password = '';
    if (policy.requireUppercase) { charset += sets.upper; password += this._rndChar(sets.upper); }
    if (policy.requireLowercase) { charset += sets.lower; password += this._rndChar(sets.lower); }
    if (policy.requireNumbers)   { charset += sets.nums;  password += this._rndChar(sets.nums); }
    if (policy.requireSpecial)   { charset += sets.spec;  password += this._rndChar(sets.spec); }
    for (let i = password.length; i < length; i++) password += this._rndChar(charset);
    return this._shuffle(password);
  }

  _rndChar(str) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return str[a[0] % str.length];
  }

  _shuffle(str) {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      const j = a[0] % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  async getPolicyHistory() {
    return await db_getAllPolicies();
  }
}

const policyEngine = new PolicyEngine();
