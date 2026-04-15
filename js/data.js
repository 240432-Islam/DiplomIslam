/**
 * Initial Data Setup
 * Создаёт супер-администраторов в Supabase при первом запуске.
 */

async function initializeData() {
  console.log('🚀 Инициализация приложения TURAN...');

  // 1. Загружаем политику из Supabase в кэш
  await policyEngine.loadPolicy();
  console.log('✅ Политика паролей загружена');

  // 2. Создаём супер-админов если их нет
  const superAdmins = [
    { username: 'bekishev.islam',   password: 'Admin123!' },
    { username: 'belosanova.amina', password: 'Admin123!' }
  ];

  for (const admin of superAdmins) {
    const existing = await db_getUserByUsername(admin.username);
    if (!existing) {
      console.log(`🔄 Создание супер-администратора: ${admin.username}`);
      const result = await authManager.register(admin.username, admin.password);
      if (result.success) {
        // Устанавливаем роль superadmin
        await db_updateUser(result.user.id, { role: 'superadmin' });
        console.log(`✅ ${admin.username} создан`);

        await auditLogger.logEvent({
          username: 'system',
          action: 'registration',
          details: `Супер-администратор ${admin.username} создан автоматически`,
          status: 'success'
        });
      } else {
        console.warn(`⚠️ Не удалось создать ${admin.username}:`, result.error);
      }
    } else {
      console.log(`ℹ️ ${admin.username} уже существует`);
    }
  }

  console.log('');
  console.log('🔐 УЧЁТНЫЕ ДАННЫЕ:');
  console.log('Username: bekishev.islam   | Password: Admin123!');
  console.log('Username: belosanova.amina | Password: Admin123!');
}
