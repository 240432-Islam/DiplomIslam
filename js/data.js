/**
 * Initial Data Setup
 * Super Administrators Only
 */

// Super Admin database (only 2 super administrators)
const employeeData = [
  { id: 1, username: 'bekishev.islam', fullName: 'Бекишев Ислам', department: 'IT', position: 'Super Administrator' },
  { id: 2, username: 'belosanova.amina', fullName: 'Белосанова Амина', department: 'IT', position: 'Super Administrator' }
];

/**
 * Initialize application data
 */
async function initializeData() {
  // Initialize employee database
  const existingEmployees = storageManager.loadLocal('employees');
  if (!existingEmployees || existingEmployees.length === 0) {
    storageManager.saveLocal('employees', employeeData);
    console.log('Super Admin database initialized with', employeeData.length, 'administrators');
  }

  // Create default super admin users if not exists
  const users = storageManager.loadLocal('users') || [];
  if (users.length === 0) {
    await createDefaultSuperAdmins();
  }
}

/**
 * Create default super admin users
 */
async function createDefaultSuperAdmins() {
  // Note: Users need to register themselves with their chosen passwords
  // This just ensures the employee records exist
  console.log('Super Admin employees ready for registration');
  console.log('Available usernames: bekishev.islam, belosanova.amina');
  
  // Log system initialization
  auditLogger.logEvent({
    username: 'system',
    action: 'system_init',
    details: 'System initialized with super admin employees',
    status: 'success'
  });
}

// Initialize data when script loads
if (typeof storageManager !== 'undefined') {
  initializeData();
}
