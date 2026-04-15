/**
 * Password Policy Engine
 * Handles password validation, policy management, and password generation
 */

class PolicyEngine {
  constructor(storage) {
    this.storage = storage;
    this.initializeDefaultPolicy();
  }

  /**
   * Initialize default password policy if not exists
   */
  initializeDefaultPolicy() {
    const policies = this.storage.loadLocal('policies') || [];
    if (policies.length === 0) {
      const defaultPolicy = {
        id: 1,
        name: 'Default Policy',
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecial: true,
        maxFailedAttempts: 3,
        lockoutDurationMinutes: 15,
        passwordExpiryDays: 90,
        passwordHistoryCount: 5,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      };
      policies.push(defaultPolicy);
      this.storage.saveLocal('policies', policies);
    }
  }

  /**
   * Get current active password policy
   * @returns {Object} Current policy configuration
   */
  getCurrentPolicy() {
    const policies = this.storage.loadLocal('policies') || [];
    return policies.find(p => p.isActive) || policies[0];
  }

  /**
   * Validate password against current policy
   * @param {string} password - Password to validate
   * @returns {Object} Validation result with valid flag and error messages
   */
  validatePassword(password) {
    const policy = this.getCurrentPolicy();
    const errors = [];
    const requirements = {
      length: false,
      uppercase: false,
      lowercase: false,
      numbers: false,
      special: false
    };

    // Check length
    if (password.length >= policy.minLength) {
      requirements.length = true;
    } else {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    // Check uppercase
    if (policy.requireUppercase) {
      if (/[A-Z]/.test(password)) {
        requirements.uppercase = true;
      } else {
        errors.push('Password must contain at least one uppercase letter');
      }
    } else {
      requirements.uppercase = true;
    }

    // Check lowercase
    if (policy.requireLowercase) {
      if (/[a-z]/.test(password)) {
        requirements.lowercase = true;
      } else {
        errors.push('Password must contain at least one lowercase letter');
      }
    } else {
      requirements.lowercase = true;
    }

    // Check numbers
    if (policy.requireNumbers) {
      if (/[0-9]/.test(password)) {
        requirements.numbers = true;
      } else {
        errors.push('Password must contain at least one number');
      }
    } else {
      requirements.numbers = true;
    }

    // Check special characters
    if (policy.requireSpecial) {
      if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        requirements.special = true;
      } else {
        errors.push('Password must contain at least one special character');
      }
    } else {
      requirements.special = true;
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      requirements: requirements
    };
  }

  /**
   * Update password policy (admin only)
   * @param {Object} policyData - New policy configuration
   * @returns {Object} Result with success flag and error message
   */
  updatePolicy(policyData) {
    // Validate policy settings
    const validation = this.validatePolicySettings(policyData);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    const policies = this.storage.loadLocal('policies') || [];
    
    // Deactivate current policy
    policies.forEach(p => p.isActive = false);

    // Create new policy
    const newPolicy = {
      id: policies.length + 1,
      name: policyData.name || `Policy ${policies.length + 1}`,
      minLength: policyData.minLength,
      requireUppercase: policyData.requireUppercase,
      requireLowercase: policyData.requireLowercase,
      requireNumbers: policyData.requireNumbers,
      requireSpecial: policyData.requireSpecial,
      maxFailedAttempts: policyData.maxFailedAttempts,
      lockoutDurationMinutes: policyData.lockoutDurationMinutes,
      passwordExpiryDays: policyData.passwordExpiryDays || 90,
      passwordHistoryCount: policyData.passwordHistoryCount || 5,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: policyData.createdBy || 'admin'
    };

    policies.push(newPolicy);
    this.storage.saveLocal('policies', policies);

    return {
      success: true,
      policy: newPolicy
    };
  }

  /**
   * Validate policy settings within allowed ranges
   * @param {Object} policyData - Policy configuration to validate
   * @returns {Object} Validation result
   */
  validatePolicySettings(policyData) {
    const errors = [];

    // Validate minLength (4-32)
    if (policyData.minLength < 4 || policyData.minLength > 32) {
      errors.push('Minimum password length must be between 4 and 32 characters');
    }

    // Validate maxFailedAttempts (1-10)
    if (policyData.maxFailedAttempts < 1 || policyData.maxFailedAttempts > 10) {
      errors.push('Maximum failed attempts must be between 1 and 10');
    }

    // Validate lockoutDurationMinutes (1-1440)
    if (policyData.lockoutDurationMinutes < 1 || policyData.lockoutDurationMinutes > 1440) {
      errors.push('Lockout duration must be between 1 and 1440 minutes');
    }

    // Validate passwordExpiryDays (60-90) if provided
    if (policyData.passwordExpiryDays && (policyData.passwordExpiryDays < 60 || policyData.passwordExpiryDays > 90)) {
      errors.push('Password expiry period must be between 60 and 90 days');
    }

    // Validate passwordHistoryCount (5-10) if provided
    if (policyData.passwordHistoryCount && (policyData.passwordHistoryCount < 5 || policyData.passwordHistoryCount > 10)) {
      errors.push('Password history count must be between 5 and 10');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Generate compliant password
   * @returns {string} Generated password meeting all requirements
   */
  generatePassword() {
    const policy = this.getCurrentPolicy();
    const length = Math.max(policy.minLength, 12); // At least 12 characters
    
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{};\':"|,.<>/?';
    
    let charset = '';
    let password = '';
    
    // Add required character types
    if (policy.requireUppercase) {
      charset += uppercase;
      password += this.getRandomChar(uppercase);
    }
    
    if (policy.requireLowercase) {
      charset += lowercase;
      password += this.getRandomChar(lowercase);
    }
    
    if (policy.requireNumbers) {
      charset += numbers;
      password += this.getRandomChar(numbers);
    }
    
    if (policy.requireSpecial) {
      charset += special;
      password += this.getRandomChar(special);
    }
    
    // Fill remaining length with random characters from charset
    for (let i = password.length; i < length; i++) {
      password += this.getRandomChar(charset);
    }
    
    // Shuffle password to randomize character positions
    password = this.shuffleString(password);
    
    return password;
  }

  /**
   * Get random character from string using crypto API
   * @param {string} str - String to pick from
   * @returns {string} Random character
   */
  getRandomChar(str) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return str[array[0] % str.length];
  }

  /**
   * Shuffle string using Fisher-Yates algorithm
   * @param {string} str - String to shuffle
   * @returns {string} Shuffled string
   */
  shuffleString(str) {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      const j = array[0] % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  /**
   * Check if password is in user's password history
   * @param {string} username - Username
   * @param {string} passwordHash - Password hash to check
   * @returns {boolean} True if password in history
   */
  isPasswordInHistory(username, passwordHash) {
    const users = this.storage.loadLocal('users') || [];
    const user = users.find(u => u.username === username);
    
    if (!user || !user.passwordHistory) {
      return false;
    }
    
    return user.passwordHistory.includes(passwordHash);
  }

  /**
   * Get policy history
   * @returns {Array} Array of all policies
   */
  getPolicyHistory() {
    return this.storage.loadLocal('policies') || [];
  }
}

// Export singleton instance
const policyEngine = new PolicyEngine(storageManager);
