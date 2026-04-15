/**
 * Supabase Configuration
 * Database connection and API setup
 */

// Supabase credentials (replace with your actual credentials)
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // e.g., https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client
let supabaseClient = null;

/**
 * Initialize Supabase connection
 */
function initSupabase() {
  if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized');
    return true;
  } else {
    console.error('Supabase library not loaded');
    return false;
  }
}

/**
 * Database Manager for Supabase
 */
class SupabaseManager {
  constructor() {
    this.client = supabaseClient;
  }

  // ========== EMPLOYEES ==========
  async getEmployees() {
    const { data, error } = await this.client
      .from('employees')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      console.error('Error fetching employees:', error);
      return [];
    }
    return data || [];
  }

  async getEmployeeByUsername(username) {
    const { data, error } = await this.client
      .from('employees')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error) {
      console.error('Error fetching employee:', error);
      return null;
    }
    return data;
  }

  // ========== USERS ==========
  async getUsers() {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }
    return data || [];
  }

  async getUserByUsername(username) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error) {
      return null;
    }
    return data;
  }

  async createUser(userData) {
    const { data, error } = await this.client
      .from('users')
      .insert([userData])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  }

  async updateUser(userId, updates) {
    const { data, error } = await this.client
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  }

  // ========== POLICIES ==========
  async getPolicies() {
    const { data, error } = await this.client
      .from('policies')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching policies:', error);
      return [];
    }
    return data || [];
  }

  async getActivePolicy() {
    const { data, error } = await this.client
      .from('policies')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('Error fetching active policy:', error);
      return null;
    }
    return data;
  }

  async createPolicy(policyData) {
    // Deactivate all existing policies
    await this.client
      .from('policies')
      .update({ is_active: false })
      .neq('id', 0);

    const { data, error } = await this.client
      .from('policies')
      .insert([policyData])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating policy:', error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  }

  // ========== AUDIT LOGS ==========
  async getAuditLogs(filter = {}) {
    let query = this.client
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (filter.username) {
      query = query.eq('username', filter.username);
    }
    if (filter.action) {
      query = query.eq('action', filter.action);
    }
    if (filter.status) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
    return data || [];
  }

  async createAuditLog(logData) {
    const { error } = await this.client
      .from('audit_logs')
      .insert([logData]);
    
    if (error) {
      console.error('Error creating audit log:', error);
    }
  }
}

// Export singleton instance
let supabaseManager = null;
