/**
 * Main Application Logic — TURAN
 * Все операции с данными асинхронные (await Supabase).
 */

let currentView = 'auth';
let currentUser = null;

// ─── INIT ────────────────────────────────────────────────────────────────────

async function initApp() {
  if (sessionManager.isLoggedIn()) {
    currentUser = sessionManager.getCurrentUser();
    // Дозагружаем политику в кэш
    await policyEngine.loadPolicy();
    showDashboard();
  } else {
    // Инициализируем данные (первый запуск создаёт супер-админов)
    await initializeData();
    showAuthPage();
  }
}

// ─── AUTH PAGE ───────────────────────────────────────────────────────────────

function showAuthPage() {
  currentView = 'auth';
  document.getElementById('auth-page').style.display = 'block';
  document.getElementById('main-app').style.display = 'none';
  showLoginForm();
}

function showLoginForm() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-tab').classList.add('active');
  document.getElementById('register-tab').classList.remove('active');
  clearMessages();
}

function showRegisterForm() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
  document.getElementById('login-tab').classList.remove('active');
  document.getElementById('register-tab').classList.add('active');
  clearMessages();
  updatePasswordRequirements();
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────

async function handleLogin(event) {
  event.preventDefault();
  clearMessages();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Вход...';

  try {
    // Проверяем блокировку
    const lockoutInfo = await lockoutManager.isAccountLocked(username);
    if (lockoutInfo.isLocked) {
      showError('login-error', `Аккаунт заблокирован. Попробуйте через ${lockoutInfo.remainingMinutes} мин.`);
      await auditLogger.logEvent({ username, action: 'login', details: 'Попытка входа в заблокированный аккаунт', status: 'error' });
      return;
    }

    const result = await authManager.login(username, password);

    if (result.success) {
      await lockoutManager.resetFailedAttempts(username);
      sessionManager.createSession(result.user);
      currentUser = result.user;
      await auditLogger.logEvent({ username, action: 'login', details: 'Успешный вход', status: 'success' });
      showDashboard();
    } else {
      const lockoutStatus = await lockoutManager.recordFailedAttempt(username);
      await auditLogger.logEvent({
        username, action: 'login',
        details: `Неудачная попытка (${lockoutStatus.failedAttempts}/${lockoutStatus.maxAttempts})`,
        status: 'error'
      });

      if (lockoutStatus.isLocked) {
        showError('login-error', `Аккаунт заблокирован на ${lockoutStatus.remainingMinutes} мин. из-за множества неудачных попыток.`);
        await auditLogger.logEvent({ username, action: 'account_lockout', details: `Заблокирован после ${lockoutStatus.maxAttempts} попыток`, status: 'error' });
      } else {
        showError('login-error', `${result.error}. Попытка ${lockoutStatus.failedAttempts} из ${lockoutStatus.maxAttempts}.`);
      }
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Войти';
  }
}

// ─── REGISTER ────────────────────────────────────────────────────────────────

async function handleRegister(event) {
  event.preventDefault();
  clearMessages();

  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  const btn = document.getElementById('register-submit');

  if (password !== confirmPassword) {
    showError('register-error', 'Пароли не совпадают');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Регистрация...';

  try {
    const result = await authManager.register(username, password);

    if (result.success) {
      await auditLogger.logEvent({ username, action: 'registration', details: 'Пользователь зарегистрирован', status: 'success' });
      showSuccess('register-success', 'Регистрация прошла успешно! Выполните вход.');
      document.getElementById('register-form-element').reset();
      setTimeout(() => showLoginForm(), 2000);
    } else {
      showError('register-error', result.error);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Зарегистрироваться';
  }
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function showDashboard() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  updateUserInfo();
  navigateTo('dashboard');
}

async function updateUserInfo() {
  const employee = await authManager.getEmployee(currentUser.username);
  document.getElementById('user-name').textContent = employee ? employee.full_name : currentUser.username;
  document.getElementById('user-role').textContent = rbacManager.getRoleDisplayName(currentUser.role);

  document.querySelectorAll('.admin-only').forEach(item => {
    item.style.display = rbacManager.hasPermission(currentUser.role, item.dataset.feature) ? 'block' : 'none';
  });
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────

function navigateTo(view) {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

  const el = document.getElementById(`${view}-view`);
  if (el) el.style.display = 'block';

  const mi = document.querySelector(`[data-view="${view}"]`);
  if (mi) mi.classList.add('active');

  const loaders = {
    dashboard: loadDashboard,
    profile: loadProfile,
    'policy-config': loadPolicyConfig,
    'user-management': loadUserManagement,
    'employee-database': loadEmployeeDatabase,
    'audit-logs': loadAuditLogs
  };
  if (loaders[view]) loaders[view]();
}

// ─── VIEWS ───────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const [employees, users, auditLogs] = await Promise.all([
    db_getEmployees(),
    authManager.getAllUsers(),
    auditLogger.getAuditLogs()
  ]);
  const policy = policyEngine.getCurrentPolicy();

  const lockedUsers = users.filter(u => u.lockedUntil && new Date(u.lockedUntil) > new Date());
  const failedLogins = auditLogs.filter(l => l.action === 'login' && l.status === 'error').length;

  document.getElementById('stat-total-employees').textContent = employees.length;
  document.getElementById('stat-registered-users').textContent = users.length;
  document.getElementById('stat-unregistered').textContent = employees.length - users.length;
  document.getElementById('stat-locked-users').textContent = lockedUsers.length;
  document.getElementById('stat-failed-logins').textContent = failedLogins;
  document.getElementById('stat-max-attempts').textContent = policy.maxFailedAttempts;

  const recent = auditLogs.slice(0, 5);
  document.getElementById('recent-activity-table').innerHTML = recent.map(a =>
    `<tr>
      <td>${new Date(a.timestamp).toLocaleTimeString()}</td>
      <td>${a.username}</td>
      <td>${auditLogger.getActionDisplayName(a.action)}</td>
      <td><span class="badge badge-${a.status}">${a.status}</span></td>
    </tr>`
  ).join('');
}

async function loadProfile() {
  const [user, employee] = await Promise.all([
    authManager.getUser(currentUser.username),
    authManager.getEmployee(currentUser.username)
  ]);

  if (user && employee) {
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('profile-fullname').textContent = employee.full_name;
    document.getElementById('profile-department').textContent = employee.department;
    document.getElementById('profile-position').textContent = employee.position;
    document.getElementById('profile-role').textContent = rbacManager.getRoleDisplayName(user.role);
    document.getElementById('profile-registered').textContent = new Date(user.registeredAt).toLocaleString();
    document.getElementById('profile-last-login').textContent = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Никогда';
  }
}

async function handlePasswordChange(event) {
  event.preventDefault();
  clearMessages();
  const old = document.getElementById('old-password').value;
  const nw  = document.getElementById('new-password').value;
  const cf  = document.getElementById('confirm-new-password').value;

  if (nw !== cf) { showError('password-change-error', 'Пароли не совпадают'); return; }

  const result = await authManager.changePassword(currentUser.username, old, nw);
  if (result.success) {
    await auditLogger.logEvent({ username: currentUser.username, action: 'password_change', details: 'Пароль изменён', status: 'success' });
    showSuccess('password-change-success', 'Пароль успешно изменён!');
    document.getElementById('password-change-form').reset();
  } else {
    showError('password-change-error', result.error);
  }
}

function loadPolicyConfig() {
  const policy = policyEngine.getCurrentPolicy();
  document.getElementById('policy-min-length').value = policy.minLength;
  document.getElementById('policy-uppercase').checked = policy.requireUppercase;
  document.getElementById('policy-lowercase').checked = policy.requireLowercase;
  document.getElementById('policy-numbers').checked = policy.requireNumbers;
  document.getElementById('policy-special').checked = policy.requireSpecial;
  document.getElementById('policy-max-attempts').value = policy.maxFailedAttempts;
  document.getElementById('policy-lockout-duration').value = policy.lockoutDurationMinutes;
}

async function handlePolicyUpdate(event) {
  event.preventDefault();
  clearMessages();
  const policyData = {
    minLength: parseInt(document.getElementById('policy-min-length').value),
    requireUppercase: document.getElementById('policy-uppercase').checked,
    requireLowercase: document.getElementById('policy-lowercase').checked,
    requireNumbers: document.getElementById('policy-numbers').checked,
    requireSpecial: document.getElementById('policy-special').checked,
    maxFailedAttempts: parseInt(document.getElementById('policy-max-attempts').value),
    lockoutDurationMinutes: parseInt(document.getElementById('policy-lockout-duration').value),
    createdBy: currentUser.username
  };

  const result = await policyEngine.updatePolicy(policyData);
  if (result.success) {
    await auditLogger.logEvent({ username: currentUser.username, action: 'policy_change', details: `minLength=${policyData.minLength}, maxAttempts=${policyData.maxFailedAttempts}`, status: 'success' });
    showSuccess('policy-success', 'Политика успешно обновлена!');
  } else {
    showError('policy-error', result.error);
  }
}

async function loadUserManagement() {
  const [users, employees] = await Promise.all([
    authManager.getAllUsers(),
    db_getEmployees()
  ]);

  document.getElementById('users-table').innerHTML = await Promise.all(users.map(async user => {
    const emp = employees.find(e => e.username === user.username);
    const li  = await lockoutManager.isAccountLocked(user.username);
    return `<tr>
      <td>${user.username}</td>
      <td>${emp ? emp.full_name : 'Unknown'}</td>
      <td>${emp ? emp.department : '-'}</td>
      <td>
        <select onchange="changeUserRole(${user.id}, this.value)" style="padding:4px;border-radius:4px;border:1px solid #ddd;">
          <option value="user"     ${user.role==='user'     ?'selected':''}>User</option>
          <option value="operator" ${user.role==='operator' ?'selected':''}>Operator</option>
          <option value="admin"    ${user.role==='admin'    ?'selected':''}>Admin</option>
        </select>
      </td>
      <td>${user.failedAttempts || 0}</td>
      <td><span class="badge badge-${li.isLocked?'error':'success'}">${li.isLocked?'Заблокирован':'Активен'}</span></td>
      <td>
        ${li.isLocked ? `<button class="btn btn-sm" onclick="unlockUser(${user.id})">Разблокировать</button>` : ''}
        <button class="btn btn-sm" onclick="showResetPasswordModal(${user.id})">Сброс пароля</button>
      </td>
    </tr>`;
  })).then(rows => rows.join(''));
}

async function changeUserRole(userId, role) {
  const result = await rbacManager.assignRole(userId, role);
  if (result.success) {
    const user = await authManager.getUserById(userId);
    await auditLogger.logEvent({ username: currentUser.username, action: 'role_change', details: `${user.username} → ${role}`, status: 'success' });
  }
}

async function unlockUser(userId) {
  const result = await lockoutManager.unlockAccount(userId);
  if (result.success) {
    const user = await authManager.getUserById(userId);
    await auditLogger.logEvent({ username: currentUser.username, action: 'account_unlock', details: `Разблокирован: ${user.username}`, status: 'success' });
    loadUserManagement();
  } else {
    alert('Ошибка: ' + result.error);
  }
}

function showResetPasswordModal(userId) {
  const pw = prompt('Введите новый пароль для пользователя:');
  if (pw) resetUserPassword(userId, pw);
}

async function resetUserPassword(userId, newPassword) {
  const result = await authManager.resetPassword(userId, newPassword);
  if (result.success) {
    const user = await authManager.getUserById(userId);
    await auditLogger.logEvent({ username: currentUser.username, action: 'password_reset', details: `Сброс пароля: ${user.username}`, status: 'success' });
    alert('Пароль успешно сброшен!');
    loadUserManagement();
  } else {
    alert('Ошибка: ' + result.error);
  }
}

async function loadEmployeeDatabase() {
  const [employees, users] = await Promise.all([db_getEmployees(), authManager.getAllUsers()]);
  document.getElementById('employees-table').innerHTML = employees.map(e => {
    const isReg = users.some(u => u.username === e.username);
    return `<tr>
      <td>${e.username}</td>
      <td>${e.full_name}</td>
      <td>${e.department}</td>
      <td>${e.position}</td>
      <td><span class="badge badge-${isReg?'success':'warning'}">${isReg?'Зарегистрирован':'Не зарегистрирован'}</span></td>
    </tr>`;
  }).join('');
}

async function loadAuditLogs() {
  const [stats, logs] = await Promise.all([
    auditLogger.getAuditStats(),
    auditLogger.getAuditLogs()
  ]);

  document.getElementById('audit-stats-table').innerHTML = stats.map(s =>
    `<tr><td>${auditLogger.getActionDisplayName(s.action)}</td><td>${s.total}</td><td>${s.successful}</td><td>${s.failed}</td></tr>`
  ).join('');

  document.getElementById('audit-logs-table').innerHTML = logs.map(l =>
    `<tr>
      <td>${new Date(l.timestamp).toLocaleString()}</td>
      <td>${l.username}</td>
      <td>${auditLogger.getActionDisplayName(l.action)}</td>
      <td>${l.details}</td>
      <td>${l.ip}</td>
      <td><span class="badge badge-${l.status}">${l.status}</span></td>
    </tr>`
  ).join('');
}

async function handleLogout() {
  await auditLogger.logEvent({ username: currentUser.username, action: 'logout', details: 'Пользователь вышел', status: 'success' });
  sessionManager.destroySession();
  currentUser = null;
  showAuthPage();
}

// ─── PASSWORD UI ─────────────────────────────────────────────────────────────

function updatePasswordRequirements() {
  const policy = policyEngine.getCurrentPolicy();
  const reqs = [
    `Минимум ${policy.minLength} символов`,
    policy.requireUppercase ? 'Одна заглавная буква' : null,
    policy.requireLowercase ? 'Одна строчная буква'  : null,
    policy.requireNumbers   ? 'Одна цифра'           : null,
    policy.requireSpecial   ? 'Один спецсимвол'      : null
  ].filter(Boolean);
  document.getElementById('password-requirements').innerHTML = reqs.map(r => `<li>${r}</li>`).join('');
}

function validatePasswordRealtime() {
  const password = document.getElementById('register-password').value;
  const v = policyEngine.validatePassword(password);
  document.getElementById('req-length').className   = 'indicator ' + (v.requirements.length    ? 'valid' : 'invalid');
  document.getElementById('req-uppercase').className = 'indicator ' + (v.requirements.uppercase ? 'valid' : 'invalid');
  document.getElementById('req-lowercase').className = 'indicator ' + (v.requirements.lowercase ? 'valid' : 'invalid');
  document.getElementById('req-numbers').className   = 'indicator ' + (v.requirements.numbers   ? 'valid' : 'invalid');
  document.getElementById('req-special').className   = 'indicator ' + (v.requirements.special   ? 'valid' : 'invalid');
  document.getElementById('register-submit').disabled = !v.valid;
}

function generatePassword() {
  const pw = policyEngine.generatePassword();
  document.getElementById('register-password').value = pw;
  document.getElementById('register-confirm-password').value = pw;
  validatePasswordRealtime();
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function showError(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = 'block'; } }
function showSuccess(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = 'block'; } }
function clearMessages() { document.querySelectorAll('.error-message,.success-message').forEach(el => { el.style.display = 'none'; el.textContent = ''; }); }

document.addEventListener('DOMContentLoaded', initApp);
