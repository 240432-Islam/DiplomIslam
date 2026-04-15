/**
 * Account Lockout Manager
 * Handles failed login attempts, account locking, and unlocking
 */

class LockoutManager {
  constructor(storage, policyEngine) {
    this.storage = storage;
    this.policyEngine = policyEngine;
  }

  /**
   * Record failed login attempt
   * @param {string} username - Username
   * @returns {Object} Lockout status with attempt count and lock status
   */
  recordFailedAttempt(username) {
    const users = this.storage.loadLocal('users') || [];
    const user = users.find(u => u.username === username);

    if (!user) {
      return {
        isLocked: false,
        failedAttempts: 0,
        maxAttempts: 0
      };
    }

    const policy = this.policyEngine.getCurrentPolicy();
    user.failedAttempts = (user.failedAttempts || 0) + 1;

    // Check if max attempts reached
    if (user.failedAttempts >= policy.maxFailedAttempts) {
      // Lock account
      const lockoutDuration = policy.lockoutDurationMinutes * 60 * 1000; // Convert to milliseconds
      user.lockedUntil = new Date(Date.now() + lockoutDuration).toISOString();
    }

    this.storage.saveLocal('users', users);

    return {
      isLocked: user.lockedUntil !== null,
      failedAttempts: user.failedAttempts,
      maxAttempts: policy.maxFailedAttempts,
      lockedUntil: user.lockedUntil
    };
  }

  /**
   * Reset failed attempts on successful login
   * @param {string} username - Username
   * @returns {void}
   */
  resetFailedAttempts(username) {
    const users = this.storage.loadLocal('users') || [];
    const user = users.find(u => u.username === username);

    if (user) {
      user.failedAttempts = 0;
      user.lockedUntil = null;
      this.storage.saveLocal('users', users);
    }
  }

  /**
   * Check if account is locked
   * @param {string} username - Username
   * @returns {Object} Lock status and remaining time
   */
  isAccountLocked(username) {
    const users = this.storage.loadLocal('users') || [];
    const user = users.find(u => u.username === username);

    if (!user) {
      return {
        isLocked: false,
        failedAttempts: 0,
        maxAttempts: 0,
        lockedUntil: null,
        remainingMinutes: 0
      };
    }

    // Check if lockout expired
    if (user.lockedUntil) {
      const lockoutTime = new Date(user.lockedUntil).getTime();
      const now = Date.now();

      if (now >= lockoutTime) {
        // Lockout expired, auto-unlock
        this.resetFailedAttempts(username);
        return {
          isLocked: false,
          failedAttempts: 0,
          maxAttempts: this.policyEngine.getCurrentPolicy().maxFailedAttempts,
          lockedUntil: null,
          remainingMinutes: 0
        };
      }

      // Still locked
      const remainingMs = lockoutTime - now;
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

      return {
        isLocked: true,
        failedAttempts: user.failedAttempts,
        maxAttempts: this.policyEngine.getCurrentPolicy().maxFailedAttempts,
        lockedUntil: user.lockedUntil,
        remainingMinutes: remainingMinutes
      };
    }

    return {
      isLocked: false,
      failedAttempts: user.failedAttempts || 0,
      maxAttempts: this.policyEngine.getCurrentPolicy().maxFailedAttempts,
      lockedUntil: null,
      remainingMinutes: 0
    };
  }

  /**
   * Manually unlock account (admin only)
   * @param {number} userId - User ID
   * @returns {Object} Result with success flag
   */
  unlockAccount(userId) {
    const users = this.storage.loadLocal('users') || [];
    const user = users.find(u => u.id === userId);

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;
    this.storage.saveLocal('users', users);

    return {
      success: true,
      error: null
    };
  }

  /**
   * Check and auto-unlock expired lockouts
   * @param {string} username - Username
   * @returns {boolean} True if unlocked
   */
  checkLockoutExpiration(username) {
    const lockoutInfo = this.isAccountLocked(username);
    return !lockoutInfo.isLocked;
  }
}

// Export singleton instance
const lockoutManager = new LockoutManager(storageManager, policyEngine);
