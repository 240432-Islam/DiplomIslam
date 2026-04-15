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
 * Create default super admin users with password Admin123!
 */
async function createDefaultSuperAdmins() {
  const users = storageManager.loadLocal('users') || [];
  
  // Создаём обоих супер-админов с паролем Admin123!
  const superAdmins = [
    { username: 'bekishev.islam', password: 'Admin123!' },
    { username: 'belosanova.amina', password: 'Admin123!' }
  ];
  
  for (const admin of superAdmins) {
    // Проверяем, не зарегистрирован ли уже
    const exists = users.some(u => u.username === admin.username);
    if (!exists) {
      const result = await authManager.register(admin.username, admin.password);
      if (result.success) {
        console.log(`✅ Супер-админ ${admin.username} создан с паролем: Admin123!`);
        
        // Обновляем роль на superadmin
        const updatedUsers = storageManager.loadLocal('users') || [];
        const user = updatedUsers.find(u => u.username === admin.username);
        if (user) {
          user.role = 'superadmin';
          storageManager.saveLocal('users', updatedUsers);
        }
        
        // Логируем создание
        auditLogger.logEvent({
          username: 'system',
          action: 'registration',
          details: `Супер-админ ${admin.username} создан автоматически`,
          status: 'success'
        });
      }
    } else {
      console.log(`ℹ️ Супер-админ ${admin.username} уже существует`);
    }
  }
  
  console.log('');
  console.log('🔐 УЧЕТНЫЕ ДАННЫЕ ДЛЯ ВХОДА:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Username: bekishev.islam');
  console.log('Password: Admin123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Username: belosanova.amina');
  console.log('Password: Admin123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

// Initialize data when script loads
if (typeof storageManager !== 'undefined') {
  initializeData();
}
