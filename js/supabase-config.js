/**
 * Supabase Configuration & Database Manager
 * Central data layer — all reads/writes go through here
 */

const SUPABASE_URL = 'https://rdtlotoficklrhkfvyao.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdGxvdG9maWNrbHJoa2Z2eWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDcyMjYsImV4cCI6MjA5MTgyMzIyNn0.W8nFzVjq7chMPKeo5DOx7oiHWjakRl25Qv8PBG5Nx2M';

let _client = null;

function getClient() {
  if (!_client) {
    if (typeof supabase === 'undefined') {
      throw new Error('Supabase library not loaded. Check index.html script tag.');
    }
    _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────

async function db_getEmployees() {
  const { data, error } = await getClient()
    .from('employees')
    .select('*')
    .order('id', { ascending: true });
  if (error) { console.error('db_getEmployees:', error); return []; }
  return data || [];
}

async function db_getEmployeeByUsername(username) {
  const { data, error } = await getClient()
    .from('employees')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) { console.error('db_getEmployeeByUsername:', error); return null; }
  return data;
}

// ─── USERS ────────────────────────────────────────────────────────────────────

async function db_getUsers() {
  const { data, error } = await getClient()
    .from('users')
    .select('*')
    .order('id', { ascending: true });
  if (error) { console.error('db_getUsers:', error); return []; }
  return data || [];
}

async function db_getUserByUsername(username) {
  const { data, error } = await getClient()
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) { console.error('db_getUserByUsername:', error); return null; }
  return data;
}

async function db_getUserById(id) {
  const { data, error } = await getClient()
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) { console.error('db_getUserById:', error); return null; }
  return data;
}

async function db_createUser(userData) {
  const { data, error } = await getClient()
    .from('users')
    .insert([userData])
    .select()
    .single();
  if (error) { console.error('db_createUser:', error); return { success: false, error: error.message }; }
  return { success: true, data };
}

async function db_updateUser(id, updates) {
  const { data, error } = await getClient()
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('db_updateUser:', error); return { success: false, error: error.message }; }
  return { success: true, data };
}

// ─── POLICIES ─────────────────────────────────────────────────────────────────

async function db_getActivePolicy() {
  const { data, error } = await getClient()
    .from('policies')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();
  if (error) { console.error('db_getActivePolicy:', error); return null; }
  // Map snake_case → camelCase for compatibility with existing code
  if (!data) return null;
  return _policyFromDb(data);
}

async function db_getAllPolicies() {
  const { data, error } = await getClient()
    .from('policies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('db_getAllPolicies:', error); return []; }
  return (data || []).map(_policyFromDb);
}

async function db_createPolicy(policyData) {
  // Deactivate all existing policies first
  await getClient().from('policies').update({ is_active: false }).neq('id', 0);

  const row = {
    name: policyData.name || 'Policy',
    min_length: policyData.minLength,
    require_uppercase: policyData.requireUppercase,
    require_lowercase: policyData.requireLowercase,
    require_numbers: policyData.requireNumbers,
    require_special: policyData.requireSpecial,
    max_failed_attempts: policyData.maxFailedAttempts,
    lockout_duration_minutes: policyData.lockoutDurationMinutes,
    password_expiry_days: policyData.passwordExpiryDays || 90,
    password_history_count: policyData.passwordHistoryCount || 5,
    is_active: true,
    created_by: policyData.createdBy || 'admin'
  };

  const { data, error } = await getClient()
    .from('policies')
    .insert([row])
    .select()
    .single();
  if (error) { console.error('db_createPolicy:', error); return { success: false, error: error.message }; }
  return { success: true, data: _policyFromDb(data) };
}

// Convert DB snake_case row → camelCase object that the rest of the app expects
function _policyFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    minLength: row.min_length,
    requireUppercase: row.require_uppercase,
    requireLowercase: row.require_lowercase,
    requireNumbers: row.require_numbers,
    requireSpecial: row.require_special,
    maxFailedAttempts: row.max_failed_attempts,
    lockoutDurationMinutes: row.lockout_duration_minutes,
    passwordExpiryDays: row.password_expiry_days,
    passwordHistoryCount: row.password_history_count,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

async function db_createAuditLog(logData) {
  const row = {
    username: logData.username || 'unknown',
    action: logData.action,
    details: logData.details || '',
    status: logData.status,
    ip: logData.ip || '',
    user_agent: logData.userAgent || navigator.userAgent
  };
  const { error } = await getClient().from('audit_logs').insert([row]);
  if (error) console.error('db_createAuditLog:', error);
}

async function db_getAuditLogs(filter = {}) {
  let query = getClient()
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false });

  if (filter.username) query = query.eq('username', filter.username);
  if (filter.action)   query = query.eq('action', filter.action);
  if (filter.status)   query = query.eq('status', filter.status);

  const { data, error } = await query;
  if (error) { console.error('db_getAuditLogs:', error); return []; }
  return data || [];
}
