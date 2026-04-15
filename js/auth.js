/**
 * Authentication Manager
 * Handles user registration, login, logout, and password management
 */

class AuthManager {
  constructor(storage, policyEngine) {
    this.storage = storage;
    this.policyEngine = policyEngine;
  }

  /**
   * Hash password using Web Crypto API
   * @param {string} password - Plain text password
   * @param {string} salt - Salt for hashing
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate random salt
   * @returns {string} Random salt
   */
  generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if username exists in employee database
   * @param {string} username - Username to check
   * @returns {boolean} True if employee exists
   */
  isEmployeeExists(username) {
    const employees = this.storage.loadLocal('employees') || [];
    return employees.some(e => e.username === username);
  }

  /**
   * Check if user is already registered
   * @param {string} username - Username to check
   * @returns {boolean} True if user registered
   */
  isUserRegistered(username) {
    const users = this.storage.loadLocal('users') || [];
    return users.some(u => u.username === username);
  }

  /**
   * Get employee data by username
   * @param {string} username - Username
   * @returns {Object|null} Employee data or null
   */
  getEmployee(username) {
    const employees = this.storage.loadLocal('employees') || [];
    return employees.find(e => e.username === username) || null;
  }

  /**
   * Register a new user
   * @param {string} username - Username from employee database
   * @param {string} password - User's chosen password
   * @returns {Promise<Object>} Auth result with success flag and user object or error
   */
  async register(username, password) {
    // Check if employee exists
    if (!this.isEmployeeExists(username)) {
      return {
        success: false,
        error: 'Username not found in employee database',
        user: null
      };
    }

    // Check if already registered
    if (this.isUserRegistered(username)) {
      return {
        success: false,
        error: 'User already registered',
        user: null
      };
    }

    // Validate password against policy
    const validation = this.policyEngine.validatePassword(password);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', '),
        user: null
      };
    }

    // Hash password
    const salt = this.generateSalt();
    const passwordHash = await this.hashPassword(password, salt);

    // Create user account
    const users = this.storage.loadLocal('users') || [];
    const newUser = {
      id: users.length + 1,
      username: username,
      passwordHash: passwordHash,
      salt: salt,
      role: 'user', // Default role
      isActive: true,
      failedAttempts: 0,
      lockedUntil: null,
      registeredAt: new Date().toISOString(),
      lastLogin: null,
      passwordHistory: [passwordHash],
      mfaEnabled: false,
      mfaSecret: null,
      email: null
    };

    users.push(newUser);
    this.storage.saveLocal('users', users);

    return {
      success: true,
      error: null,
      user: newUser
    };
  }

  /**
   * Authenticate user credentials
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} Auth result with success flag and user object or error
   */
  async login(username, password) {
    const users = this.storage.loadLocal('users') || [];
    const user = users.find(u => u.username === username);

    if (!user) {
      return {
        success: false,
        error: 'Invalid credentials',
        user: null
      };
    }

    // Verify password
    const passwordHash = await this.hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) {
      return {
        success: false,
        error: 'Invalid credentials',
        user: user
      };
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    this.storage.saveLocal('users', users);

    return {
      success: true,
      error: null,
      user: user,
      requiresMFA: user.mfaEnabled
    };
  }

  /**
   * Log out current user
   * @returns {void}
   */
  logout() {
    // Session destruction is handled by SessionManager
    // This method is here for completeness
  }

  /**
   * Change user password
   * @param {string} username - Username
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Result with success flag and error message
   */
  async changePassword(username, oldPassword, newPassword) {
    const users = this.storage.loadLocal('users') || [];
    const user = users.find(u => u.username === username);

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Verify old password
    const oldPasswordHash = await this.hashPassword(oldPassword, user.salt);
    if (oldPasswordHash !== user.passwordHash) {
      return {
        success: false,
        error: 'Current password is incorrect'
      };
    }

    // Validate new password against policy
    const validation = this.policyEngine.validatePassword(newPassword);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    // Hash new password
    const newSalt = this.generateSalt();
    const newPasswordHash = await this.hashPassword(newPassword, newSalt);

    // Check password history
    if (this.policyEngine.isPasswordInHistory(username, newPasswordHash)) {
      return {
        success: false,
        error: 'Password has been used recently. Please choose a different password'
      };
    }

    // Update password
    user.passwordHash = newPasswordHash;
    user.salt = newSalt;

    // Update password history
    if (!user.passwordHistory) {
      user.passwordHistory = [];
    }
    user.passwordHistory.push(newPasswordHash);

    // Keep only last N passwords based on policy
    const policy = this.policyEngine.getCurrentPolicy();
    if (user.passwordHistory.length > policy.passwordHistoryCount) {
      user.passwordHistory = user.passwordHistory.slice(-policy.passwordHistoryCount);
    }

    this.storage.saveLocal('users', users);

    return {
      success: true,
      error: null
    };
  }

  /**
   * Reset user password (admin only)
   * @param {number} userId - User ID
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Result with success flag and error message
   */
  async resetPassword(userId, newPassword) {
    const users = this.storage.loadLocal('users') || [];
    const user = users.find(u => u.id === userId);

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Validate new password against policy
    const validation = this.policyEngine.validatePassword(newPassword);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    // Hash new password
    const newSalt = this.generateSalt();
    const newPasswordHash = await this.hashPassword(newPassword, newSalt);

    // Update password
    user.passwordHash = newPasswordHash;
    user.salt = newSalt;

    // Update password history
    if (!user.passwordHistory) {
      user.passwordHistory = [];
    }
    user.passwordHistory.push(newPasswordHash);

    // Keep only last N passwords based on policy
    const policy = this.policyEngine.getCurrentPolicy();
    if (user.passwordHistory.length > policy.passwordHistoryCount) {
      user.passwordHistory = user.passwordHistory.slice(-policy.passwordHistoryCount);
    }

    this.storage.saveLocal('users', users);

    return {
      success: true,
      error: null
    };
  }

  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Object|null} User object or null
   */
  getUser(username) {
    const users = this.storage.loadLocal('users') || [];
    return users.find(u => u.username === username) || null;
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {Object|null} User object or null
   */
  getUserById(userId) {
    const users = this.storage.loadLocal('users') || [];
    return users.find(u => u.id === userId) || null;
  }

  /**
   * Get all users
   * @returns {Array} Array of all users
   */
  getAllUsers() {
    return this.storage.loadLocal('users') || [];
  }
}

// Export singleton instance
const authManager = new AuthManager(storageManager, policyEngine);
