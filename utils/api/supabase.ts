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

  // Upsert final dimensions for an order package. If finalInfoId is missing, create it (cloning original if provided)
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

    if (!effectiveFinalId) {
      // Create final package_info by cloning from original if available
      let base: any = {};
      if (originalInfoId) {
        const { data: orig } = await supabase
          .from('package_info')
          .select('*')
          .eq('id', originalInfoId)
          .single();
        if (orig) {
          const { id, ...rest } = orig;
          base = { ...rest };
        }
      }
      const insertPayload = { ...base, ...fields };
      const { data: created, error: createErr } = await supabase
        .from('package_info')
        .insert(insertPayload)
        .select('id')
        .single();
      if (createErr || !created) return { data: null, error: createErr || { message: 'Failed to create final package info' } };
      effectiveFinalId = created.id;

      // Update order_packages.final_pkg_info
      const { error: updErr } = await supabase
        .from('order_packages')
        .update({ final_pkg_info: effectiveFinalId })
        .eq('id', orderPackageId);
      if (updErr) return { data: null, error: updErr };
    } else {
      // Update existing final package_info
      const { error: updFinalErr } = await supabase
        .from('package_info')
        .update(fields)
        .eq('id', effectiveFinalId);
      if (updFinalErr) return { data: null, error: updFinalErr };
    }

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

  // Packaging: packing types lookup
  getPackingTypesByIds: async (ids) => {
    if (!ids || ids.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('packing_types')
      .select('id, name, code')
      .in('id', ids);
    return { data, error };
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

  // Material variants filtered by tag name (e.g., 'accessories')
  getMaterialVariantsByTag: async (tagName) => {
    // Step 1: find materials that have the given tag
    const { data: mats, error: matsErr } = await supabase
      .from('material_tags')
      .select('material_id, tags(name)')
      .eq('tags.name', tagName);
    if (matsErr) return { data: null, error: matsErr };
    const materialIds = Array.from(new Set((mats || []).map((r: any) => r.material_id).filter(Boolean)));
    if (!materialIds.length) return { data: [], error: null };

    // Step 2: fetch all variants for these materials
    const { data: variants, error: varErr } = await supabase
      .from('material_variants')
      .select('id, variant_name, material_id')
      .in('material_id', materialIds)
      .order('variant_name');
    if (varErr) return { data: null, error: varErr };

    const items = (variants || []).map((v: any) => ({ id: v.id, value: v.id, label: v.variant_name, material_id: v.material_id }));
    return { data: items, error: null };
  },

  // Get order package materials (used by Accessories)
  getOrderPackageMaterials: async (orderPackageId) => {
    const { data, error } = await supabase
      .from('order_package_materials')
      .select('id, order_package_id, material_variant_id, quantity, unit_id, length, width, comment, item_used')
      .eq('order_package_id', orderPackageId)
      .order('created_at', { ascending: true });
    return { data, error };
  },

  addOrderPackageMaterial: async (payload) => {
    const { data, error } = await supabase
      .from('order_package_materials')
      .insert(payload)
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

  getAllPackingTypes: async () => {
    const { data, error } = await supabase
      .from('packing_types')
      .select('id, code, name')
      .order('code');
    return { data, error };
  },

  updatePackageInfo: async (id, fields) => {
    const { data, error } = await supabase
      .from('package_info')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single();
    return { data, error };
  },

  ensureFinalPackageInfo: async ({ orderPackageId, finalInfoId, originalInfoId }) => {
    if (finalInfoId) return { data: { id: finalInfoId }, error: null };
    if (!originalInfoId) {
      const { data: created, error: createErr } = await supabase
        .from('package_info')
        .insert({})
        .select('id')
        .single();
      if (createErr || !created) return { data: null, error: createErr };
      const { error: updErr } = await supabase
        .from('order_packages')
        .update({ final_pkg_info: created.id })
        .eq('id', orderPackageId);
      if (updErr) return { data: null, error: updErr };
      return { data: { id: created.id }, error: null };
    }
    const { data: orig, error: oErr } = await supabase
      .from('package_info')
      .select('*')
      .eq('id', originalInfoId)
      .single();
    if (oErr) return { data: null, error: oErr };
    const { id, created_at, updated_at, ...rest } = orig || {};
    const { data: newRow, error: nErr } = await supabase
      .from('package_info')
      .insert(rest || {})
      .select('id')
      .single();
    if (nErr || !newRow) return { data: null, error: nErr };
    const { error: linkErr } = await supabase
      .from('order_packages')
      .update({ final_pkg_info: newRow.id })
      .eq('id', orderPackageId);
    if (linkErr) return { data: null, error: linkErr };
    return { data: { id: newRow.id }, error: null };
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
      .single();
    return { data, error };
  },

  updateBeam: async (beamId, fields) => {
    const { data, error } = await supabase
      .from('beam')
      .update({ ...fields })
      .eq('id', beamId)
      .select('id')
      .single();
    return { data, error };
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
    // Step 1: find task_log ids via task_packages
    const { data: tps, error: tpErr } = await supabase
      .from('task_packages')
      .select('task_log_id')
      .in('order_package_id', orderPackageIds);
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

  // Compute busy packers: any packer with an assignment to a task_log that has no end_time (in progress)
  getBusyPackerIds: async () => {
    const { data, error } = await supabase
      .from('task_assignments')
      .select('packer_id, task_status')
      .eq('task_status', 'in_progress');
    if (error) return { data: null, error };
    const busy = Array.from(new Set((data || []).map((r: any) => r.packer_id).filter(Boolean)));
    return { data: busy, error: null };
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
