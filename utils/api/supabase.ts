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

  // Get user by username (for username-based login)
  getUserByUsername: async (username) => {
    try {
      console.log('🔍 Looking up username:', username);
      
      // Use a stored function to lookup username securely
      // This bypasses RLS policies since it runs with elevated privileges
      const { data, error } = await supabase
        .rpc('get_user_email_by_username', {
          lookup_username: username
        });
      
      console.log('🔍 Username lookup result:', { 
        username, 
        found: !!data, 
        error: error?.message 
      });
      
      if (error) {
        console.error('❌ Database error during username lookup:', error);
        return { data: null, error };
      }
      
      if (!data) {
        console.log('⚠️ No user found with username:', username);
        return { 
          data: null, 
          error: { message: 'User not found', code: 'USER_NOT_FOUND' }
        };
      }
      
      // Return data in expected format
      return { data: { email: data }, error: null };
    } catch (error) {
      console.error('💥 Unexpected error in getUserByUsername:', error);
      return { data: null, error: { message: 'Lookup failed', originalError: error } };
    }
  },

  // Sign in with username/password
  signInWithUsername: async (username, password) => {
    try {
      // First get the email for this username
      const { data: userProfile, error: lookupError } = await auth.getUserByUsername(username);
      
      if (lookupError || !userProfile?.email) {
        return { 
          data: null, 
          error: { message: 'Invalid username or password' }
        };
      }
      
      // Now sign in with the email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userProfile.email,
        password,
      });
      
      return { data, error };
    } catch (error) {
      return { 
        data: null, 
        error: { message: 'Authentication failed' }
      };
    }
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

  // Get available orders for packer selection (including in_progress orders)
  getAvailableOrders: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_name,
        description,
        production_status,
        clients (
          name
        )
      `)
      .in('production_status', ['pending', 'in_progress'])
      .order('order_name');
    
    if (error) return { data: null, error };
    
    // Transform the data to match expected format
    const transformedData = data?.map(order => ({
      id: order.id,
      order_name: order.order_name,
      description: order.description,
      production_status: order.production_status,
      client_name: order.clients?.name || 'Unknown Client',
      assigned_packers_count: 0 // This could be calculated if needed
    })) || [];
    
    return { data: transformedData, error };
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
      .update({ 
        end_time: endTime, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', attendanceId)
      .select();
    
    return { data, error };
  },

  // Update attendance end time by order, packer, and shift period
  updateAttendanceEndTimeByDetails: async (orderId, packerId, shiftPeriod, endTime) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ 
        end_time: endTime, 
        updated_at: new Date().toISOString() 
      })
      .eq('order_id', orderId)
      .eq('packer_id', packerId)
      .eq('shift_period', shiftPeriod)
      .eq('log_date', today)
      .is('end_time', null) // Only update records without end time
      .select();
    
    return { data, error };
  },

  // Update attendance records to allow restarting
  updateAttendanceForRestart: async (orderId, packerId, shiftPeriod, startTimeIso) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({
        start_time: startTimeIso,
        end_time: null,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .eq('packer_id', packerId)
      .eq('shift_period', shiftPeriod)
      .eq('log_date', today)
      .not('end_time', 'is', null) // Only update records that have an end time
      .select();
    
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
      .limit(1);
    
    // Return the first item if data exists, otherwise null
    return { 
      data: data && data.length > 0 ? data[0] : null, 
      error 
    };
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

  // Get order by ID with project lead
  getOrderById: async (orderId) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_name,
        description,
        clients (
          name
        ),
        project_lead:profiles!project_lead_id (
          full_name
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
          client_name: data.clients?.name || 'Unknown Client',
          project_lead_name: data.project_lead?.full_name || ''
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
      .rpc('update_project_lead_with_status', {
        order_uuid: orderId,
        lead_id: projectLeadId
      });
    
    return { data, error };
  },

  // Session management functions
  // Create a new packer session
  createPackerSession: async (sessionData) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .insert(sessionData)
      .select()
      .single();
    
    return { data, error };
  },

  // Get active session for a packer
  getActivePackerSession: async (packerId) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .select('*')
      .eq('packer_id', packerId)
      .eq('session_active', true)
      .order('created_at', { ascending: false })
      .limit(1);
    
    // Return the first item if data exists, otherwise null
    return { 
      data: data && data.length > 0 ? data[0] : null, 
      error 
    };
  },

  // Update packer session
  updatePackerSession: async (sessionId, updates) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single();
    
    return { data, error };
  },

  // Get packer attendance by order and date (returns latest records)
  getPackerAttendanceByOrderAndDate: async (orderId, packerId, date) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('order_id', orderId)
      .eq('packer_id', packerId)
      .eq('log_date', date)
      .order('created_at', { ascending: false });
    
    return { data, error };
  },

  // Get latest attendance records for all packers in an order
  getLatestAttendanceForOrder: async (orderId) => {
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
      .eq('log_date', today)
      .order('packer_id')
      .order('shift_period')
      .order('created_at', { ascending: false });
    
    if (error) return { data: null, error };
    
    // Group by packer and shift to get latest records
    const latestRecords = {};
    
    if (data) {
      data.forEach(record => {
        const key = `${record.packer_id}_${record.shift_period}`;
        if (!latestRecords[key] || new Date(record.created_at) > new Date(latestRecords[key].created_at)) {
          latestRecords[key] = record;
        }
      });
    }
    
    return { data: Object.values(latestRecords), error };
  },

  // Get session by ID
  getPackerSessionById: async (sessionId) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    return { data, error };
  },

  // Get active sessions for an order (for team-based sessions)
  getActiveSessionsForOrder: async (orderId) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .select('*')
      .eq('order_id', orderId)
      .eq('session_active', true)
      .order('created_at', { ascending: false });
    
    return { data, error };
  },

  // Create or update sessions for all packers in a team
  createTeamSessions: async (orderId, orderData, packerIds) => {
    try {
      const sessions = [];
      
      for (const packerId of packerIds) {
        // Check if session already exists for this packer and order
        const { data: existingSession } = await supabase
          .from('packer_sessions')
          .select('*')
          .eq('packer_id', packerId)
          .eq('order_id', orderId)
          .eq('session_active', true)
          .single();
        
        if (!existingSession) {
          // Create new session for this packer
          const sessionData = {
            packer_id: packerId,
            order_id: orderId,
            order_name: orderData.order_name,
            client_name: orderData.client_name,
            project_lead_name: orderData.project_lead_name,
            team_selected: true,
            attendance_completed: false,
            packaging_started: false,
            session_active: true
          };
          
          const { data: newSession, error } = await supabase
            .from('packer_sessions')
            .insert(sessionData)
            .select()
            .single();
          
          if (!error && newSession) {
            sessions.push(newSession);
          }
        } else {
          sessions.push(existingSession);
        }
      }
      
      return { data: sessions, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};

export default supabase;
