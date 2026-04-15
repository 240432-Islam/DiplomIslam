/**
 * Main Application Logic
 * Handles UI rendering, routing, and user interactions
 */

// Current view state
let currentView = 'auth';
let currentUser = null;

/**
 * Initialize application
 */
function initApp() {
  // Check if user is logged in
  if (sessionManager.isLoggedIn()) {
    currentUser = sessionManager.getCurrentUser();
    showDashboard();
  } else {
    showAuthPage();
  }
}

/**
 * Show authentication page (login/registration)
 */
function showAuthPage() {
  currentView = 'auth';
  document.getElementById('auth-page').style.display = 'block';
  document.getElementById('main-app').style.display = 'none';
  
  // Show login tab by default
  showLoginForm();
}

/**
 * Show login form
 */
function showLoginForm() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-tab').classList.add('active');
  document.getElementById('register-tab').classList.remove('active');
  clearMessages();
}

/**
 * Show registration form
 */
function showRegisterForm() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
  document.getElementById('login-tab').classList.remove('active');
  document.getElementById('register-tab').classList.add('active');
  clearMessages();
  updatePasswordRequirements();
}

/**
 * Handle login
 */
async function handleLogin(event) {
  event.preventDefault();
  clearMessages();
  
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  
  // Check if account is locked
  const lockoutInfo = lockoutManager.isAccountLocked(username);
  if (lockoutInfo.isLocked) {
    showError('login-error', `Account is locked. Please try again in ${lockoutInfo.remainingMinutes} minutes.`);
    auditLogger.logEvent({
      username: username,
      action: 'login',
      details: 'Login attempt on locked account',
      status: 'error'
    });
    return;
  }
  
  // Attempt login
  const result = await authManager.login(username, password);
  
  if (result.success) {
    // Reset failed attempts
    lockoutManager.resetFailedAttempts(username);
    
    // Create session
    sessionManager.createSession(result.user);
    currentUser = result.user;
    
    // Log successful login
    auditLogger.logEvent({
      username: username,
      action: 'login',
      details: 'Successful login',
      status: 'success'
    });
    
    // Show main app
    showDashboard();
  } else {
    // Record failed attempt
    const lockoutStatus = lockoutManager.recordFailedAttempt(username);
    
    // Log failed login
    auditLogger.logEvent({
      username: username,
      action: 'login',
      details: `Failed login attempt (${lockoutStatus.failedAttempts}/${lockoutStatus.maxAttempts})`,
      status: 'error'
    });
    
    if (lockoutStatus.isLocked) {
      showError('login-error', `Account locked due to too many failed attempts. Try again in ${lockoutStatus.remainingMinutes} minutes.`);
      
      // Log lockout
      auditLogger.logEvent({
        username: username,
        action: 'account_lockout',
        details: `Account locked after ${lockoutStatus.maxAttempts} failed attempts`,
        status: 'error'
      });
    } else {
      showError('login-error', `${result.error}. Attempt ${lockoutStatus.failedAttempts} of ${lockoutStatus.maxAttempts}.`);
    }
  }
}

/**
 * Handle registration
 */
async function handleRegister(event) {
  event.preventDefault();
  clearMessages();
  
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  
  // Check password confirmation
  if (password !== confirmPassword) {
    showError('register-error', 'Passwords do not match');
    return;
  }
  
  // Attempt registration
  const result = await authManager.register(username, password);
  
  if (result.success) {
    // Log registration
    auditLogger.logEvent({
      username: username,
      action: 'registration',
      details: 'User registered successfully',
      status: 'success'
    });
    
    showSuccess('register-success', 'Registration successful! Please login.');
    
    // Clear form and switch to login
    document.getElementById('register-form-element').reset();
    setTimeout(() => {
      showLoginForm();
    }, 2000);
  } else {
    showError('register-error', result.error);
  }
}

/**
 * Show main application
 */
function showDashboard() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  
  // Update user info in sidebar
  updateUserInfo();
  
  // Show dashboard view
  navigateTo('dashboard');
}

/**
 * Update user info in sidebar
 */
function updateUserInfo() {
  const employee = authManager.getEmployee(currentUser.username);
  document.getElementById('user-name').textContent = employee ? employee.fullName : currentUser.username;
  document.getElementById('user-role').textContent = rbacManager.getRoleDisplayName(currentUser.role);
  
  // Show/hide admin menu items
  const adminMenuItems = document.querySelectorAll('.admin-only');
  adminMenuItems.forEach(item => {
    if (rbacManager.hasPermission(currentUser.role, item.dataset.feature)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Navigate to view
 */
function navigateTo(view) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  
  // Remove active class from all menu items
  document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
  
  // Show selected view
  const viewElement = document.getElementById(`${view}-view`);
  if (viewElement) {
    viewElement.style.display = 'block';
  }
  
  // Add active class to menu item
  const menuItem = document.querySelector(`[data-view="${view}"]`);
  if (menuItem) {
    menuItem.classList.add('active');
  }
  
  // Load view data
  switch(view) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'profile':
      loadProfile();
      break;
    case 'policy-config':
      loadPolicyConfig();
      break;
    case 'user-management':
      loadUserManagement();
      break;
    case 'employee-database':
      loadEmployeeDatabase();
      break;
    case 'audit-logs':
      loadAuditLogs();
      break;
  }
}

/**
 * Load dashboard data
 */
function loadDashboard() {
  const employees = storageManager.loadLocal('employees') || [];
  const users = storageManager.loadLocal('users') || [];
  const policy = policyEngine.getCurrentPolicy();
  const auditLogs = auditLogger.getAuditLogs();
  
  // Calculate statistics
  const lockedUsers = users.filter(u => {
    if (!u.lockedUntil) return false;
    return new Date(u.lockedUntil) > new Date();
  });
  
  const failedLogins = auditLogs.filter(log => 
    log.action === 'login' && log.status === 'error'
  ).length;
  
  // Update statistics
  document.getElementById('stat-total-employees').textContent = employees.length;
  document.getElementById('stat-registered-users').textContent = users.length;
  document.getElementById('stat-unregistered').textContent = employees.length - users.length;
  document.getElementById('stat-locked-users').textContent = lockedUsers.length;
  document.getElementById('stat-failed-logins').textContent = failedLogins;
  document.getElementById('stat-max-attempts').textContent = policy.maxFailedAttempts;
  
  // Load recent activity
  const recentActivity = auditLogger.getRecentActivity(5);
  const activityHtml = recentActivity.map(activity => `
    <tr>
      <td>${new Date(activity.timestamp).toLocaleTimeString()}</td>
      <td>${activity.username}</td>
      <td>${auditLogger.getActionDisplayName(activity.action)}</td>
      <td><span class="badge badge-${activity.status}">${activity.status}</span></td>
    </tr>
  `).join('');
  
  document.getElementById('recent-activity-table').innerHTML = activityHtml;
}

/**
 * Load user profile
 */
function loadProfile() {
  const user = authManager.getUser(currentUser.username);
  const employee = authManager.getEmployee(currentUser.username);
  
  if (user && employee) {
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('profile-fullname').textContent = employee.fullName;
    document.getElementById('profile-department').textContent = employee.department;
    document.getElementById('profile-position').textContent = employee.position;
    document.getElementById('profile-role').textContent = rbacManager.getRoleDisplayName(user.role);
    document.getElementById('profile-registered').textContent = new Date(user.registeredAt).toLocaleString();
    document.getElementById('profile-last-login').textContent = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never';
  }
}

/**
 * Handle password change
 */
async function handlePasswordChange(event) {
  event.preventDefault();
  clearMessages();
  
  const oldPassword = document.getElementById('old-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-new-password').value;
  
  // Check password confirmation
  if (newPassword !== confirmPassword) {
    showError('password-change-error', 'Passwords do not match');
    return;
  }
  
  // Attempt password change
  const result = await authManager.changePassword(currentUser.username, oldPassword, newPassword);
  
  if (result.success) {
    // Log password change
    auditLogger.logEvent({
      username: currentUser.username,
      action: 'password_change',
      details: 'Password changed successfully',
      status: 'success'
    });
    
    showSuccess('password-change-success', 'Password changed successfully!');
    document.getElementById('password-change-form').reset();
  } else {
    showError('password-change-error', result.error);
  }
}

/**
 * Load policy configuration
 */
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

/**
 * Handle policy update
 */
function handlePolicyUpdate(event) {
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
  
  const result = policyEngine.updatePolicy(policyData);
  
  if (result.success) {
    // Log policy change
    auditLogger.logEvent({
      username: currentUser.username,
      action: 'policy_change',
      details: `Policy updated: minLength=${policyData.minLength}, maxAttempts=${policyData.maxFailedAttempts}`,
      status: 'success'
    });
    
    showSuccess('policy-success', 'Policy updated successfully!');
  } else {
    showError('policy-error', result.error);
  }
}

/**
 * Load user management
 */
function loadUserManagement() {
  const users = authManager.getAllUsers();
  const employees = storageManager.loadLocal('employees') || [];
  
  const usersHtml = users.map(user => {
    const employee = employees.find(e => e.username === user.username);
    const lockoutInfo = lockoutManager.isAccountLocked(user.username);
    
    return `
      <tr>
        <td>${user.username}</td>
        <td>${employee ? employee.fullName : 'Unknown'}</td>
        <td>${employee ? employee.department : '-'}</td>
        <td>${rbacManager.getRoleDisplayName(user.role)}</td>
        <td>${user.failedAttempts || 0}</td>
        <td><span class="badge badge-${lockoutInfo.isLocked ? 'error' : 'success'}">${lockoutInfo.isLocked ? 'Locked' : 'Active'}</span></td>
        <td>
          ${lockoutInfo.isLocked ? `<button class="btn btn-sm" onclick="unlockUser(${user.id})">Unlock</button>` : ''}
          <button class="btn btn-sm" onclick="showResetPasswordModal(${user.id})">Reset Password</button>
        </td>
      </tr>
    `;
  }).join('');
  
  document.getElementById('users-table').innerHTML = usersHtml;
}

/**
 * Unlock user account
 */
function unlockUser(userId) {
  const result = lockoutManager.unlockAccount(userId);
  
  if (result.success) {
    const user = authManager.getUserById(userId);
    
    // Log unlock
    auditLogger.logEvent({
      username: currentUser.username,
      action: 'account_unlock',
      details: `Unlocked account: ${user.username}`,
      status: 'success'
    });
    
    alert('Account unlocked successfully!');
    loadUserManagement();
  } else {
    alert('Error: ' + result.error);
  }
}

/**
 * Show reset password modal
 */
function showResetPasswordModal(userId) {
  const newPassword = prompt('Enter new password:');
  if (newPassword) {
    resetUserPassword(userId, newPassword);
  }
}

/**
 * Reset user password
 */
async function resetUserPassword(userId, newPassword) {
  const result = await authManager.resetPassword(userId, newPassword);
  
  if (result.success) {
    const user = authManager.getUserById(userId);
    
    // Log password reset
    auditLogger.logEvent({
      username: currentUser.username,
      action: 'password_reset',
      details: `Reset password for: ${user.username}`,
      status: 'success'
    });
    
    alert('Password reset successfully!');
    loadUserManagement();
  } else {
    alert('Error: ' + result.error);
  }
}

/**
 * Load employee database
 */
function loadEmployeeDatabase() {
  const employees = storageManager.loadLocal('employees') || [];
  const users = storageManager.loadLocal('users') || [];
  
  const employeesHtml = employees.map(employee => {
    const isRegistered = users.some(u => u.username === employee.username);
    
    return `
      <tr>
        <td>${employee.username}</td>
        <td>${employee.fullName}</td>
        <td>${employee.department}</td>
        <td>${employee.position}</td>
        <td><span class="badge badge-${isRegistered ? 'success' : 'warning'}">${isRegistered ? 'Registered' : 'Not Registered'}</span></td>
      </tr>
    `;
  }).join('');
  
  document.getElementById('employees-table').innerHTML = employeesHtml;
}

/**
 * Load audit logs
 */
function loadAuditLogs() {
  // Load statistics
  const stats = auditLogger.getAuditStats();
  const statsHtml = stats.map(stat => `
    <tr>
      <td>${auditLogger.getActionDisplayName(stat.action)}</td>
      <td>${stat.total}</td>
      <td>${stat.successful}</td>
      <td>${stat.failed}</td>
    </tr>
  `).join('');
  
  document.getElementById('audit-stats-table').innerHTML = statsHtml;
  
  // Load logs
  const logs = auditLogger.getAuditLogs();
  const logsHtml = logs.map(log => `
    <tr>
      <td>${new Date(log.timestamp).toLocaleString()}</td>
      <td>${log.username}</td>
      <td>${auditLogger.getActionDisplayName(log.action)}</td>
      <td>${log.details}</td>
      <td>${log.ip}</td>
      <td><span class="badge badge-${log.status}">${log.status}</span></td>
    </tr>
  `).join('');
  
  document.getElementById('audit-logs-table').innerHTML = logsHtml;
}

/**
 * Handle logout
 */
function handleLogout() {
  // Log logout
  auditLogger.logEvent({
    username: currentUser.username,
    action: 'logout',
    details: 'User logged out',
    status: 'success'
  });
  
  // Destroy session
  sessionManager.destroySession();
  currentUser = null;
  
  // Show auth page
  showAuthPage();
}

/**
 * Update password requirements display
 */
function updatePasswordRequirements() {
  const policy = policyEngine.getCurrentPolicy();
  
  const requirements = [
    `At least ${policy.minLength} characters`,
    policy.requireUppercase ? 'One uppercase letter' : null,
    policy.requireLowercase ? 'One lowercase letter' : null,
    policy.requireNumbers ? 'One number' : null,
    policy.requireSpecial ? 'One special character' : null
  ].filter(r => r !== null);
  
  const requirementsHtml = requirements.map(req => `<li>${req}</li>`).join('');
  document.getElementById('password-requirements').innerHTML = requirementsHtml;
}

/**
 * Validate password in real-time
 */
function validatePasswordRealtime() {
  const password = document.getElementById('register-password').value;
  const validation = policyEngine.validatePassword(password);
  
  // Update requirement indicators
  document.getElementById('req-length').className = validation.requirements.length ? 'valid' : 'invalid';
  document.getElementById('req-uppercase').className = validation.requirements.uppercase ? 'valid' : 'invalid';
  document.getElementById('req-lowercase').className = validation.requirements.lowercase ? 'valid' : 'invalid';
  document.getElementById('req-numbers').className = validation.requirements.numbers ? 'valid' : 'invalid';
  document.getElementById('req-special').className = validation.requirements.special ? 'valid' : 'invalid';
  
  // Enable/disable submit button
  document.getElementById('register-submit').disabled = !validation.valid;
}

/**
 * Generate password
 */
function generatePassword() {
  const password = policyEngine.generatePassword();
  document.getElementById('register-password').value = password;
  document.getElementById('register-confirm-password').value = password;
  validatePasswordRealtime();
}

/**
 * Show error message
 */
function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
  }
}

/**
 * Show success message
 */
function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
  }
}

/**
 * Clear all messages
 */
function clearMessages() {
  document.querySelectorAll('.error-message, .success-message').forEach(el => {
    el.style.display = 'none';
    el.textContent = '';
  });
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
