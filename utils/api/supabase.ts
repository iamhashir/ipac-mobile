import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = Constants.expoConfig?.extra?.supabasePublishableKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

//get rid of these test logs later
console.warn("😭😭😭 sup url constants:'", Constants.expoConfig?.extra?.supabaseUrl,"'");
console.warn("😭😭😭 sup key constants:'", Constants.expoConfig?.extra?.supabasePublishableKey,"'");
console.warn("😭😭😭 sup url env:'", process.env.EXPO_PUBLIC_SUPABASE_URL,"'");
console.warn("😭😭😭 sup key env:'", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,"'");

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // syncSession: true,
    storageKey: 'ipac-operations-auth-v2',
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

  // Get current session (recover from invalid refresh tokens on RN)
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session || null;
    if (error && (String(error.message).includes('Invalid Refresh Token') || String(error.message).includes('Refresh Token Not Found'))) {
      // Clear bad local session to avoid app-breaking errors and let user re-auth
      try { await supabase.auth.signOut(); } catch (_) {}
      return { session: null, error: null };
    }
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

// Profile cache to reduce database queries (in-memory)
const profileCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// Persistent cache helpers (survive reloads) to prevent UI freezes on slow networks
const PERSIST_TTL = 24 * 60 * 60 * 1000; // 24 hours
const PROFILE_PERSIST_PREFIX = 'ipac:last_profile:';

const persistGet = async (key: string) => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window?.localStorage) {
      return window.localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

const persistSet = async (key: string, value: string) => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window?.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch (_) {
    // noop
  }
};

// Helper functions for database operations
export const db = {
  // Clear profile cache (useful when profile is updated)
  clearProfileCache: (userId?: string) => {
    if (userId) {
      profileCache.delete(userId);
    } else {
      profileCache.clear();
    }
  },

  // Get user profile with role (with caching)
  getUserProfile: async (userId) => {
    // In-memory cache first (fastest)
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('✨ getUserProfile: Using cached profile for userId:', userId);
      return { data: cached.data, error: null };
    }

    // Persistent cache second (prevents UI freeze on cold loads)
    try {
      const persistKey = `${PROFILE_PERSIST_PREFIX}${userId}`;
      const persistedRaw = await persistGet(persistKey);
      if (persistedRaw) {
        const persisted = JSON.parse(persistedRaw);
        if (persisted?.timestamp && (Date.now() - persisted.timestamp) < PERSIST_TTL) {
          console.log('✨ getUserProfile: Using persisted profile for userId:', userId);
          // Hydrate in-memory cache to speed up subsequent calls
          profileCache.set(userId, { data: persisted.data, timestamp: persisted.timestamp });
          return { data: persisted.data, error: null };
        }
      }
    } catch (e) {
      // Ignore persistence errors
    }

    console.log('🔍 getUserProfile: Starting profile lookup for userId:', userId);
    
    try {
      // Primary query with join and a timeout guard to prevent UI freeze
      const timeoutMs = 3500; // tighten to reduce UI stalls
      const timeoutSentinel: any = Symbol('timeout');
      const primaryPromise = supabase
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
        .maybeSingle();

      const primaryResult: any = await Promise.race([
        primaryPromise,
        new Promise((resolve) => setTimeout(() => resolve(timeoutSentinel), timeoutMs)),
      ]);

      let profile: any = null;
      let profileError: any = null;

      if (primaryResult === timeoutSentinel) {
        console.warn('⏳ getUserProfile: Primary query timed out, falling back to minimal profile fetch');
      } else {
        profile = primaryResult?.data ?? null;
        profileError = primaryResult?.error ?? null;
      }

      if (profileError) {
        console.error('❌ getUserProfile: Error fetching profile:', profileError);
        // fall through to fallback below
      }

      if (!profile) {
        // Fallback: fetch minimal profile, then role separately (also guarded by timeout)
        const fallbackTimeoutMs = 3500;
        const timeoutSentinel2: any = Symbol('timeout2');

        const basicPromise = supabase
          .from('profiles')
          .select('id, full_name, username, role_id, status')
          .eq('id', userId)
          .maybeSingle();

        const basicResult: any = await Promise.race([
          basicPromise,
          new Promise((resolve) => setTimeout(() => resolve(timeoutSentinel2), fallbackTimeoutMs)),
        ]);

        if (basicResult === timeoutSentinel2) {
          console.warn('⏳ getUserProfile: Fallback basic profile timed out. Returning last known profile if any.');
          const last = profileCache.get(userId);
          if (last?.data) {
            return { data: last.data, error: null };
          }
          // As a last resort, return a minimal stub to unblock UI; consumers should handle missing role
          return { data: { id: userId, full_name: '', status: 'unknown', roles: null }, error: null };
        }

        const basic = basicResult?.data ?? null;
        const basicErr = basicResult?.error ?? null;
        if (basicErr) {
          console.error('❌ getUserProfile: Fallback profile error:', basicErr);
          return { data: null, error: basicErr };
        }

        let roleRow: any = null;
        if (basic?.role_id) {
          // Role lookup, but keep it non-blocking with its own timeout
          const roleTimeoutMs = 2500;
          const timeoutSentinel3: any = Symbol('timeout3');
          const rolePromise = supabase
            .from('roles')
            .select('id, name, can_block_users, can_unblock_users, can_ban_users, can_reset_passwords, can_delete_profiles, can_manage_roles')
            .eq('id', basic.role_id)
            .maybeSingle();
          const roleResult: any = await Promise.race([
            rolePromise,
            new Promise((resolve) => setTimeout(() => resolve(timeoutSentinel3), roleTimeoutMs)),
          ]);
          if (roleResult !== timeoutSentinel3) {
            roleRow = roleResult?.data || null;
          } else {
            console.warn('⏳ getUserProfile: Role lookup timed out. Proceeding without role.');
          }
        }

        const merged = { ...basic, roles: roleRow };
        // Cache and persist
        const nowTs = Date.now();
        profileCache.set(userId, { data: merged, timestamp: nowTs });
        try { await persistSet(`${PROFILE_PERSIST_PREFIX}${userId}`, JSON.stringify({ data: merged, timestamp: nowTs })); } catch (_) {}
        console.log('✅ getUserProfile: Fallback profile loaded and cached:', {
          id: merged.id,
          full_name: merged.full_name,
          role: merged.roles?.name,
          status: merged.status,
        });
        return { data: merged, error: null };
      }

      console.log('🔍 getUserProfile: Query result:', {
        found: !!profile,
        error: profileError?.message,
        profileData: profile ? {
          id: profile.id,
          full_name: profile.full_name,
          role: profile.roles?.name,
          status: profile.status
        } : null
      });

      // Cache the successful result (and persist)
      const nowTs = Date.now();
      profileCache.set(userId, {
        data: profile,
        timestamp: nowTs
      });
      try { await persistSet(`${PROFILE_PERSIST_PREFIX}${userId}`, JSON.stringify({ data: profile, timestamp: nowTs })); } catch (_) {}

      console.log('✅ getUserProfile: Profile loaded and cached:', {
        id: profile.id,
        full_name: profile.full_name,
        role: profile.roles?.name,
        status: profile.status
      });

      return { data: profile, error: null };
    } catch (error) {
      console.error('💥 getUserProfile: Unexpected error:', error);
      return { data: null, error: { message: 'Failed to load profile', originalError: error } };
    }
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

  // Mark toolbox briefing as completed for the whole order and current shift (today)
  setToolboxBriefingForOrderShift: async (orderId, shiftPeriod) => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ toolbox_briefing_completed: true, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('shift_period', shiftPeriod)
      .eq('log_date', today)
      .select('id');
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
          .maybeSingle();
        
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

  // Check if user can mark attendance for an order
  canUserMarkAttendance: async (orderId) => {
    const { data, error } = await supabase
      .rpc('can_user_mark_attendance', {
        order_uuid: orderId
      });
    
    return { data, error };
  },

  // Check if attendance can be recorded (prevents spam clicking)
  canRecordAttendance: async (orderId, packerId, shiftPeriod) => {
    const { data, error } = await supabase
      .rpc('can_record_attendance', {
        order_uuid: orderId,
        packer_uuid: packerId,
        shift_period_param: shiftPeriod
      });
    
    return { data, error };
  },

  // Packaging: fetch order packages (lightweight)
  getOrderPackages: async (orderId) => {
    const { data, error } = await supabase
      .from('order_packages')
      .select('*')
      .eq('order_id', orderId);
    return { data, error };
  },

  // Packaging: fetch package_info by IDs
  getPackageInfosByIds: async (ids) => {
    if (!ids || ids.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('package_info')
      .select('id, center_of_gravity, quantity, box_type_id, packing_type_id, tare, net_weight, gross_weight, internal_length, internal_width, internal_height, external_length, external_width, external_height')
      .in('id', ids);
    return { data, error };
  },

  // Upsert final dimensions for an order package. If finalInfoId is missing, create an EMPTY final package_info and link it.
  upsertFinalDimensions: async ({ orderPackageId, finalInfoId, originalInfoId, scope, length, width, height }) => {
    const fields: any = {};
    if (scope === 'internal') {
      fields.internal_length = length;
      fields.internal_width = width;
      fields.internal_height = height;
    } else {
      fields.external_length = length;
      fields.external_width = width;
      fields.external_height = height;
    }

    let effectiveFinalId = finalInfoId as string | null | undefined;

    // If there is no final package_info, create an EMPTY row and link it to the order package
    if (!effectiveFinalId) {
      const { data: created, error: createErr } = await supabase
        .from('package_info')
        .insert({})
        .select('id')
        .single();
      if (createErr || !created) return { data: null, error: createErr || { message: 'Failed to create final package info' } };
      effectiveFinalId = created.id;

      const { error: updErr } = await supabase
        .from('order_packages')
        .update({ final_pkg_info: effectiveFinalId })
        .eq('id', orderPackageId);
      if (updErr) return { data: null, error: updErr };
    }

    // Update the final package_info with provided fields (no cloning)
    const { error: updFinalErr } = await supabase
      .from('package_info')
      .update(fields)
      .eq('id', effectiveFinalId);
    if (updFinalErr) return { data: null, error: updFinalErr };

    return { data: { final_pkg_info: effectiveFinalId }, error: null };
  },

  // Packaging: materials lookup
  getMaterialsByIds: async (ids) => {
    if (!ids || ids.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('materials')
      .select('id, name')
      .in('id', ids);
    return { data, error };
  },

  // Packaging: packing types lookup (support multiple column names for vacuum/gas flags)
  getPackingTypesByIds: async (ids) => {
    if (!ids || ids.length === 0) return { data: [], error: null };

    // Attempt 1: preferred columns
    {
      const r = await supabase
        .from('packing_types')
        .select('id, name, code, includes_vacuum_protection, includes_gas_protection')
        .in('id', ids);
      if (!r.error) {
        return { data: r.data, error: null };
      }
    }

    // Attempt 2: alternate naming for vacuum flag
    {
      const r = await supabase
        .from('packing_types')
        .select('id, name, code, includes_vacuum_packing, includes_gas_protection')
        .in('id', ids);
      if (!r.error) {
        const mapped = (r.data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          includes_vacuum_protection: !!t.includes_vacuum_packing,
          includes_gas_protection: !!t.includes_gas_protection,
        }));
        return { data: mapped, error: null };
      }
    }

    // Attempt 3: alternate naming for gas flag
    {
      const r = await supabase
        .from('packing_types')
        .select('id, name, code, includes_vacuum_protection, includes_gas_packing')
        .in('id', ids);
      if (!r.error) {
        const mapped = (r.data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          includes_vacuum_protection: !!t.includes_vacuum_protection,
          includes_gas_protection: !!t.includes_gas_packing,
        }));
        return { data: mapped, error: null };
      }
    }

    // Attempt 4: historical misspelling for vacuum flag
    {
      const r = await supabase
        .from('packing_types')
        .select('id, name, code, inlcudes_vacuum_protecton, includes_gas_protection')
        .in('id', ids);
      if (!r.error) {
        const mapped = (r.data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          includes_vacuum_protection: !!t.inlcudes_vacuum_protecton,
          includes_gas_protection: !!t.includes_gas_protection,
        }));
        return { data: mapped, error: null };
      }
    }

    // Fallback without flags
    {
      const r = await supabase
        .from('packing_types')
        .select('id, name, code')
        .in('id', ids);
      if (r.error) return { data: null, error: r.error };
      const withFlags = (r.data || []).map((t: any) => ({ ...t, includes_vacuum_protection: false, includes_gas_protection: false }));
      return { data: withFlags, error: null };
    }
  },

  getAllMaterials: async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name')
      .order('name');
    return { data, error };
  },

  // Units lookup for materials usage
  getAllUnits: async () => {
    const { data, error } = await supabase
      .from('units_of_measure')
      .select('id, name')
      .order('name');
    return { data, error };
  },

  // Material variants filtered by a specific tag name (strict match, case-insensitive)
  getMaterialVariantsByTag: async (tagName) => {
    const normalized = String(tagName || '').trim();

    // Step 0: resolve the tag id by name (case-insensitive exact)
    const { data: tagRow, error: tagErr } = await supabase
      .from('tags')
      .select('id, name')
      .ilike('name', normalized)
      .maybeSingle();
    if (tagErr) return { data: null, error: tagErr };
    if (!tagRow?.id) return { data: [], error: null };

    // Step 1: find materials that have exactly this tag id
    const { data: mats, error: matsErr } = await supabase
      .from('material_tags')
      .select('material_id')
      .eq('tag_id', tagRow.id);
    if (matsErr) return { data: null, error: matsErr };
    const materialIds = Array.from(new Set((mats || []).map((r: any) => r.material_id).filter(Boolean)));
    if (!materialIds.length) return { data: [], error: null };

    // Step 2: fetch all variants for these materials, including the material's default unit
    let variants: any = null;
    let varErr: any = null;
    {
      const r = await supabase
        .from('material_variants')
        .select(`
          id,
          variant_name,
          material_id,
          materials:material_id (
            id,
            unit_id,
            units_of_measure:unit_id ( id, name )
          )
        `)
        .in('material_id', materialIds)
        .order('variant_name');
      variants = r.data;
      varErr = r.error;
    }

    if (varErr) {
      const r2 = await supabase
        .from('material_variants')
        .select('id, variant_name, material_id')
        .in('material_id', materialIds)
        .order('variant_name');
      variants = r2.data;
      varErr = r2.error;
    }

    if (varErr) return { data: null, error: varErr };

    const items = (variants || []).map((v: any) => ({
      id: v.id,
      value: v.id,
      label: v.variant_name,
      material_id: v.material_id,
      unit_id: v?.materials?.unit_id || null,
      unit_name: v?.materials?.units_of_measure?.name || null,
    }));
    return { data: items, error: null };
  },

  // Material variants filtered by variant tag (uses material_variant_tags table)
  getMaterialVariantsByVariantTag: async (tagName) => {
    const normalized = String(tagName || '').trim();

    // Step 0: resolve the tag id by name (case-insensitive exact)
    const { data: tagRow, error: tagErr } = await supabase
      .from('tags')
      .select('id, name')
      .ilike('name', normalized)
      .maybeSingle();
    if (tagErr) return { data: null, error: tagErr };
    if (!tagRow?.id) return { data: [], error: null };

    // Step 1: find variant ids that have exactly this tag id
    const { data: variantTags, error: variantTagsErr } = await supabase
      .from('material_variant_tags')
      .select('material_variant_id')
      .eq('tag_id', tagRow.id);
    if (variantTagsErr) return { data: null, error: variantTagsErr };
    const variantIds = Array.from(new Set((variantTags || []).map((r: any) => r.material_variant_id).filter(Boolean)));
    if (!variantIds.length) return { data: [], error: null };

    // Step 2: fetch these variants with their material's default unit
    let variants: any = null;
    let varErr: any = null;
    {
      const r = await supabase
        .from('material_variants')
        .select(`
          id,
          variant_name,
          material_id,
          materials:material_id (
            id,
            unit_id,
            units_of_measure:unit_id ( id, name )
          )
        `)
        .in('id', variantIds)
        .order('variant_name');
      variants = r.data;
      varErr = r.error;
    }

    if (varErr) {
      const r2 = await supabase
        .from('material_variants')
        .select('id, variant_name, material_id')
        .in('id', variantIds)
        .order('variant_name');
      variants = r2.data;
      varErr = r2.error;
    }

    if (varErr) return { data: null, error: varErr };

    const items = (variants || []).map((v: any) => ({
      id: v.id,
      value: v.id,
      label: v.variant_name,
      material_id: v.material_id,
      unit_id: v?.materials?.unit_id || null,
      unit_name: v?.materials?.units_of_measure?.name || null,
    }));
    return { data: items, error: null };
  },

  // Material variants filtered by material name (case-insensitive, partial match)
  getMaterialVariantsByMaterialName: async (materialName) => {
    // Step 1: find materials whose name includes the provided text (case-insensitive)
    const { data: mats, error: matsErr } = await supabase
      .from('materials')
      .select('id, name, unit_id, units_of_measure:unit_id ( id, name )')
      .ilike('name', `%${materialName}%`);
    if (matsErr) return { data: null, error: matsErr };
    const materialIds = Array.from(new Set((mats || []).map((m: any) => m.id).filter(Boolean)));
    if (!materialIds.length) return { data: [], error: null };

    // Step 2: get variants for those materials, include material unit if possible
    let variants: any = null;
    let varErr: any = null;
    {
      const r = await supabase
        .from('material_variants')
        .select(`
          id,
          variant_name,
          material_id,
          materials:material_id (
            id,
            unit_id,
            units_of_measure:unit_id ( id, name )
          )
        `)
        .in('material_id', materialIds)
        .order('variant_name');
      variants = r.data;
      varErr = r.error;
    }

    if (varErr) return { data: null, error: varErr };

    const items = (variants || []).map((v: any) => ({
      id: v.id,
      value: v.id,
      label: v.variant_name,
      material_id: v.material_id,
      unit_id: v?.materials?.unit_id || null,
      unit_name: v?.materials?.units_of_measure?.name || null,
    }));
    return { data: items, error: null };
  },

  // Material variants filtered by material name with exact match (case-insensitive, no partials)
  getMaterialVariantsByMaterialExactName: async (materialName) => {
    const { data: mats, error: matsErr } = await supabase
      .from('materials')
      .select('id, name, unit_id, units_of_measure:unit_id ( id, name )')
      .ilike('name', materialName); // exact (no wildcards)
    if (matsErr) return { data: null, error: matsErr };
    const materialIds = Array.from(new Set((mats || []).map((m: any) => m.id).filter(Boolean)));
    if (!materialIds.length) return { data: [], error: null };

    let variants: any = null;
    let varErr: any = null;
    const r = await supabase
      .from('material_variants')
      .select(`
        id,
        variant_name,
        material_id,
        materials:material_id (
          id,
          unit_id,
          units_of_measure:unit_id ( id, name )
        )
      `)
      .in('material_id', materialIds)
      .order('variant_name');
    variants = r.data;
    varErr = r.error;
    if (varErr) return { data: null, error: varErr };

    const items = (variants || []).map((v: any) => ({
      id: v.id,
      value: v.id,
      label: v.variant_name,
      material_id: v.material_id,
      unit_id: v?.materials?.unit_id || null,
      unit_name: v?.materials?.units_of_measure?.name || null,
    }));
    return { data: items, error: null };
  },

  // Get order package materials (used by Accessories and specialized sections)
  getOrderPackageMaterials: async (orderPackageId) => {
    const { data, error } = await supabase
      .from('order_package_materials')
      .select('id, order_package_id, material_variant_id, material_type, quantity, quantity_used, unit_id, length, width, comment, item_used')
      .eq('order_package_id', orderPackageId)
      .order('created_at', { ascending: true });
    return { data, error };
  },

  addOrderPackageMaterial: async (payload) => {
    // Canonicalize material_type to your enum values
    const allowed = ['Accessories','Securing','Gas Packing','Vacuum Packing'];
    const canonType = (() => {
      const raw = String(payload.material_type || '').trim();
      const match = allowed.find(a => a.toLowerCase() === raw.toLowerCase());
      return match || (raw || 'Accessories');
    })();

    // Build exactly the row shape matching your table (single POST only)
    const row: any = {
      order_package_id: payload.order_package_id,
      material_variant_id: payload.material_variant_id,
      material_type: canonType,
      is_final: payload.is_final ?? true,
      quantity: (typeof payload.quantity === 'number' && isFinite(payload.quantity))
        ? payload.quantity
        : Number(payload.quantity ?? 0),
      unit_id: payload.unit_id,
      length: (typeof payload.length === 'number' && isFinite(payload.length)) ? payload.length : null,
      width: (typeof payload.width === 'number' && isFinite(payload.width)) ? payload.width : null,
      height: (typeof payload.height === 'number' && isFinite(payload.height)) ? payload.height : null,
      comment: payload.comment ?? null,
      item_used: payload.item_used ?? false,
      original: payload.original ?? null,
      quantity_used: (typeof payload.quantity_used === 'number' && isFinite(payload.quantity_used)) ? payload.quantity_used : null,
    };

    const { data, error } = await supabase
      .from('order_package_materials')
      .insert(row)
      .select('id')
      .single();
    return { data, error };
  },

  updateOrderPackageMaterial: async (id, fields) => {
    const { data, error } = await supabase
      .from('order_package_materials')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single();
    return { data, error };
  },

  deleteOrderPackageMaterial: async (id) => {
    const { data, error } = await supabase
      .from('order_package_materials')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    return { data, error };
  },

  // Upload image to Supabase storage bucket 'order_media'.
  // Returns path and publicUrl (if bucket is public).
  uploadOrderPackageImage: async (orderPackageId, fileUri) => {
    try {
      const resp = await fetch(fileUri);
      const blob = await resp.blob();
      const extGuess = (blob && blob.type && blob.type.includes('png')) ? 'png' : 'jpg';
      const filename = `${orderPackageId}/${Date.now()}.${extGuess}`;
      const { data, error } = await supabase
        .storage
        .from('order_media')
        .upload(filename, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (error) return { data: null, error };
      const { data: pub } = await supabase.storage.from('order_media').getPublicUrl(filename);
      return { data: { path: data?.path || filename, publicUrl: pub?.publicUrl || null }, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  },

  addPackageItem: async ({ orderPackageId, designation, quantity }) => {
    const { data, error } = await supabase
      .from('package_items')
      .insert({ order_package_id: orderPackageId, designation, quantity })
      .select('id')
      .single();
    return { data, error };
  },

  getAllPackingTypes: async () => {
    const { data, error } = await supabase
      .from('packing_types')
      .select('id, code, name')
      .order('code');
    return { data, error };
  },

  updatePackageInfo: async (id, fields) => {
    // Do not include non-existent columns to avoid 400 errors
    const { error } = await supabase
      .from('package_info')
      .update({ ...fields })
      .eq('id', id);
    return { data: { id }, error };
  },

  // Ensure there is a linked EMPTY final package_info for this order package
  ensureFinalPackageInfo: async ({ orderPackageId, finalInfoId, originalInfoId }) => {
    if (finalInfoId) return { data: { id: finalInfoId }, error: null };

    // Always create an EMPTY package_info row (do not clone original)
    const { data: created, error: createErr } = await supabase
      .from('package_info')
      .insert({})
      .select('id')
      .single();
    if (createErr || !created) return { data: null, error: createErr };

    // Link to order_packages.final_pkg_info
    const { error: updErr } = await supabase
      .from('order_packages')
      .update({ final_pkg_info: created.id })
      .eq('id', orderPackageId);
    if (updErr) return { data: null, error: updErr };

    return { data: { id: created.id }, error: null };
  },

  // Ensure there is a linked EMPTY original package_info for this order package
  ensureOriginalPackageInfo: async ({ orderPackageId, originalInfoId }) => {
    if (originalInfoId) return { data: { id: originalInfoId }, error: null };

    const { data: created, error: createErr } = await supabase
      .from('package_info')
      .insert({})
      .select('id')
      .single();
    if (createErr || !created) return { data: null, error: createErr };

    const { error: updErr } = await supabase
      .from('order_packages')
      .update({ original_pkg_info: created.id })
      .eq('id', orderPackageId);
    if (updErr) return { data: null, error: updErr };

    return { data: { id: created.id }, error: null };
  },

  // Securing
  getSecuringForPackage: async (orderPackageId) => {
    const { data, error } = await supabase
      .from('order_package_securing')
      .select(`
        id,
        securing_side,
        is_final,
        securing_template:securing_template(
          id, quantity, type_id, thickness,
          horizontal_bar:beam!securing_template_horizontal_bar_fkey(id, quantity, type, width, thickness, space),
          vertical_bar:beam!securing_template_vertical_bar_fkey(id, quantity, type, width, thickness, space),
          skids:beam!securing_template_skids_fkey(id, quantity, type, width, thickness, space)
        )
      `)
      .eq('order_package_id', orderPackageId);
    return { data, error };
  },

  updateSecuringTemplate: async (templateId, fields) => {
    const { data, error } = await supabase
      .from('securing_template')
      .update({ ...fields })
      .eq('id', templateId)
      .select('id')
      .maybeSingle();
    
    // Handle 409 conflicts gracefully - the data might already be set
    if (error && error.code === '409') {
      console.warn('Conflict updating securing_template, retrying with fresh data...');
      // Retry once
      const { data: retryData, error: retryError } = await supabase
        .from('securing_template')
        .update({ ...fields })
        .eq('id', templateId)
        .select('id')
        .maybeSingle();
      return { data: retryData || { id: templateId }, error: retryError };
    }
    
    return { data: data || { id: templateId }, error };
  },

  updateBeam: async (beamId, fields) => {
    const { data, error } = await supabase
      .from('beam')
      .update({ ...fields })
      .eq('id', beamId)
      .select('id')
      .maybeSingle();
    
    // Handle 409 conflicts gracefully
    if (error && error.code === '409') {
      console.warn('Conflict updating beam, retrying...');
      const { data: retryData, error: retryError } = await supabase
        .from('beam')
        .update({ ...fields })
        .eq('id', beamId)
        .select('id')
        .maybeSingle();
      return { data: retryData || { id: beamId }, error: retryError };
    }
    
    return { data: data || { id: beamId }, error };
  },

  // Ensure the securing_template (and beams) for a given side are not shared by other sides.
  // If shared, clone beams + template and re-link the current side to the new template.
  ensureUniqueTemplateForSide: async (orderPackageId: string, side: string, isFinal: boolean) => {
    // 1) Fetch this side's securing row with template + beams
    const { data: secRows, error: secErr } = await supabase
      .from('order_package_securing')
      .select(`
        id,
        securing_template_id,
        securing_template:securing_template(
          id, quantity, type_id, thickness,
          horizontal_bar:beam!securing_template_horizontal_bar_fkey(id, quantity, type, width, thickness, space),
          vertical_bar:beam!securing_template_vertical_bar_fkey(id, quantity, type, width, thickness, space),
          skids:beam!securing_template_skids_fkey(id, quantity, type, width, thickness, space)
        )
      `)
      .eq('order_package_id', orderPackageId)
      .eq('securing_side', side)
      .eq('is_final', isFinal)
      .limit(1);
    if (secErr || !secRows || !secRows.length) return { data: null, error: secErr };
    const current = secRows[0] as any;
    const tmplId = current.securing_template_id;

    // If for any reason there is no template linked yet, create an empty one and link it
    if (!tmplId) {
      // Create empty beams
      const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
      const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
      let skId: any = null;
      if (side === 'base') { const { data: sk } = await supabase.from('beam').insert({}).select('id').single(); skId = sk?.id || null; }
      const tmplPayload: any = { quantity: null, type_id: null, thickness: null, horizontal_bar: hb?.id || null, vertical_bar: vb?.id || null };
      if (skId) tmplPayload.skids = skId;
      const { data: newEmpty, error: newErr } = await supabase
        .from('securing_template')
        .insert(tmplPayload)
        .select('id')
        .single();
      if (newErr || !newEmpty) return { data: null, error: newErr };
      const { error: linkErr } = await supabase
        .from('order_package_securing')
        .update({ securing_template_id: newEmpty.id })
        .eq('id', current.id);
      if (linkErr) return { data: null, error: linkErr };
      return { data: { id: newEmpty.id, created: true }, error: null };
    }

    // 2) Count how many rows reference this template id
    const { data: others, error: countErr } = await supabase
      .from('order_package_securing')
      .select('id, securing_side')
      .eq('securing_template_id', tmplId);
    if (countErr) return { data: null, error: countErr };
    if ((others || []).length <= 1) return { data: { id: tmplId, unchanged: true }, error: null };

    // 3) Clone beams
    const cloneBeam = async (b: any) => {
      if (!b?.id) return null;
      const { data: nb, error: bErr } = await supabase
        .from('beam')
        .insert({
          quantity: b.quantity ?? null,
          type: b.type ?? null,
          width: b.width ?? null,
          thickness: b.thickness ?? null,
          space: b.space ?? null,
        })
        .select('id')
        .single();
      if (bErr) throw bErr;
      return nb?.id || null;
    };

    let hbId: string | null = null; let vbId: string | null = null; let skId: string | null = null;
    try {
      hbId = await cloneBeam(current.securing_template?.horizontal_bar);
      vbId = await cloneBeam(current.securing_template?.vertical_bar);
      if (side === 'base' && current.securing_template?.skids) {
        skId = await cloneBeam(current.securing_template?.skids);
      }
    } catch (e) {
      return { data: null, error: e };
    }

    // 4) Clone template
    const tmplPayload: any = {
      quantity: current.securing_template?.quantity ?? null,
      type_id: current.securing_template?.type_id ?? null,
      thickness: current.securing_template?.thickness ?? null,
      horizontal_bar: hbId,
      vertical_bar: vbId,
    };
    if (skId) tmplPayload.skids = skId;

    const { data: newTmpl, error: tmplErr } = await supabase
      .from('securing_template')
      .insert(tmplPayload)
      .select('id')
      .single();
    if (tmplErr || !newTmpl) return { data: null, error: tmplErr };

    // 5) Relink this side to new template
    const { error: updErr } = await supabase
      .from('order_package_securing')
      .update({ securing_template_id: newTmpl.id })
      .eq('id', current.id);
    if (updErr) return { data: null, error: updErr };

    return { data: { id: newTmpl.id, cloned: true }, error: null };
  },

  // Ensure final securing rows exist (empty) for any side that has an original
  ensureFinalSecuringForPackage: async (orderPackageId: string) => {
    // Load existing securing records for this package
    const { data: rows, error } = await supabase
      .from('order_package_securing')
      .select('id, securing_side, is_final')
      .eq('order_package_id', orderPackageId);
    if (error) return { data: null, error };

    const sides = ['big_sides','small_sides','lid','base'] as const;
    const hasOriginal: Record<string, boolean> = {};
    const hasFinal: Record<string, boolean> = {};
    (rows || []).forEach((r: any) => {
      if (r.is_final) hasFinal[r.securing_side] = true; else hasOriginal[r.securing_side] = true;
    });

    for (const side of sides) {
      if (hasOriginal[side] && !hasFinal[side]) {
        // Create empty beams
        const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
        const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
        let skId: any = null;
        if (side === 'base') {
          const { data: sk } = await supabase.from('beam').insert({}).select('id').single();
          skId = sk?.id || null;
        }

        // Create empty template pointing to empty beams
        const tmplPayload: any = { quantity: null, type_id: null, thickness: null, horizontal_bar: hb?.id || null, vertical_bar: vb?.id || null };
        if (skId) tmplPayload.skids = skId;
        const { data: tmpl, error: tmplErr } = await supabase
          .from('securing_template')
          .insert(tmplPayload)
          .select('id')
          .single();
        if (tmplErr) return { data: null, error: tmplErr };

        // Create final securing row
        const { error: secErr } = await supabase
          .from('order_package_securing')
          .insert({ order_package_id: orderPackageId, securing_template_id: tmpl?.id, securing_side: side, is_final: true })
          .select('id')
          .single();
        if (secErr) return { data: null, error: secErr };
      }
    }

    return { data: { ensured: true }, error: null };
  },

  // Ensure Final templates are empty and isolated from Original or other sides for this package
  decoupleAndClearFinalTemplates: async (orderPackageId: string) => {
    // Load all securing rows with template id
    const { data: rows, error } = await supabase
      .from('order_package_securing')
      .select('id, securing_side, is_final, securing_template_id')
      .eq('order_package_id', orderPackageId);
    if (error) return { data: null, error };

    // Build reference counts for template usage within this package
    const counts: Record<string, number> = {};
    (rows || []).forEach((r: any) => { if (r.securing_template_id) counts[r.securing_template_id] = (counts[r.securing_template_id] || 0) + 1; });

    // For each FINAL row, if its template is shared OR null, then create a brand new EMPTY template and link it
    for (const r of (rows || [])) {
      if (!r.is_final) continue;
      const tmplId = r.securing_template_id;
      const needsNew = !tmplId || (counts[tmplId] || 0) > 1;
      if (!needsNew) continue;

      // Create empty beams
      const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
      const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
      let skId: any = null;
      if (r.securing_side === 'base') { const { data: sk } = await supabase.from('beam').insert({}).select('id').single(); skId = sk?.id || null; }

      // Empty template payload
      const emptyTmpl: any = { quantity: null, type_id: null, thickness: null, horizontal_bar: hb?.id || null, vertical_bar: vb?.id || null };
      if (skId) emptyTmpl.skids = skId;
      const { data: newTmpl, error: newErr } = await supabase
        .from('securing_template')
        .insert(emptyTmpl)
        .select('id')
        .single();
      if (newErr || !newTmpl) return { data: null, error: newErr };

      const { error: linkErr } = await supabase
        .from('order_package_securing')
        .update({ securing_template_id: newTmpl.id })
        .eq('id', r.id);
      if (linkErr) return { data: null, error: linkErr };
    }

    return { data: { normalized: true }, error: null };
  },

  // Ensure there is a securing row for a specific side and tier; create empty beams/template if missing
  ensureSecuringRowForSide: async (orderPackageId: string, side: string, isFinal: boolean) => {
    // Check existence
    const { data: existing, error: existErr } = await supabase
      .from('order_package_securing')
      .select('id, securing_template_id')
      .eq('order_package_id', orderPackageId)
      .eq('securing_side', side)
      .eq('is_final', isFinal)
      .limit(1);
    if (existErr) return { data: null, error: existErr };
    if (existing && existing.length) return { data: existing[0], error: null };

    // Create empty beams and template
    const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
    const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
    let skId: any = null;
    if (side === 'base') { const { data: sk } = await supabase.from('beam').insert({}).select('id').single(); skId = sk?.id || null; }

    const tmplPayload: any = { quantity: null, type_id: null, thickness: null, horizontal_bar: hb?.id || null, vertical_bar: vb?.id || null };
    if (skId) tmplPayload.skids = skId;
    const { data: tmpl, error: tmplErr } = await supabase
      .from('securing_template')
      .insert(tmplPayload)
      .select('id')
      .single();
    if (tmplErr) return { data: null, error: tmplErr };

    const { data: created, error: insErr } = await supabase
      .from('order_package_securing')
      .insert({ order_package_id: orderPackageId, securing_template_id: tmpl?.id, securing_side: side, is_final: isFinal })
      .select('id, securing_template_id')
      .single();
    return { data: created, error: insErr };
  },

  // Ensure original securing rows exist (empty) if missing
  ensureOriginalSecuringForPackage: async (orderPackageId: string) => {
    const { data: rows, error } = await supabase
      .from('order_package_securing')
      .select('id, securing_side, is_final')
      .eq('order_package_id', orderPackageId);
    if (error) return { data: null, error };

    const sides = ['big_sides','small_sides','lid','base'] as const;
    const hasOriginal: Record<string, boolean> = {};
    (rows || []).forEach((r: any) => { if (!r.is_final) hasOriginal[r.securing_side] = true; });

    for (const side of sides) {
      if (!hasOriginal[side]) {
        const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
        const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
        let skId: any = null;
        if (side === 'base') { const { data: sk } = await supabase.from('beam').insert({}).select('id').single(); skId = sk?.id || null; }
        const tmplPayload: any = { quantity: null, type_id: null, thickness: null, horizontal_bar: hb?.id || null, vertical_bar: vb?.id || null };
        if (skId) tmplPayload.skids = skId;
        const { data: tmpl, error: tmplErr } = await supabase
          .from('securing_template')
          .insert(tmplPayload)
          .select('id')
          .single();
        if (tmplErr) return { data: null, error: tmplErr };

        const { error: secErr } = await supabase
          .from('order_package_securing')
          .insert({ order_package_id: orderPackageId, securing_template_id: tmpl?.id, securing_side: side, is_final: false })
          .select('id')
          .single();
        if (secErr) return { data: null, error: secErr };
      }
    }

    return { data: { ensured: true }, error: null };
  },

  // Packaging: fetch package items for many order_package_ids
  getPackageItemsByOrderPackageIds: async (orderPackageIds) => {
    if (!orderPackageIds || orderPackageIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('package_items')
      .select('order_package_id, designation, quantity')
      .in('order_package_id', orderPackageIds);
    return { data, error };
  },

  // Packaging: add a single package item
  addPackageItem: async ({ order_package_id, designation, quantity }) => {
    const { data, error } = await supabase
      .from('package_items')
      .insert({ order_package_id, designation, quantity })
      .select('id')
      .single();
    return { data, error };
  },

  // Tasks: list available task types
  getTasks: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, name, description')
      .order('name');
    return { data, error };
  },

  // Team packers for an order (with status)
  getTeamPackersForOrder: async (orderId) => {
    const { data, error } = await supabase
      .from('order_team_members')
      .select('packer_id, profiles(id, full_name, username, packer_status)')
      .eq('order_id', orderId);
    if (error) return { data: null, error };
    const team = (data || []).map((row: any) => row.profiles).filter(Boolean);
    return { data: team, error: null };
  },

  // Task logs by order package ids (aggregated)
  getTaskLogsByOrderPackageIds: async (orderPackageIds) => {
    if (!orderPackageIds || orderPackageIds.length === 0) return { data: [], error: null };
    
    // More robust approach: use inner join with task_packages to guarantee scope
    const { data, error } = await supabase
      .from('task_logs')
      .select(`
        id, 
        start_time, 
        end_time, 
        duration_minutes, 
        pause_duration, 
        task_id, 
        update_counter, 
        notes,
        tasks(name),
        task_assignments(packer_id, task_status, profiles(full_name)),
        task_packages!inner(order_package_id)
      `)
      .in('task_packages.order_package_id', orderPackageIds)
      .order('start_time', { ascending: false });
    return { data, error };
  },

  // Fetch order_package_ids linked to a task log
  getTaskPackages: async (taskLogId: string) => {
    const { data, error } = await supabase
      .from('task_packages')
      .select('order_package_id')
      .eq('task_log_id', taskLogId);
    if (error) return { data: null, error };
    const ids = (data || []).map((r: any) => r.order_package_id).filter(Boolean);
    return { data: ids, error: null };
  },

  // Get task logs specifically for a single order package
  getTaskLogsForPackage: async (orderPackageId: string) => {
    if (!orderPackageId) return { data: [], error: null };
    
    // Step 1: find task_log ids via task_packages for this specific package
    const { data: tps, error: tpErr } = await supabase
      .from('task_packages')
      .select('task_log_id')
      .eq('order_package_id', orderPackageId);
    if (tpErr) return { data: null, error: tpErr };
    
    const logIds = Array.from(new Set((tps || []).map((t: any) => t.task_log_id).filter(Boolean)));
    if (logIds.length === 0) return { data: [], error: null };

    // Step 2: fetch logs with task name and assignments
    const { data, error } = await supabase
      .from('task_logs')
      .select('id, start_time, end_time, duration_minutes, pause_duration, task_id, update_counter, notes, tasks(name), task_assignments(packer_id, task_status, profiles(full_name))')
      .in('id', logIds)
      .order('start_time', { ascending: false });
    return { data, error };
  },

  // Link additional order packages to an existing task log
  addTaskPackages: async (taskLogId: string, orderPackageIds: string[]) => {
    if (!orderPackageIds || orderPackageIds.length === 0) return { data: [], error: null };
    // Filter out already linked ids
    const { data: existing } = await supabase
      .from('task_packages')
      .select('order_package_id')
      .eq('task_log_id', taskLogId);
    const existingSet = new Set((existing || []).map((r: any) => r.order_package_id));
    const toInsert = orderPackageIds.filter(id => id && !existingSet.has(id));
    if (toInsert.length === 0) return { data: [], error: null };
    const rows = toInsert.map(opId => ({ task_log_id: taskLogId, order_package_id: opId }));
    const { data, error } = await supabase.from('task_packages').insert(rows).select('order_package_id');
    return { data, error };
  },

  getTaskLogById: async (id) => {
    const { data, error } = await supabase
      .from('task_logs')
      .select('id, start_time, end_time, duration_minutes, pause_duration, task_id, update_counter, notes, tasks(name)')
      .eq('id', id)
      .single();
    return { data, error };
  },

  updateTaskLogFields: async (id, fields) => {
    const { data, error } = await supabase
      .from('task_logs')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, update_counter, pause_duration')
      .single();
    return { data, error };
  },

  incrementTaskLogCounter: async (id, fields = {}) => {
    // Fetch current counter then increment
    const { data: curr } = await supabase
      .from('task_logs')
      .select('update_counter')
      .eq('id', id)
      .single();
    const next = (curr?.update_counter || 0) + 1;
    const { data, error } = await supabase
      .from('task_logs')
      .update({ ...fields, update_counter: next, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, update_counter')
      .single();
    return { data, error };
  },

  addPauseDuration: async (id, seconds) => {
    // Fetch current and add seconds
    const { data: curr } = await supabase
      .from('task_logs')
      .select('pause_duration, update_counter')
      .eq('id', id)
      .single();
    const nextPause = (Number(curr?.pause_duration) || 0) + (seconds || 0);
    const nextCounter = (curr?.update_counter || 0) + 1;
    const { data, error } = await supabase
      .from('task_logs')
      .update({ pause_duration: nextPause, update_counter: nextCounter, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, pause_duration, update_counter')
      .single();
    return { data, error };
  },

  updateTaskAssignmentsStatus: async (taskId, status, packerIds = null) => {
    let q = supabase.from('task_assignments').update({ task_status: status }).eq('task_id', taskId);
    if (packerIds && packerIds.length) q = q.in('packer_id', packerIds);
    const { data, error } = await q.select('id');
    return { data, error };
  },

  // Finish a task without RPC: compute minutes on client and persist end_time + duration_minutes
  finishTaskLog: async (taskLogId: string) => {
    const nowIso = new Date().toISOString();
    // 1) fetch the current row to compute delta
    const { data: row, error: fetchErr } = await supabase
      .from('task_logs')
      .select('id, start_time, restart_time, duration_minutes')
      .eq('id', taskLogId)
      .single();
    if (fetchErr || !row) return { data: null, error: fetchErr };

    const start = row.restart_time ? new Date(row.restart_time) : new Date(row.start_time);
    const now = new Date();
    const deltaMin = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
    const current = typeof row.duration_minutes === 'number' ? row.duration_minutes : 0;
    const newTotal = current + deltaMin;

    // 2) update end_time and duration_minutes atomically
    const { data, error } = await supabase
      .from('task_logs')
      .update({ end_time: nowIso, duration_minutes: newTotal })
      .eq('id', taskLogId)
      .select('id, end_time, duration_minutes')
      .single();
    return { data, error };
  },

  // Restart a completed task: check assigned packers availability, then
  // clear end_time, set restart_time, bump update_counter, and set assignments to in_progress
  restartTaskLog: async (taskLogId: string) => {
    // 1) find assigned packers for this task
    const { data: assignedRows, error: assignedErr } = await supabase
      .from('task_assignments')
      .select('packer_id')
      .eq('task_id', taskLogId);
    if (assignedErr) return { data: null, error: assignedErr };
    const assignedIds = (assignedRows || []).map((r: any) => r.packer_id).filter(Boolean);

    // 2) check if any assigned packer is busy on another task
    if (assignedIds.length > 0) {
      const { data: busyRows, error: busyErr } = await supabase
        .from('task_assignments')
        .select('packer_id, task_id')
        .in('packer_id', assignedIds)
        .eq('task_status', 'in_progress')
        .neq('task_id', taskLogId);
      if (busyErr) return { data: null, error: busyErr };
      if ((busyRows || []).length > 0) {
        return { data: { canRestart: false }, error: null };
      }
    }

    // 3) bump update_counter and set restart_time/end_time
    const { data: curr, error: readErr } = await supabase
      .from('task_logs')
      .select('update_counter')
      .eq('id', taskLogId)
      .single();
    if (readErr) return { data: null, error: readErr };

    const nextCounter = (curr?.update_counter || 0) + 1;

    // Try ISO timestamp first; if the column is numeric on this project, fall back to epoch seconds
    let updErr: any = null;
    {
      const { error } = await supabase
        .from('task_logs')
        .update({ restart_time: new Date().toISOString(), end_time: null, update_counter: nextCounter })
        .eq('id', taskLogId);
      updErr = error;
    }

    if (updErr && updErr.code === '22P02') {
      // Column is likely numeric; use epoch seconds
      const epochSec = Math.floor(Date.now() / 1000);
      const { error: fallbackErr } = await supabase
        .from('task_logs')
        .update({ restart_time: epochSec, end_time: null, update_counter: nextCounter })
        .eq('id', taskLogId);
      if (fallbackErr) return { data: null, error: fallbackErr };
    } else if (updErr) {
      return { data: null, error: updErr };
    }

    // 4) flip all assignments on this task to in_progress
    const { error: statusErr } = await supabase
      .from('task_assignments')
      .update({ task_status: 'in_progress' })
      .eq('task_id', taskLogId);
    if (statusErr) return { data: null, error: statusErr };

    return { data: { canRestart: true }, error: null };
  },

  // Compute busy packers from ACTIVE task logs only (end_time IS NULL).
  // Treat both 'in_progress' and 'paused' assignments as busy.
  getBusyPackerIds: async () => {
    const { data, error } = await supabase
      .from('task_logs')
      .select('id, end_time, task_assignments(packer_id, task_status)')
      .is('end_time', null);
    
    // Defensive error handling - always return an array, never null
    if (error) {
      console.warn('getBusyPackerIds error:', error);
      return { data: [], error };
    }
    
    if (!data || !Array.isArray(data)) {
      return { data: [], error: null };
    }
    
    const busySet = new Set<string>();
    data.forEach((log: any) => {
      if (!log || !Array.isArray(log.task_assignments)) return;
      log.task_assignments.forEach((a: any) => {
        if (a && ['in_progress', 'paused'].includes(a.task_status) && a.packer_id) {
          busySet.add(a.packer_id);
        }
      });
    });
    return { data: Array.from(busySet), error: null };
  },

  addTaskAssignments: async (taskId, packerIds) => {
    if (!packerIds || packerIds.length === 0) return { data: [], error: null };
    const rows = packerIds.map((pid: string) => ({ task_id: taskId, packer_id: pid }));
    const { data, error } = await supabase
      .from('task_assignments')
      .insert(rows)
      .select('id');
    return { data, error };
  },

  removeTaskAssignments: async (taskId, packerIds) => {
    if (!packerIds || packerIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('task_assignments')
      .delete()
      .eq('task_id', taskId)
      .in('packer_id', packerIds)
      .select('id');
    return { data, error };
  },

  // Create a task log, link packages, and assign packers
  startTaskForPackages: async ({ taskTypeId, orderPackageIds, packerIds, notes = null }) => {
    const nowIso = new Date().toISOString();
    // 1) create task log (initialize counters to 0)
    const { data: logIns, error: logErr } = await supabase
      .from('task_logs')
      .insert({ start_time: nowIso, task_id: taskTypeId, notes, pause_duration: 0, duration_minutes: 0, update_counter: 0 })
      .select()
      .single();
    if (logErr || !logIns) return { data: null, error: logErr || { message: 'Failed to create task log' } };

    const logId = logIns.id;

    // 2) link packages (consolidation)
    if (orderPackageIds && orderPackageIds.length) {
      const pkgRows = orderPackageIds.map((opId: string) => ({ task_log_id: logId, order_package_id: opId }));
      const { error: pkErr } = await supabase.from('task_packages').insert(pkgRows);
      if (pkErr) return { data: null, error: pkErr };
    }

    // 3) assign packers (task_status defaults to in_progress)
    if (packerIds && packerIds.length) {
      const assignRows = packerIds.map((pid: string) => ({ task_id: logId, packer_id: pid }));
      const { error: asErr } = await supabase.from('task_assignments').insert(assignRows);
      if (asErr) return { data: null, error: asErr };
    }

    return { data: { task_log_id: logId }, error: null };
  },

  // Task Management Functions (implementing rule-based behavior)
  
  // Check if a task can be resumed
  canResumeTask: async (taskLogId) => {
    const { data, error } = await supabase
      .rpc('can_resume_task', { task_log_id: taskLogId });
    return { data, error };
  },

  // Resume a completed task (checks packer availability first)
  resumeTask: async (taskLogId) => {
    const { data, error } = await supabase
      .rpc('resume_task', { task_log_id: taskLogId });
    return { data, error };
  },

  // Complete a task properly (updates assignments and duration)
  completeTask: async (taskLogId) => {
    const { data, error } = await supabase
      .rpc('complete_task', { task_log_id: taskLogId });
    return { data, error };
  },

  // Pause a task (records pause duration)
  pauseTask: async (taskLogId) => {
    const { data, error } = await supabase
      .rpc('pause_task', { task_log_id: taskLogId });
    return { data, error };
  },

  // Resume from pause (adds pause duration to task log)
  unpauseTask: async (taskLogId, pauseDurationSeconds = null) => {
    const { data, error } = await supabase
      .rpc('unpause_task', { 
        task_log_id: taskLogId, 
        pause_duration_seconds: pauseDurationSeconds 
      });
    return { data, error };
  },

  // Get comprehensive task status (for UI state management)
  getTaskStatusView: async (taskLogIds = null) => {
    let query = supabase.from('task_status_view').select('*');
    
    if (taskLogIds && taskLogIds.length > 0) {
      query = query.in('task_log_id', taskLogIds);
    }
    
    const { data, error } = await query.order('start_time', { ascending: false });
    return { data, error };
  },

  // Get active tasks for order packages (for task tab persistence)
  getActiveTasksForPackages: async (orderPackageIds) => {
    if (!orderPackageIds || orderPackageIds.length === 0) return { data: [], error: null };
    
    const { data, error } = await supabase
      .from('task_status_view')
      .select('*')
      .neq('overall_status', 'completed')
      .in('task_log_id', 
        supabase
          .from('task_packages')
          .select('task_log_id')
          .in('order_package_id', orderPackageIds)
      );
    
    return { data, error };
  },
};

export default supabase;
