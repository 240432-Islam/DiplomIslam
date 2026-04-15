/**
 * Account Lockout Manager
 * Блокировки хранятся в Supabase (поля failed_attempts, locked_until).
 */

class LockoutManager {
  /**
   * Записать неудачную попытку входа
   */
  async recordFailedAttempt(username) {
    const user = await db_getUserByUsername(username);
    if (!user) return { isLocked: false, failedAttempts: 0, maxAttempts: 0 };

    const policy = policyEngine.getCurrentPolicy();
    const attempts = (user.failed_attempts || 0) + 1;
    let lockedUntil = null;

    if (attempts >= policy.maxFailedAttempts) {
      lockedUntil = new Date(Date.now() + policy.lockoutDurationMinutes * 60 * 1000).toISOString();
    }

    await db_updateUser(user.id, { failed_attempts: attempts, locked_until: lockedUntil });

    return {
      isLocked: lockedUntil !== null,
      failedAttempts: attempts,
      maxAttempts: policy.maxFailedAttempts,
      lockedUntil,
      remainingMinutes: lockedUntil ? policy.lockoutDurationMinutes : 0
    };
  }

  /**
   * Сбросить счётчик после успешного входа
   */
  async resetFailedAttempts(username) {
    const user = await db_getUserByUsername(username);
    if (user) {
      await db_updateUser(user.id, { failed_attempts: 0, locked_until: null });
    }
  }

  /**
   * Проверить, заблокирован ли аккаунт
   */
  async isAccountLocked(username) {
    const user = await db_getUserByUsername(username);
    const policy = policyEngine.getCurrentPolicy();

    if (!user) {
      return { isLocked: false, failedAttempts: 0, maxAttempts: policy.maxFailedAttempts, lockedUntil: null, remainingMinutes: 0 };
    }

    if (user.locked_until) {
      const lockTime = new Date(user.locked_until).getTime();
      const now = Date.now();

      if (now >= lockTime) {
        // Блокировка истекла — снимаем
        await db_updateUser(user.id, { failed_attempts: 0, locked_until: null });
        return { isLocked: false, failedAttempts: 0, maxAttempts: policy.maxFailedAttempts, lockedUntil: null, remainingMinutes: 0 };
      }

      const remainingMinutes = Math.ceil((lockTime - now) / 60000);
      return {
        isLocked: true,
        failedAttempts: user.failed_attempts,
        maxAttempts: policy.maxFailedAttempts,
        lockedUntil: user.locked_until,
        remainingMinutes
      };
    }

    return {
      isLocked: false,
      failedAttempts: user.failed_attempts || 0,
      maxAttempts: policy.maxFailedAttempts,
      lockedUntil: null,
      remainingMinutes: 0
    };
  }

  /**
   * Разблокировать аккаунт вручную (только admin)
   */
  async unlockAccount(userId) {
    const result = await db_updateUser(userId, { failed_attempts: 0, locked_until: null });
    if (!result.success) return { success: false, error: result.error };
    return { success: true, error: null };
  }
}

const lockoutManager = new LockoutManager();
