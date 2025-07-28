import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get environment variables
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable automatic session refresh
    autoRefreshToken: true,
    // Persist session in local storage
    persistSession: true,
    // Set custom storage key
    storageKey: 'ipac-operations-auth',
  },
});

// Helper functions for authentication
export const auth = {
  // Sign in with email/password
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Sign in with phone/OTP (for packers)
  signInWithPhone: async (phone) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });
    return { data, error };
  },

  // Verify OTP
  verifyOtp: async (phone, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    return { data, error };
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Get current session
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  // Get current user
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },
};

// Helper functions for database operations
export const db = {
  // Get user profile with role
  getUserProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        roles (
          id,
          name,
          can_block_users,
          can_unblock_users,
          can_ban_users,
          can_reset_passwords,
          can_delete_profiles,
          can_manage_roles
        )
      `)
      .eq('id', userId)
      .single();
    
    return { data, error };
  },

  // Get available orders for packer selection
  getAvailableOrders: async () => {
    const { data, error } = await supabase
      .from('available_orders_for_assignment')
      .select('*')
      .order('order_name');
    
    return { data, error };
  },

  // Get available packers
  getAvailablePackers: async () => {
    const { data, error } = await supabase
      .rpc('get_available_packers');
    
    return { data, error };
  },

  // Get packer availability status
  getPackerAvailabilityStatus: async () => {
    const { data, error } = await supabase
      .from('packer_availability_status')
      .select('*')
      .order('full_name');
    
    return { data, error };
  },

  // Assign packers to order using new JSON structure
  assignPackersToOrder: async (orderId, packerIds) => {
    const { data, error } = await supabase
      .rpc('assign_packers_to_order', {
        order_uuid: orderId,
        packer_ids: packerIds
      });
    
    return { data, error };
  },

  // Log attendance with comprehensive data
  logAttendance: async (orderId, packerId, shiftPeriod, status, startTime = null, endTime = null, toolboxBriefing = false, isProjectStart = false) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .insert({
        order_id: orderId,
        packer_id: packerId,
        shift_period: shiftPeriod,
        status: status,
        start_time: startTime,
        end_time: endTime,
        toolbox_briefing_completed: toolboxBriefing,
        is_project_start: isProjectStart,
        log_date: new Date().toISOString().split('T')[0],
      });
    
    return { data, error };
  },

  // Update attendance end time
  updateAttendanceEndTime: async (attendanceId, endTime) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ end_time: endTime, updated_at: new Date().toISOString() })
      .eq('id', attendanceId);
    
    return { data, error };
  },

  // Get active attendance for a packer today
  getActiveAttendance: async (orderId, packerId, shiftPeriod) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('order_id', orderId)
      .eq('packer_id', packerId)
      .eq('shift_period', shiftPeriod)
      .eq('log_date', today)
      .eq('status', 'present')
      .is('end_time', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    return { data, error };
  },

  // Get today's attendance for an order
  getTodaysAttendance: async (orderId) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        *,
        profiles (
          id,
          full_name,
          username
        )
      `)
      .eq('order_id', orderId)
      .eq('log_date', today);
    
    return { data, error };
  },

  // Check if packer has logged attendance today
  hasLoggedAttendanceToday: async (orderId, packerId) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .rpc('packer_logged_attendance_today', {
        order_uuid: orderId
      });
    
    return { data, error };
  },

  // Get order by ID
  getOrderById: async (orderId) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_name,
        description,
        clients (
          name
        )
      `)
      .eq('id', orderId)
      .single();
    
    // Transform the data to match expected format
    if (data) {
      return {
        data: {
          id: data.id,
          order_name: data.order_name,
          description: data.description,
          client_name: data.clients?.name || 'Unknown Client'
        },
        error
      };
    }
    
    return { data, error };
  },

  // Get packers by IDs
  getPackersByIds: async (packerIds) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', packerIds);
    
    return { data, error };
  },

  // Get packers assigned to an order (using new JSON structure)
  getOrderPackers: async (orderId) => {
    const { data, error } = await supabase
      .rpc('get_order_packers', {
        order_uuid: orderId
      });
    
    return { data, error };
  },

  // Get all packers with their current assignment status
  getAllPackersWithStatus: async () => {
    const { data, error } = await supabase
      .rpc('get_all_packers_with_status');
    
    return { data, error };
  },

  // Update project lead for an order
  updateProjectLead: async (orderId, projectLeadId) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ project_lead_id: projectLeadId })
      .eq('id', orderId);
    
    return { data, error };
  },
};

export default supabase;
