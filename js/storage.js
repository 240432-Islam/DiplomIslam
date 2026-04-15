/**
 * Storage Manager
 * Provides abstraction layer for LocalStorage and SessionStorage operations
 */

class StorageManager {
  constructor() {
    this.initializeStorage();
  }

  /**
   * Initialize default data structures if not present
   */
  initializeStorage() {
    // Initialize users array if not exists
    if (!this.loadLocal('users')) {
      this.saveLocal('users', []);
    }

    // Initialize employees array if not exists
    if (!this.loadLocal('employees')) {
      this.saveLocal('employees', []);
    }

    // Initialize policies array if not exists
    if (!this.loadLocal('policies')) {
      this.saveLocal('policies', []);
    }

    // Initialize audit logs array if not exists
    if (!this.loadLocal('auditLogs')) {
      this.saveLocal('auditLogs', []);
    }
  }

  /**
   * Save data to LocalStorage
   * @param {string} key - Storage key
   * @param {any} data - Data to store
   * @returns {boolean} Success status
   */
  saveLocal(key, data) {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('LocalStorage quota exceeded');
        return false;
      }
      console.error('Error saving to LocalStorage:', error);
      return false;
    }
  }

  /**
   * Load data from LocalStorage
   * @param {string} key - Storage key
   * @returns {any} Stored data or null
   */
  loadLocal(key) {
    try {
      const serialized = localStorage.getItem(key);
      if (serialized === null) {
        return null;
      }
      return JSON.parse(serialized);
    } catch (error) {
      console.error('Error loading from LocalStorage:', error);
      return null;
    }
  }

  /**
   * Save data to SessionStorage
   * @param {string} key - Storage key
   * @param {any} data - Data to store
   * @returns {boolean} Success status
   */
  saveSession(key, data) {
    try {
      const serialized = JSON.stringify(data);
      sessionStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('SessionStorage quota exceeded');
        return false;
      }
      console.error('Error saving to SessionStorage:', error);
      return false;
    }
  }

  /**
   * Load data from SessionStorage
   * @param {string} key - Storage key
   * @returns {any} Stored data or null
   */
  loadSession(key) {
    try {
      const serialized = sessionStorage.getItem(key);
      if (serialized === null) {
        return null;
      }
      return JSON.parse(serialized);
    } catch (error) {
      console.error('Error loading from SessionStorage:', error);
      return null;
    }
  }

  /**
   * Remove item from LocalStorage
   * @param {string} key - Storage key
   */
  removeLocal(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from LocalStorage:', error);
    }
  }

  /**
   * Remove item from SessionStorage
   * @param {string} key - Storage key
   */
  removeSession(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from SessionStorage:', error);
    }
  }

  /**
   * Clear all storage (LocalStorage and SessionStorage)
   */
  clearAll() {
    try {
      localStorage.clear();
      sessionStorage.clear();
      this.initializeStorage();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Check if storage is available
   * @returns {boolean} True if storage is available
   */
  isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
const storageManager = new StorageManager();
