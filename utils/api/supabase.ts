import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { Json, Maybe, NullableDate, SupabaseUpdatePayload, UUID } from './types';
import { createAttendanceApi } from './modules/attendance';
import { createPackingApi } from './modules/packing';
import { createTasksApi } from './modules/tasks';

interface AttendanceWindow {
  orderId: UUID;
  packerId: UUID;
  shiftPeriod: string;
}

interface PackageItemInput {
  order_package_id?: UUID;
  orderPackageId?: UUID;
  designation: string;
  quantity: number;
}

interface FinalDimensionInput {
  orderPackageId: UUID;
  finalInfoId?: UUID | null;
  originalInfoId?: UUID | null;
  scope: string;
  length: number | null;
  width: number | null;
  height: number | null;
}

interface PackageInfoInput {
  orderPackageId: UUID;
  finalInfoId?: UUID | null;
  originalInfoId?: UUID | null;
}

const unwrapSingleRelation = <T>(relation: T | T[] | null | undefined): T | null => {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation ?? null;
};

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = Constants.expoConfig?.extra?.supabasePublishableKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Sign in with phone/OTP (for packers)
  signInWithPhone: async (phone: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });
    return { data, error };
  },

  // Verify OTP
  verifyOtp: async (phone: string, token: string) => {
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
  getUserByUsername: async (username: string) => {
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
  signInWithUsername: async (username: string, password: string) => {
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
const baseDb = {
  // Clear profile cache (useful when profile is updated)
  clearProfileCache: (userId?: string) => {
    if (userId) {
      profileCache.delete(userId);
    } else {
      profileCache.clear();
    }
  },

  // Get user profile with role (with caching)
  getUserProfile: async (userId: UUID) => {
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
      .in('production_status', ['pending', 'in_progress', 'on_hold'])
      .order('order_name');
    
    if (error) return { data: null, error };
    
    // Transform the data to match expected format
    const transformedData = data?.map(order => {
      const client = unwrapSingleRelation<{ name?: string }>(order.clients);
      return {
        id: order.id,
        order_name: order.order_name,
        description: order.description,
        production_status: order.production_status,
        client_name: client?.name || 'Unknown Client',
        assigned_packers_count: 0 // This could be calculated if needed
      };
    }) || [];
    
    return { data: transformedData, error };
  },

  // Get available packers
  getAvailablePackers: async () => {
    const { data, error } = await supabase
      .rpc('get_available_packers');
    
    return { data, error };
  },

  endAttendanceForPackers: async (orderId: UUID, packerIds: UUID[]) => {
    if (!orderId || !packerIds || packerIds.length === 0) {
      return { data: [], error: null };
    }

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('attendance_logs')
      .update({
        end_time: nowIso,
        updated_at: nowIso,
      })
      .eq('order_id', orderId)
      .in('packer_id', packerIds)
      .is('end_time', null)
      .select('id');

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
  assignPackersToOrder: async (orderId: UUID, packerIds: UUID[]) => {
    const { data, error } = await supabase
      .rpc('assign_packers_to_order', {
        order_uuid: orderId,
        packer_ids: packerIds
      });
    
    return { data, error };
  },

  // Log attendance with comprehensive data
  logAttendance: async (
    orderId: UUID,
    packerId: UUID,
    shiftPeriod: string,
    status: string,
    startTime: NullableDate = null,
    endTime: NullableDate = null,
    toolboxBriefing = false,
    isProjectStart = false
  ) => {
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
  updateAttendanceEndTime: async (attendanceId: UUID, endTime: NullableDate) => {
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
  updateAttendanceEndTimeByDetails: async (
    orderId: UUID,
    packerId: UUID,
    shiftPeriod: string,
    endTime: NullableDate,
    logDateOverride?: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = logDateOverride || today;
    
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ 
        end_time: endTime, 
        updated_at: new Date().toISOString() 
      })
      .eq('order_id', orderId)
      .eq('packer_id', packerId)
      .eq('shift_period', shiftPeriod)
      .eq('log_date', targetDate)
      .is('end_time', null) // Only update records without end time
      .select();
    
    return { data, error };
  },

  // Mark toolbox briefing as completed for the whole order and current shift (today)
  setToolboxBriefingForOrderShift: async (orderId: UUID, shiftPeriod: string) => {
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
  updateAttendanceForRestart: async (
    orderId: UUID,
    packerId: UUID,
    shiftPeriod: string,
    startTimeIso: string
  ) => {
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
  getActiveAttendance: async (orderId: UUID, packerId: UUID, shiftPeriod: string) => {
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
  getTodaysAttendance: async (orderId: UUID) => {
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
  hasLoggedAttendanceToday: async (orderId: UUID, _packerId: UUID) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .rpc('packer_logged_attendance_today', {
        order_uuid: orderId
      });
    
    return { data, error };
  },

  // Get order by ID with project lead
  getOrderById: async (orderId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_name,
        description,
        production_status,
        commercial_status,
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
      const client = unwrapSingleRelation<{ name?: string }>(data.clients);
      const projectLead = unwrapSingleRelation<{ full_name?: string }>(data.project_lead);
      return {
        data: {
          id: data.id,
          order_name: data.order_name,
          description: data.description,
          production_status: data.production_status || null,
          commercial_status: data.commercial_status || null,
          client_name: client?.name || 'Unknown Client',
          project_lead_name: projectLead?.full_name || ''
        },
        error
      };
    }
    
    return { data, error };
  },

  // Get packers by IDs
  getPackersByIds: async (packerIds: UUID[]) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', packerIds);
    
    return { data, error };
  },

  // Get packers assigned to an order (using new JSON structure)
  getOrderPackers: async (orderId: UUID) => {
    const { data, error } = await supabase
      .rpc('get_order_packers', {
        order_uuid: orderId
      });
    
    return { data, error };
  },

  // Remove self from order (packer self-removal)
  removeSelfFromOrder: async (orderId: UUID, packerId: UUID) => {
    const { data, error } = await supabase
      .rpc('remove_self_from_order', {
        order_uuid: orderId,
        packer_uuid: packerId
      });
    
    return { data, error };
  },

  // Get all packers with their current assignment status
  getAllPackersWithStatus: async () => {
    // Query directly instead of using RPC to avoid caching issues
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        username,
        packer_status,
        current_order_id,
        orders:current_order_id (
          order_name
        )
      `)
      .eq('status', 'active')
      .order('full_name');
    
    if (error) return { data: null, error };
    
    // Transform to match expected format
    const transformed = (data || []).map(packer => {
      const currentOrder = unwrapSingleRelation<{ order_name?: string }>(packer.orders);
      return {
        id: packer.id,
        full_name: packer.full_name,
        username: packer.username,
        packer_status: packer.packer_status || 'available',
        current_order_name: currentOrder?.order_name || null
      };
    });
    
    return { data: transformed, error: null };
  },

  // Update project lead for an order
  updateProjectLead: async (orderId: UUID, projectLeadId: UUID) => {
    const { data, error } = await supabase
      .rpc('update_project_lead_with_status', {
        order_uuid: orderId,
        lead_id: projectLeadId
      });
    
    return { data, error };
  },

  setOrderProductionStatus: async (orderId: UUID, status: string) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ production_status: status })
      .eq('id', orderId)
      .select('id, production_status')
      .single();

    return { data, error };
  },

  getOrderPackageInternalDimensions: async (orderPackageId: string) => {
    type PackageInfoRow = {
      id: string;
      internal_length: number | null;
      internal_width: number | null;
      internal_height: number | null;
    };

    type DimensionTriple = {
      length: number | null;
      width: number | null;
      height: number | null;
    };

    const { data: pkg, error: pkgError } = await supabase
      .from('order_packages')
      .select('id, original_pkg_info, final_pkg_info')
      .eq('id', orderPackageId)
      .single();

    if (pkgError || !pkg) {
      return { data: null, error: pkgError };
    }

    const infoIds = [pkg.original_pkg_info, pkg.final_pkg_info].filter(Boolean) as string[];
    if (infoIds.length === 0) {
      return { data: { original: null, final: null }, error: null };
    }

    const { data: infoData, error: infoError } = await supabase
      .from('package_info')
      .select('id, internal_length, internal_width, internal_height')
      .in('id', infoIds);

    if (infoError) {
      return { data: null, error: infoError };
    }

    const lookup = new Map<string, PackageInfoRow>();
    (infoData as PackageInfoRow[] | null)?.forEach((row) => {
      lookup.set(row.id, row);
    });

    const toTriple = (row?: PackageInfoRow | null): DimensionTriple | null =>
      row
        ? {
            length: row.internal_length,
            width: row.internal_width,
            height: row.internal_height,
          }
        : null;

    return {
      data: {
        original: toTriple(pkg.original_pkg_info ? lookup.get(pkg.original_pkg_info) : null),
        final: toTriple(pkg.final_pkg_info ? lookup.get(pkg.final_pkg_info) : null),
      },
      error: null,
    };
  },
  /**
   * Upload media (image/video) to the 'media' bucket with structured folder path
   * Path: orders/{order_uuid}/{package_number}/{section}/{filename}
   * Also creates a record in the media table
   * 
   * @param orderPackageId - UUID of the order_package
   * @param fileUri - Local file URI from camera/gallery
   * @param designation - Enum value from media_category
   * @param notes - Optional notes (e.g., item name, task name, accessory name)
   * @returns { data: { mediaId, path, signedUrl }, error }
   */
  uploadMediaToStorage: async (orderPackageId: string, fileUri: string, designation: string, notes?: string) => {
    try {
      // 1. Get order_id and package_number from order_package
      const { data: packageData, error: pkgError } = await supabase
        .from('order_packages')
        .select('order_id, package_number')
        .eq('id', orderPackageId)
        .single();

      if (pkgError || !packageData) {
        return { data: null, error: pkgError || new Error('Order package not found') };
      }

      const { order_id, package_number } = packageData;

      // 2. Determine file type from URI
      const uriLower = fileUri.toLowerCase();
      let mimeType = 'image/jpeg';
      let ext = 'jpg';
      
      // Determine file extension and MIME type from URI
      if (uriLower.endsWith('.png')) {
        ext = 'png';
        mimeType = 'image/png';
      } else if (uriLower.endsWith('.jpg') || uriLower.endsWith('.jpeg')) {
        ext = 'jpg';
        mimeType = 'image/jpeg';
      } else if (uriLower.endsWith('.gif')) {
        ext = 'gif';
        mimeType = 'image/gif';
      } else if (uriLower.endsWith('.webp')) {
        ext = 'webp';
        mimeType = 'image/webp';
      } else if (uriLower.endsWith('.mp4')) {
        ext = 'mp4';
        mimeType = 'video/mp4';
      } else if (uriLower.endsWith('.mov')) {
        ext = 'mov';
        mimeType = 'video/quicktime';
      } else if (uriLower.endsWith('.avi')) {
        ext = 'avi';
        mimeType = 'video/x-msvideo';
      }

      // 3. Build folder structure: orders/{order_uuid}/{package_number}/{section}/
      const sectionFolder = designation; // Use designation as folder name
      const timestamp = Date.now();
      const filename = `${timestamp}.${ext}`;
      const fullPath = `orders/${order_id}/${package_number}/${sectionFolder}/${filename}`;

      // 4. Create file data for React Native
      // React Native needs ArrayBuffer or Blob-like structure
      const response = await fetch(fileUri);
      const arrayBuffer = await response.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      // 5. Upload to 'media' bucket
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('media')
        .upload(fullPath, fileData, { 
          contentType: mimeType,
          upsert: false // Don't overwrite existing files
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return { data: null, error: uploadError };
      }

      const storagePath = uploadData?.path || fullPath;

      // 6. Generate a signed URL (valid for 1 year) for private bucket access
      const { data: signedUrlData, error: urlError } = await supabase
        .storage
        .from('media')
        .createSignedUrl(storagePath, 31536000); // 1 year in seconds

      if (urlError) {
        console.warn('Could not create signed URL:', urlError);
      }

      const signedUrl = signedUrlData?.signedUrl || null;

      // 7. Insert record into media table
      const { data: mediaRecord, error: insertError } = await supabase
        .from('media')
        .insert({
          image_url: storagePath,
          notes: notes || null,
          order_package_id: orderPackageId,
          designation: designation
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Media record insert error:', insertError);
        // Try to clean up the uploaded file
        await supabase.storage.from('media').remove([storagePath]);
        return { data: null, error: insertError };
      }

      return { 
        data: { 
          mediaId: mediaRecord.id,
          path: storagePath,
          signedUrl: signedUrl
        }, 
        error: null 
      };
    } catch (e: any) {
      console.error('Unexpected error in uploadMediaToStorage:', e);
      return { data: null, error: e };
    }
  },

  /**
   * Get all media records for a specific order package
   * @param orderPackageId - UUID of the order_package
   * @returns Array of media records with signed URLs
   */
  getMediaForPackage: async (orderPackageId: string) => {
    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('order_package_id', orderPackageId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error };

      // Generate signed URLs for each media item
      const mediaWithUrls = await Promise.all(
        (data || []).map(async (item: any) => {
          const { data: signedUrlData } = await supabase
            .storage
            .from('media')
            .createSignedUrl(item.image_url, 31536000); // 1 year

          return {
            ...item,
            signedUrl: signedUrlData?.signedUrl || null
          };
        })
      );

      return { data: mediaWithUrls, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  },

  /**
   * Delete a media record and its associated file from storage
   * @param mediaId - UUID of the media record
   */
  deleteMedia: async (mediaId: string) => {
    try {
      // Get the media record first to find the storage path
      const { data: mediaRecord, error: fetchError } = await supabase
        .from('media')
        .select('image_url')
        .eq('id', mediaId)
        .single();

      if (fetchError || !mediaRecord) {
        return { data: null, error: fetchError || new Error('Media record not found') };
      }

      // Delete from storage
      const { error: storageError } = await supabase
        .storage
        .from('media')
        .remove([mediaRecord.image_url]);

      if (storageError) {
        console.warn('Storage deletion error:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('media')
        .delete()
        .eq('id', mediaId);

      if (deleteError) {
        return { data: null, error: deleteError };
      }

      return { data: { success: true }, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  },
  // Update order_package status (uses RPC for 'packed' to avoid RLS issues)
  updateOrderPackageStatus: async (orderPackageId: string, status: string) => {
    if (status === 'packed') {
      const { error } = await supabase.rpc('mark_order_package_packed', { op_id: orderPackageId });
      return { data: { id: orderPackageId }, error };
    }
    const { error } = await supabase
      .from('order_packages')
      .update({ status })
      .eq('id', orderPackageId);
    return { data: { id: orderPackageId }, error };
  },

  // Reset packer data for an order - removes all packer-entered data
  resetPackerData: async (orderId: string) => {
    try {
      // Get all packages for this order
      const { data: packages, error: pkgError } = await supabase
        .from('order_packages')
        .select('id, final_pkg_info')
        .eq('order_id', orderId);

      if (pkgError) throw pkgError;

      const packageIds = (packages || []).map(p => p.id);
      const finalInfoIds = (packages || []).map(p => p.final_pkg_info).filter(Boolean);

      // 1. Delete order_package_materials created by packers (is_final = true, original is null)
      if (packageIds.length > 0) {
        const { error: matError } = await supabase
          .from('order_package_materials')
          .delete()
          .in('order_package_id', packageIds)
          .eq('is_final', true)
          .is('original', null);
        if (matError) console.warn('Error deleting materials:', matError);
      }

      // 2. Delete tasks started by packers using RPC (bypasses RLS)
      // We use RPC because there are no DELETE policies on task_logs, task_packages, task_assignments
      // The CASCADE rules will automatically delete task_packages and task_assignments when we delete task_logs
      if (packageIds.length > 0) {
        console.log(`[RPC] Calling delete_tasks_for_order_packages with ${packageIds.length} package IDs`);
        const { data: rpcData, error: deleteTasksError } = await supabase
          .rpc('delete_tasks_for_order_packages', {
            package_ids: packageIds
          });
        
        if (deleteTasksError) {
          console.error('[RPC] Error deleting tasks for order packages:', deleteTasksError);
          console.error('[RPC] Error details:', JSON.stringify(deleteTasksError, null, 2));
        } else {
          console.log('[RPC] Successfully deleted task_logs (and cascaded task_packages, task_assignments)');
          console.log('[RPC] Response:', rpcData);
        }
      }

      // 3. Reset final package_info values to NULL
      if (finalInfoIds.length > 0) {
        const { error: infoError } = await supabase
          .from('package_info')
          .update({
            quantity: null,
            center_of_gravity: null,
            box_type_id: null,
            packing_type_id: null,
            tare: null,
            net_weight: null,
            gross_weight: null,
            internal_length: null,
            internal_width: null,
            internal_height: null,
            external_length: null,
            external_width: null,
            external_height: null
          })
          .in('id', finalInfoIds);
        if (infoError) console.warn('Error resetting package_info:', infoError);
      }

      // 4. Delete package_items created by packers (no final_quantity column, just delete non-admin items)
      // Skip this step as package_items don't have a final_quantity column
      // Items are managed by admin only, so we don't need to reset them

      // 5. Reset order_packages status using unpack RPC (handles status correctly)
      if (packageIds.length > 0) {
        for (const pkgId of packageIds) {
          try {
            // Use the unpack RPC which knows how to handle status transitions correctly
            const { error: unpackError } = await supabase.rpc('unpack_order_package', { op_id: pkgId });
            if (unpackError) {
              console.warn(`Error unpacking package ${pkgId}:`, unpackError);
            }
          } catch (e) {
            console.warn(`Exception unpacking package ${pkgId}:`, e);
          }
        }
      }

      // 6. Delete attendance logs for this order
      const { error: attendanceError } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('order_id', orderId);
      if (attendanceError) {
        console.warn('Error deleting attendance_logs:', attendanceError);
      } else {
        console.log('Successfully deleted attendance_logs for order');
      }

      // 7. Reset final securing templates (delete and recreate empty)
      if (packageIds.length > 0) {
        for (const pkgId of packageIds) {
          try {
            // Get all final securing rows for this package
            const { data: securingRows } = await supabase
              .from('order_package_securing')
              .select('id, securing_template_id')
              .eq('order_package_id', pkgId)
              .eq('is_final', true);

            if (securingRows && securingRows.length > 0) {
              for (const row of securingRows) {
                if (row.securing_template_id) {
                  // Get the template to find beam IDs
                  const { data: template } = await supabase
                    .from('securing_template')
                    .select('horizontal_bar, vertical_bar, skids')
                    .eq('id', row.securing_template_id)
                    .single();

                  // First, reset template fields to NULL (removes foreign key references)
                  await supabase
                    .from('securing_template')
                    .update({
                      quantity: null,
                      type_id: null,
                      thickness: null,
                      horizontal_bar: null,
                      vertical_bar: null,
                      skids: null
                    })
                    .eq('id', row.securing_template_id);

                  // Then delete beams (after references are removed)
                  if (template) {
                    const beamIds = [template.horizontal_bar, template.vertical_bar, template.skids].filter(Boolean);
                    if (beamIds.length > 0) {
                      const { error: beamError } = await supabase.from('beam').delete().in('id', beamIds);
                      if (beamError) console.warn('Error deleting beams:', beamError);
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`Error resetting securing for package ${pkgId}:`, e);
          }
        }
      }

      return { data: { success: true }, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  },

  getAllPackingTypes: async () => {
    const { data, error } = await supabase
      .from('packing_types')
      .select('id, code, name, includes_gas_protection, includes_vacuum_protection')
      .order('code');
    return { data, error };
  },
};

const attendanceApi = createAttendanceApi(supabase);
const packingApi = createPackingApi(supabase);
const tasksApi = createTasksApi(supabase);

export const db = {
  ...baseDb,
  ...attendanceApi,
  ...packingApi,
  ...tasksApi,
  query: supabase,
  auth: supabase.auth,
};

export default supabase;
