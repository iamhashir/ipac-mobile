import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { Json, Maybe, NullableDate, SupabaseUpdatePayload, UUID } from './types';
import { createAttendanceApi } from './modules/attendance';
import { createPackingApi } from './modules/packing';
import { createTasksApi } from './modules/tasks';
import { createServicesApi } from './modules/services';
import { getCachedSignedUrl } from '../cache/signedUrlCache';

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
  reference?: string | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  net_weight?: number | null;
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

type ProjectType = 'standard' | 'maintenance' | 'survey';

interface CreatePackerProjectInput {
  projectType: ProjectType;
  clientId: UUID;
  createdBy?: UUID | null;
  orderName?: string | null;
  description?: string | null;
}

type MaintenanceTaskCategory = 'survey' | 'unpack' | 'repack';

const unwrapSingleRelation = <T>(relation: T | T[] | null | undefined): T | null => {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation ?? null;
};

const getMappedCategoryIdsForOrder = async (orderId?: UUID | null) => {
  if (!orderId) {
    return { data: [] as string[], error: null };
  }

  const { data, error } = await supabase
    .from('category_order_map')
    .select('category_id')
    .eq('order_id', orderId)
    .not('category_id', 'is', null);

  if (error) {
    return { data: null, error };
  }

  const categoryIds = Array.from(
    new Set(
      (data || [])
        .map((row: any) => String(row?.category_id || '').trim())
        .filter((id) => id.length > 0)
    )
  );

  return { data: categoryIds, error: null };
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
      // Normalize: lowercase + strip ALL whitespace so a lookup never misses on
      // casing or stray spaces, regardless of how the caller passed it in.
      const lookupUsername = (username || '').toLowerCase().replace(/\s/g, '');
      console.log('🔍 Looking up username:', lookupUsername);

      // Use a stored function to lookup username securely
      // This bypasses RLS policies since it runs with elevated privileges
      const { data, error } = await supabase
        .rpc('get_user_email_by_username', {
          lookup_username: lookupUsername
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
        project_type,
        production_status,
        clients (
          name
        )
      `)
      .in('production_status', ['pending', 'in_progress', 'on_hold'])
      .order('order_name');
    
    if (error) return { data: null, error };

    const orders = data || [];
    const orderIds = orders.map((order) => order.id).filter(Boolean);
    const assignedPackerCountByOrder: Record<string, number> = {};

    if (orderIds.length > 0) {
      const { data: membershipRows, error: membershipError } = await supabase
        .from('order_team_members')
        .select('order_id')
        .in('order_id', orderIds);

      if (membershipError) {
        console.warn('Failed to load order team member counts:', membershipError);
      } else {
        (membershipRows || []).forEach((row: any) => {
          const rowOrderId = row?.order_id;
          if (!rowOrderId) return;
          assignedPackerCountByOrder[rowOrderId] = (assignedPackerCountByOrder[rowOrderId] || 0) + 1;
        });
      }
    }
    
    // Transform the data to match expected format
    const transformedData = orders.map(order => {
      const client = unwrapSingleRelation<{ name?: string }>(order.clients);
      return {
        id: order.id,
        order_name: order.order_name,
        description: order.description,
        project_type: (order as any).project_type || 'standard',
        production_status: order.production_status,
        client_name: client?.name || 'Unknown Client',
        assigned_packers_count: assignedPackerCountByOrder[order.id] || 0
      };
    });
    
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
        project_type,
        production_status,
        client_id,
        clients (
          name,
          portal_settings_id
        ),
        project_lead:profiles!project_lead_id (
          full_name
        )
      `)
      .eq('id', orderId)
      .single();
    
    // Transform the data to match expected format
    if (data) {
      const client = unwrapSingleRelation<{ name?: string, portal_settings_id?: string | null }>(data.clients);
      const projectLead = unwrapSingleRelation<{ full_name?: string }>(data.project_lead);
      return {
        data: {
          id: data.id,
          order_name: data.order_name,
          description: data.description,
          project_type: (data as any).project_type || 'standard',
          production_status: data.production_status || null,
          commercial_status: data.commercial_status || null,
          client_id: (data as any).client_id,
          client_name: client?.name || 'Unknown Client',
          project_lead_name: projectLead?.full_name || '',
          client: {
            portal_settings_id: client?.portal_settings_id || null
          }
        },
        error
      };
    }
    
    return { data, error };
  },

  getClientQrLogoUrl: async (clientId: UUID) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          portal_settings:client_portal_settings (
            qr_logo_url
          )
        `)
        .eq('id', clientId)
        .maybeSingle();

      if (error) return { data: null, error };
      
      const settings = unwrapSingleRelation<{ qr_logo_url: string | null }>(data?.portal_settings as any);
      return { data: settings?.qr_logo_url || null, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  },


  // Get packers by IDs
  getPackersByIds: async (packerIds: UUID[]) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', packerIds);
    
    return { data, error };
  },

  // Batch: team members (with lead flag) for many orders in one query
  getTeamMembersForOrders: async (orderIds: UUID[]) => {
    const { data, error } = await supabase
      .from('order_team_members')
      .select(`
        order_id,
        packer_id,
        is_team_lead,
        profiles (
          id,
          full_name,
          username
        )
      `)
      .in('order_id', orderIds);

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

    const basePackers = (data || []).map(packer => {
      const currentOrder = unwrapSingleRelation<{ order_name?: string }>(packer.orders);
      return {
        id: packer.id,
        full_name: packer.full_name,
        username: packer.username,
        packer_status: packer.packer_status || 'available',
        current_order_name: currentOrder?.order_name || null
      };
    });

    const withoutOrderName = basePackers.filter(
      (packer) => !packer.current_order_name
    );

    const activeSessionOrderNameByPacker: Record<string, string> = {};
    if (withoutOrderName.length > 0) {
      const busyIds = withoutOrderName.map((packer) => packer.id);
      const { data: sessionRows, error: sessionError } = await supabase
        .from('packer_sessions')
        .select(`
          packer_id,
          created_at,
          orders:order_id (
            order_name
          )
        `)
        .eq('session_active', true)
        .in('packer_id', busyIds)
        .order('created_at', { ascending: false });

      if (sessionError) {
        console.warn('Failed to load active session order names for packers:', sessionError);
      } else {
        (sessionRows || []).forEach((row: any) => {
          const packerId = row?.packer_id;
          if (!packerId || activeSessionOrderNameByPacker[packerId]) return;

          const order = unwrapSingleRelation<{ order_name?: string }>(row?.orders);
          if (order?.order_name) {
            activeSessionOrderNameByPacker[packerId] = order.order_name;
          }
        });
      }
    }

    const unresolvedBusyPackers = withoutOrderName.filter(
      (packer) => !activeSessionOrderNameByPacker[packer.id]
    );

    const membershipOrderNameByPacker: Record<string, string> = {};
    if (unresolvedBusyPackers.length > 0) {
      const unresolvedIds = unresolvedBusyPackers.map((packer) => packer.id);
      const { data: membershipRows, error: membershipError } = await supabase
        .from('order_team_members')
        .select(`
          packer_id,
          created_at,
          orders:order_id (
            order_name
          )
        `)
        .in('packer_id', unresolvedIds)
        .order('created_at', { ascending: false });

      if (membershipError) {
        console.warn('Failed to load fallback membership order names for packers:', membershipError);
      } else {
        (membershipRows || []).forEach((row: any) => {
          const packerId = row?.packer_id;
          if (!packerId || membershipOrderNameByPacker[packerId]) return;

          const order = unwrapSingleRelation<{ order_name?: string }>(row?.orders);
          if (order?.order_name) {
            membershipOrderNameByPacker[packerId] = order.order_name;
          }
        });
      }
    }
    
    const transformed = basePackers.map((packer) => {
      if (packer.current_order_name) {
        return packer;
      }

      const resolvedOrderName = activeSessionOrderNameByPacker[packer.id] || membershipOrderNameByPacker[packer.id] || null;
      return {
        ...packer,
        current_order_name: resolvedOrderName,
      };
    });
    
    return { data: transformed, error: null };
  },

  // Update project lead for an order
  updateProjectLead: async (orderId: UUID, projectLeadId: UUID) => {
    const { data, error } = await supabase
      .from('orders')
      .update({
        project_lead_id: projectLeadId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id, project_lead_id')
      .single();
    
    return { data, error };
  },

  clearProjectLead: async (orderId: UUID) => {
    const { data, error } = await supabase
      .from('orders')
      .update({
        project_lead_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id, project_lead_id')
      .single();

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

  getClients: async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');

    if (!error && (data || []).length > 0) {
      return { data, error: null };
    }

    const { data: orderClients, error: orderClientsError } = await supabase
      .from('orders')
      .select(`
        client_id,
        clients (
          id,
          name
        )
      `)
      .not('client_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (orderClientsError) {
      return { data: data || null, error: error || orderClientsError };
    }

    const unique = new Map<string, { id: string; name: string }>();
    (orderClients || []).forEach((row: any) => {
      const client = unwrapSingleRelation<{ id?: string; name?: string }>(row.clients);
      const id = client?.id || row.client_id;
      const name = client?.name;
      if (!id || !name || unique.has(id)) return;
      unique.set(id, { id, name });
    });

    const fallback = Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    return { data: fallback, error: null };
  },

  createPackerProject: async ({ projectType, clientId, createdBy = null, orderName, description = null }: CreatePackerProjectInput) => {
    let actorId = createdBy;
    if (!actorId) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) {
        return { data: null, error: authError || new Error('Authenticated user not found') };
      }
      actorId = authData.user.id;
    }

    const today = new Date();
    const yyyy = String(today.getFullYear());
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}-${mm}${dd}`;

    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();
    if (clientErr || !clientRow) return { data: null, error: clientErr || new Error('Client not found') };

    const clientKey = String(clientRow.name || 'CLIENT')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9-]/g, '') || 'CLIENT';

    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    const { data: sameDayOrders, error: sameDayErr } = await supabase
      .from('orders')
      .select('id')
      .eq('client_id', clientId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);
    if (sameDayErr) return { data: null, error: sameDayErr };

    const dailySequence = String((sameDayOrders || []).length + 1).padStart(2, '0');
    const autoName = `${datePrefix}-V01-${clientKey}-${dailySequence}`;
    const chosenOrderName = (orderName || '').trim() || autoName;

    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_name: chosenOrderName,
        description: description || null,
        client_id: clientId,
        created_by: actorId,
        commercial_status: 'draft',
        production_status: 'pending',
        project_type: projectType,
      })
      .select('id, order_name, project_type')
      .single();
    if (orderErr || !orderRow) return { data: null, error: orderErr || new Error('Failed to create order') };

    const { data: origInfo, error: origErr } = await supabase
      .from('package_info')
      .insert({})
      .select('id')
      .single();
    if (origErr || !origInfo) return { data: null, error: origErr || new Error('Failed to create original package info') };

    const { data: finInfo, error: finErr } = await supabase
      .from('package_info')
      .insert({})
      .select('id')
      .single();
    if (finErr || !finInfo) return { data: null, error: finErr || new Error('Failed to create final package info') };

    const { data: orderPkg, error: pkgErr } = await supabase
      .from('order_packages')
      .insert({
        order_id: orderRow.id,
        package_number: 1,
        description: null,
        status: 'approved',
        original_pkg_info: origInfo.id,
        final_pkg_info: finInfo.id,
      })
      .select('id, order_id, package_number, status, description')
      .single();
    if (pkgErr || !orderPkg) return { data: null, error: pkgErr || new Error('Failed to create order package') };

    const normalizedInstanceStatus =
      orderPkg.status === 'packed'
        ? 'packed'
        : orderPkg.status === 'in_production'
        ? 'in_production'
        : orderPkg.status === 'design'
        ? 'design'
        : 'approved';

    const { data: overviewRow, error: overviewErr } = await supabase
      .from('order_pkg_overview')
      .insert({
        order_id: orderRow.id,
        pkg_number: orderPkg.package_number,
        status: normalizedInstanceStatus,
        quantity: 1,
        quantity_packed: normalizedInstanceStatus === 'packed' ? 1 : 0,
        description: orderPkg.description || null,
      })
      .select('id')
      .single();

    if (overviewErr || !overviewRow?.id) {
      return {
        data: null,
        error: overviewErr || new Error('Failed to create order package overview'),
      };
    }

    const { error: instanceErr } = await supabase
      .from('order_pkg_instance')
      .insert({
        order_pkg_overview_id: overviewRow.id,
        order_package_id: orderPkg.id,
        instance_number: 1,
        status: normalizedInstanceStatus,
        packed_at: normalizedInstanceStatus === 'packed' ? new Date().toISOString() : null,
      });

    if (instanceErr) {
      return { data: null, error: instanceErr };
    }

    return {
      data: {
        order_id: orderRow.id,
        order_name: orderRow.order_name,
        project_type: (orderRow as any).project_type,
        order_package_id: orderPkg.id,
        package_number: orderPkg.package_number,
        auto_name: autoName,
      },
      error: null,
    };
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

  getOrderPackageById: async (orderPackageId: UUID) => {
    const { data, error } = await supabase
      .from('order_packages')
      .select('id, order_id, package_number, maintenance_package_type, original_pkg_info, final_pkg_info, status')
      .eq('id', orderPackageId)
      .single();
    return { data, error };
  },

  updateOrderPackageFields: async (orderPackageId: UUID, fields: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('order_packages')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', orderPackageId)
      .select('id, maintenance_package_type')
      .single();
    return { data, error };
  },

  getSeiCategories: async () => {
    const { data, error } = await supabase
      .from('sei_categories')
      .select('id, code, name, description')
      .order('id');
    return { data, error };
  },

  getSeiProtections: async () => {
    const { data, error } = await supabase
      .from('sei_protection')
      .select('id, code, name, description')
      .order('id');
    return { data, error };
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
  uploadMediaToStorage: async (
    orderPackageId: string,
    fileUri: string,
    designation: string,
    notes?: string,
    mappingIds?: {
      orderPkgInstanceId?: string | null;
      pkdItemId?: string | null;
      packageItemId?: string | null;
      taskLogId?: string | null;
      maintenanceTaskLogId?: string | null;
    }
  ) => {
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

      // 6. Generate a signed URL (valid for 1 year)
      const { data: signedUrlData, error: urlError } = await supabase
        .storage
        .from('media')
        .createSignedUrl(storagePath, 31536000); // 1 year

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
          designation: designation,
          order_pkg_instance_id: mappingIds?.orderPkgInstanceId,
          pkd_item_id: mappingIds?.pkdItemId,
          package_item_id: mappingIds?.packageItemId,
          task_log_id: mappingIds?.taskLogId,
          maintenance_task_log_id: mappingIds?.maintenanceTaskLogId,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Media record insert error:', insertError);
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
          const signedUrl = await getCachedSignedUrl(supabase, 'media', item.image_url);

          return {
            ...item,
            signedUrl: signedUrl || null
          };
        })
      );

      return { data: mediaWithUrls, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  },

  getMaintenanceTaskLogsForPackage: async (orderPackageId: UUID) => {
    const { data, error } = await supabase
      .from('maintenance_task_log')
      .select('id, order_package_id, task_id, sequence_order, start_time, end_time, duration_minutes, task_status, category, created_at, updated_at, tasks(name, description)')
      .eq('order_package_id', orderPackageId)
      .order('sequence_order', { ascending: true });
    return { data, error };
  },

  updateMaintenanceTaskLog: async (id: UUID, fields: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('maintenance_task_log')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, task_status, start_time, end_time, duration_minutes, category, sequence_order')
      .single();
    return { data, error };
  },

  addMaintenanceTaskLogRow: async (
    orderPackageId: UUID,
    taskId: UUID,
    sequenceOrder: number,
    category: MaintenanceTaskCategory
  ) => {
    const { data, error } = await supabase
      .from('maintenance_task_log')
      .insert({
        order_package_id: orderPackageId,
        task_id: taskId,
        sequence_order: sequenceOrder,
        category,
        task_status: 'pending',
      })
      .select('id, sequence_order, category, task_status')
      .single();
    return { data, error };
  },

  getMaintenanceTaskAssignmentsByTaskLogIds: async (taskLogIds: UUID[]) => {
    if (!taskLogIds || taskLogIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('maintenance_task_assignments')
      .select('id, maintenance_task_log_id, packer_id, profiles(full_name, username)')
      .in('maintenance_task_log_id', taskLogIds);
    return { data, error };
  },

  setMaintenanceTaskAssignments: async (maintenanceTaskLogId: UUID, packerIds: UUID[]) => {
    const targetIds = Array.from(new Set((packerIds || []).filter(Boolean)));

    const { data: existingRows, error: existingError } = await supabase
      .from('maintenance_task_assignments')
      .select('id, packer_id')
      .eq('maintenance_task_log_id', maintenanceTaskLogId);
    if (existingError) return { data: null, error: existingError };

    const existingIds = new Set((existingRows || []).map((row: any) => row.packer_id));
    const toInsert = targetIds.filter((id) => !existingIds.has(id));
    const toDelete = (existingRows || [])
      .map((row: any) => row.packer_id)
      .filter((id: UUID) => !targetIds.includes(id));

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('maintenance_task_assignments')
        .insert(
          toInsert.map((packerId) => ({
            maintenance_task_log_id: maintenanceTaskLogId,
            packer_id: packerId,
          }))
        );
      if (insertError) return { data: null, error: insertError };
    }

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('maintenance_task_assignments')
        .delete()
        .eq('maintenance_task_log_id', maintenanceTaskLogId)
        .in('packer_id', toDelete);
      if (deleteError) return { data: null, error: deleteError };
    }

    return { data: { maintenanceTaskLogId, assignedPackerIds: targetIds }, error: null };
  },

  getMediaForMaintenanceTask: async (maintenanceTaskLogId: UUID) => {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('maintenance_task_log_id', maintenanceTaskLogId)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error };

    const mediaWithUrls = await Promise.all(
      (data || []).map(async (item: any) => {
        const signedUrl = await getCachedSignedUrl(supabase, 'media', item.image_url);

        return {
          ...item,
          signedUrl: signedUrl || null,
        };
      })
    );

    return { data: mediaWithUrls, error: null };
  },

  uploadMaintenanceTaskMedia: async (
    orderPackageId: UUID,
    maintenanceTaskLogId: UUID,
    category: MaintenanceTaskCategory,
    fileUri: string,
    notes?: string
  ) => {
    const designation = category === 'survey'
      ? 'maint_survey'
      : category === 'unpack'
      ? 'maint_unpack'
      : 'maint_repack';

    const uploaded = await baseDb.uploadMediaToStorage(orderPackageId, fileUri, designation, notes, { maintenanceTaskLogId });
    if (uploaded.error || !uploaded.data?.mediaId) {
      return uploaded;
    }


    return uploaded;
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

  // ===== Maintenance Portal & QR Code Methods =====

  getOrderItemsForPackages: async (
    orderPackageIds: UUID[],
    clientId?: UUID,
    orderPkgInstanceIds?: UUID[]
  ) => {
    const packageIds = Array.from(new Set((orderPackageIds || []).filter(Boolean)));
    const requestedInstanceIds = Array.from(new Set((orderPkgInstanceIds || []).filter(Boolean)));


    if (packageIds.length === 0 && requestedInstanceIds.length === 0) {
      return { data: [], error: null };
    }

    const loadLegacyPackageItems = async () => {
      const { data: legacyRows, error: legacyError } = await supabase
        .from('package_items')
        .select('id, order_package_id, quantity, designation, reference, length, width, height, net_weight')
        .in('order_package_id', packageIds);

      if (legacyError) {
        return { data: null, error: legacyError };
      }

      const mapped = (legacyRows || []).map((row: any) => ({
        id: String(row.id),
        quantity: row.quantity,
        created_at: null,
        pkg_instance_id: null,
        maintenance_db_id: null,
        order_package_id: row.order_package_id,
        is_legacy_package_item: true,
        maintenance_items: {
          id: null,
          client_id: clientId || null,
          reference: row.reference || null,
          ipac_comments: null,
          expected_qty: row.quantity ?? null,
          packed_qty: null,
          item_num: null,
          description: row.designation || row.reference || 'Legacy Item',
          length: row.length ?? null,
          width: row.width ?? null,
          height: row.height ?? null,
          net_weight: row.net_weight ?? null,
          warehouse_location: null,
          maintenance_package_categories: null,
        },
      }));

      return { data: mapped, error: null };
    };

    let instanceIds: UUID[] = requestedInstanceIds;
    let packageIdByInstanceId = new Map<string, string>();

    if (instanceIds.length === 0) {
      // pkd_item now targets instances, so first resolve instances for the requested template packages.
      const { data: instanceRowsRaw, error: instanceError } = await supabase
        .from('order_pkg_instance')
        .select('id, order_package_id')
        .in('order_package_id', orderPackageIds);

      if (instanceError) {
        return { data: null, error: instanceError };
      }

      const instanceRows = (instanceRowsRaw || []).filter((row: any) => !!row?.id);
      if (instanceRows.length === 0) {
        return await loadLegacyPackageItems();
      }

      instanceIds = instanceRows.map((row: any) => row.id as UUID);
      packageIdByInstanceId = new Map<string, string>(
        instanceRows.map((row: any) => [String(row.id), String(row.order_package_id || '')])
      );
    } else {
      const { data: instanceRowsRaw, error: instanceError } = await supabase
        .from('order_pkg_instance')
        .select('id, order_package_id')
        .in('id', instanceIds);

      if (instanceError) {
        return { data: null, error: instanceError };
      }

      packageIdByInstanceId = new Map<string, string>(
        (instanceRowsRaw || []).map((row: any) => [String(row.id), String(row.order_package_id || '')])
      );
    }

    let query = supabase
      .from('pkd_item')

      .select(`
        id,
        quantity,
        is_confirmed,
        pkg_instance_id,
        order_pkg_instance!inner(
          id,
          order_package_id,
          ipac_reference
        ),

        item_details:items_db(



          id,
          client_id,
          category_id,
          reference,
          expected_qty,
          packed_qty,
          ipac_comments,
          item_num,
          description,
          length,
          width,
          height,
          net_weight,
          warehouse_location,
          pkg_category:pkg_category(
            id,
            label,
            category_tag_map(
              tag:project_tags(id, name)
            )
          )
        ),
        media(id, image_url, created_at)
      `);

    if (requestedInstanceIds.length > 0) {
      query = query.in('pkg_instance_id', requestedInstanceIds);
    } else {
      query = query.in('order_pkg_instance.order_package_id', orderPackageIds);

    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    let normalized = (data || []).map((row: any) => ({
      ...row,
      order_package_id:
        row?.order_pkg_instance?.order_package_id ||

        packageIdByInstanceId.get(String(row?.pkg_instance_id || '')) ||
        null,
    }));

    if (clientId) {
      normalized = normalized.filter(
        (row: any) => String(row?.item_details?.client_id || '') === String(clientId)
      );
    }



    if (normalized.length === 0 && requestedInstanceIds.length === 0) {
      return await loadLegacyPackageItems();
    }

    // Generate public URLs for all media items
    const processed = normalized.map((row: any) => {
      if (!row.media || !row.media.length) return row;
      
      const mediaWithUrls = (row.media || []).map((m: any) => {
        const { data: publicData } = supabase.storage.from('media').getPublicUrl(m.image_url);
        return { ...m, image_url: publicData?.publicUrl || m.image_url };
      });
      
      return { ...row, media: mediaWithUrls };
    });

    return { data: processed, error: null };
  },

  getUnassignedCatalogItems: async (
    clientId: UUID,
    orderId?: UUID | null,
    search?: string,
    overrideCategoryId?: UUID | null
  ) => {
    // If an instance-level category override is provided, bypass the order-level map
    let categoryIds: string[] = [];
    if (overrideCategoryId) {
      categoryIds = [String(overrideCategoryId)];
    } else {
      const { data: mappedCategoryIds, error: categoryMapError } =
        await getMappedCategoryIdsForOrder(orderId);
      if (categoryMapError) {
        return { data: null, error: categoryMapError };
      }
      categoryIds = mappedCategoryIds || [];
    }

    const hasSearch = search && search.trim() !== '';

    let query = supabase
      .from('items_db')
      .select(`
        id,
        client_id,
        category_id,
        reference,
        expected_qty,
        packed_qty,
        ipac_comments,
        item_num,
        description,
        length,
        width,
        height,
        net_weight,
        warehouse_location,
        pkg_category:pkg_category(
          id,
          label,
          category_tag_map(
            tag:project_tags(id, name)
          )
        )
      `)
      .eq('client_id', clientId)
      .order('item_num', { ascending: true })
      .limit(5000);

    if (categoryIds.length > 0) {
      query = query.in('category_id', categoryIds);
    }

    if (hasSearch) {
      const q = `%${search.trim()}%`;
      query = query.or(`item_num.ilike.${q},reference.ilike.${q},description.ilike.${q}`);
    }
    
    return await query;
  },

  // Standard-box destination pool: items allocated to this order + destination for standard
  // boxes (order_item_allocation.is_standard_box = true). The packer SB picker uses this so
  // only the right-destination items are offered — replacing the old warehouse_location match.
  // expected_qty/packed_qty come from the ALLOCATION row (the per-destination amount).
  getStandardBoxAllocationItems: async (
    orderId: UUID,
    destination: string | null
  ) => {
    const code =
      String(destination || '')
        .replace(/[\r\n\t]+/g, '')
        .trim()
        .toUpperCase() || 'UNASSIGNED';

    const { data: dest, error: destErr } = await supabase
      .from('destinations')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (destErr) return { data: null, error: destErr };
    if (!dest?.id) return { data: [], error: null };

    // One destination can hold >1000 allocations; PostgREST caps an uncapped select at
    // 1000 rows. Page through with .range(), ordered by the unique items_db_id tiebreaker
    // (per order+destination one row per item) so paging is deterministic.
    const pageSize = 1000;
    let from = 0;
    const all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from('order_item_allocation')
        .select(`
          expected_qty,
          packed_qty,
          items_db:items_db(
            id, client_id, category_id, reference, ipac_comments, item_num, description,
            length, width, height, net_weight, warehouse_location,
            pkg_category:pkg_category(
              id, label,
              category_tag_map(tag:project_tags(id, name))
            )
          )
        `)
        .eq('order_id', orderId)
        .eq('destination_id', dest.id)
        .eq('is_standard_box', true)
        .order('items_db_id', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) return { data: null, error };
      const rows = data || [];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return { data: all, error: null };
  },

  // All per-destination allocation quantities for an order (ANY is_standard_box). Lets the
  // m2m catalog show this box destination's expected/packed (the order plan) instead of the
  // global items_db rollup.
  getOrderAllocationsForDestination: async (
    orderId: UUID,
    destination: string | null
  ) => {
    const code =
      String(destination || '')
        .replace(/[\r\n\t]+/g, '')
        .trim()
        .toUpperCase() || 'UNASSIGNED';
    const { data: dest, error: destErr } = await supabase
      .from('destinations')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (destErr) return { data: null, error: destErr };
    if (!dest?.id) return { data: [], error: null };
    // AUH-scale destinations exceed the 1000-row PostgREST cap; page through with
    // .range() ordered by the unique items_db_id (one allocation per item+dest).
    const pageSize = 1000;
    let from = 0;
    const all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from('order_item_allocation')
        .select('items_db_id, expected_qty, packed_qty, is_standard_box')
        .eq('order_id', orderId)
        .eq('destination_id', dest.id)
        .order('items_db_id', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) return { data: null, error };
      const rows = data || [];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return { data: all, error: null };
  },

  // Packer "request more": raise an allocation-increase ticket for an admin to review.
  // Resolves the box's destination text to destinations.id and stamps requested_by from auth.
  createAllocationIncreaseRequest: async (params: {
    orderId: UUID;
    itemsDbId: UUID;
    destination: string | null;
    requestedDelta: number;
    reason?: string | null;
    orderPackageId?: UUID | null;
  }) => {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return { data: null, error: authErr ?? new Error('Not authenticated') };
    }
    const code =
      String(params.destination || '')
        .replace(/[\r\n\t]+/g, '')
        .trim()
        .toUpperCase() || 'UNASSIGNED';
    const { data: dest, error: destErr } = await supabase
      .from('destinations')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (destErr) return { data: null, error: destErr };
    if (!dest?.id) {
      return { data: null, error: new Error(`Unknown destination "${code}"`) };
    }
    return supabase
      .from('allocation_increase_requests')
      .insert({
        order_id: params.orderId,
        items_db_id: params.itemsDbId,
        destination_id: dest.id,
        requested_delta: params.requestedDelta,
        reason: params.reason ?? null,
        requested_by: user.id,
        order_package_context: params.orderPackageId ?? null,
      })
      .select('id')
      .single();
  },

  updateItemDimensions: async (
    itemId: UUID,
    dims: { length: number | null; width: number | null; height: number | null }
  ) => {
    return supabase
      .from('items_db')
      .update({
        length: dims.length,
        width: dims.width,
        height: dims.height,
      })
      .eq('id', itemId);
  },

  getItemCatalogByNumber: async (
    clientId: UUID,
    itemNumber: string,
    orderId?: UUID | null
  ) => {

    const normalizedItemNumber = String(itemNumber || '').trim();
    if (!normalizedItemNumber) {
      return {
        data: [],
        error: { message: 'Item number is required' },
      };
    }

    const { data: mappedCategoryIds, error: categoryMapError } =
      await getMappedCategoryIdsForOrder(orderId);
    if (categoryMapError) {
      return { data: [], error: categoryMapError };
    }

    const asNumber = Number(normalizedItemNumber);
    const filterValue = Number.isFinite(asNumber) && /^\d+$/.test(normalizedItemNumber)
      ? asNumber
      : normalizedItemNumber;

    let query = supabase
      .from('items_db')
      .select(`
        id,
        client_id,
        category_id,
        reference,
        expected_qty,
        packed_qty,
        ipac_comments,
        item_num,
        description,
        length,
        width,
        height,
        net_weight,
        warehouse_location,
        pkg_category:pkg_category(

          id,
          label,
          category_tag_map(
            tag:project_tags(id, name)
          )
        )
      `)
      .eq('client_id', clientId)
      .eq('item_num', filterValue)
      .order('reference', { ascending: true });

    if ((mappedCategoryIds || []).length > 0) {
      query = query.in('category_id', mappedCategoryIds || []);
    }

    const { data, error } = await query;

    return { data: data || [], error };
  },

  getItemCatalogByBin: async (
    clientId: UUID,
    defaultBin: string,
    orderId?: UUID | null
  ) => {

    const normalizedDefaultBin = String(defaultBin || '').trim();
    if (!normalizedDefaultBin) {
      return {
        data: [],
        error: { message: 'Default bin is required' },
        matchedColumn: null,
      };
    }

    const { data: mappedCategoryIds, error: categoryMapError } =
      await getMappedCategoryIdsForOrder(orderId);
    if (categoryMapError) {
      return {
        data: [],
        error: categoryMapError,
        matchedColumn: null,
      };
    }

    const asNumber = Number(normalizedDefaultBin);
    const filterValues = Number.isFinite(asNumber) && /^\d+$/.test(normalizedDefaultBin)
      ? [asNumber, normalizedDefaultBin]
      : [normalizedDefaultBin];

    // Some environments use different names for default-bin columns.
    const candidateColumns = [
      'default_bin',
      'default_bin_code',
      'default_bin_location',
      'default_bin_name',
      'default_location',
      'warehouse_location',
      'storage_bin',
      'bin',
      'bin_code',
      'bin_location',
      'bin_number',
    ];

    const selectClause = `
      id,
      client_id,
      category_id,
      reference,
      expected_qty,
      packed_qty,
      ipac_comments,
      item_num,
      description,
      length,
      width,
      height,
      net_weight,
      warehouse_location,
      maintenance_package_categories:pkg_category(
        id,
        label,
        category_tag_map(
          tag:project_tags(id, name)
        )
      )
    `;

    let fallbackError: any = null;

    for (const columnName of candidateColumns) {
      let tryNextColumn = false;

      for (const filterValue of filterValues) {
        let query = supabase
          .from('items_db')
          .select(selectClause)
          .eq('client_id', clientId)
          .eq(columnName as any, filterValue as any)
          .order('reference', { ascending: true });

        if ((mappedCategoryIds || []).length > 0) {
          query = query.in('category_id', mappedCategoryIds || []);
        }

        const { data, error } = await query;

        if (error) {
          const message = String(error.message || '').toLowerCase();
          if (
            message.includes('column') ||
            message.includes('schema cache') ||
            message.includes('does not exist')
          ) {
            tryNextColumn = true;
            break;
          }

          fallbackError = error;
          continue;
        }

        if ((data || []).length > 0) {
          return { data: data || [], error: null, matchedColumn: columnName };
        }
      }

      if (fallbackError) {
        break;
      }

      if (tryNextColumn) {
        continue;
      }
    }

    if (fallbackError) {
      return { data: [], error: fallbackError, matchedColumn: null };
    }

    return { data: [], error: null, matchedColumn: null };
  },

  getMaintenanceCatalogItemByItemNumber: async (
    clientId: UUID,
    itemNumber: string,
    orderId?: UUID | null
  ) => {
    const normalizedItemNumber = String(itemNumber || '').trim();
    if (!normalizedItemNumber) {
      return {
        data: null,
        error: { message: 'Item number is required' },
      };
    }

    const { data: mappedCategoryIds, error: categoryMapError } =
      await getMappedCategoryIdsForOrder(orderId);
    if (categoryMapError) {
      return { data: null, error: categoryMapError };
    }

    const asNumber = Number(normalizedItemNumber);
    const filterValue = Number.isFinite(asNumber) && /^\d+$/.test(normalizedItemNumber)
      ? asNumber
      : normalizedItemNumber;

    let query = supabase
      .from('items_db')
      .select(`
        id,
        client_id,
        category_id,
        reference,
        expected_qty,
        packed_qty,
        ipac_comments,
        item_num,
        description,
        length,
        width,
        height,
        net_weight,
        warehouse_location,
        maintenance_package_categories:pkg_category(
          id,
          label,
          category_tag_map(
            tag:project_tags(id, name)
          )
        )
      `)
      .eq('client_id', clientId)
      .eq('item_num', filterValue)
      .order('reference', { ascending: true })
      .limit(1);

    if ((mappedCategoryIds || []).length > 0) {
      query = query.in('category_id', mappedCategoryIds || []);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    return { data: data?.[0] || null, error: null };
  },

  assignItemToPackage: async (
    maintenanceDbId: UUID,
    orderPackageId: UUID,
    quantity: number = 1,
    pkgInstanceId?: UUID | null
  ) => {
    const parsedQty = Number(quantity);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return {
        data: null,
        error: { message: 'Quantity must be greater than 0' },
      };
    }

    const { data: catalogItem, error: catalogError } = await supabase
      .from('items_db')
      .select('id, expected_qty, packed_qty, item_num, reference, description')
      .eq('id', maintenanceDbId)
      .maybeSingle();

    if (catalogError) {
      return { data: null, error: catalogError };
    }

    if (!catalogItem?.id) {
      return {
        data: null,
        error: { message: 'Selected maintenance item was not found.' },
      };
    }

    const itemLabel =
      catalogItem.item_num ||
      catalogItem.reference ||
      catalogItem.description ||
      'Selected item';
    // NOTE: the quota cap is enforced further down, AFTER the target instance is resolved,
    // so it can use the per-destination order_item_allocation (the authoritative cap) and
    // only fall back to the global items_db rollup for items with no allocation row.

    const normalizeInstanceStatus = (
      statusValue: unknown
    ): 'design' | 'approved' | 'in_production' | 'packed' => {
      const normalized = String(statusValue || '').trim().toLowerCase();
      if (normalized === 'design') return 'design';
      if (normalized === 'approved') return 'approved';
      if (normalized === 'in_production') return 'in_production';
      if (normalized === 'packed') return 'packed';
      if (normalized === 'delivered') return 'packed';
      return 'approved';
    };

    let targetInstanceId: UUID | null = pkgInstanceId || null;

    if (targetInstanceId) {
      const { data: providedInstance, error: providedInstanceError } = await supabase
        .from('order_pkg_instance')
        .select('id, order_package_id')
        .eq('id', targetInstanceId)
        .maybeSingle();

      if (providedInstanceError) {
        return { data: null, error: providedInstanceError };
      }

      if (!providedInstance?.id) {
        return {
          data: null,
          error: { message: 'Selected package instance was not found.' },
        };
      }

      if (String(providedInstance.order_package_id || '') !== String(orderPackageId)) {
        return {
          data: null,
          error: { message: 'Selected instance does not belong to the target package.' },
        };
      }
    }

    if (!targetInstanceId) {
      const { data: existingInstance, error: existingInstanceError } = await supabase
        .from('order_pkg_instance')
        .select('id, order_pkg_overview_id, instance_number')
        .eq('order_package_id', orderPackageId)
        .order('instance_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingInstanceError) {
        return { data: null, error: existingInstanceError };
      }

      if (existingInstance?.id) {
        targetInstanceId = existingInstance.id;
      }
    }

    if (!targetInstanceId) {
      const { data: packageRow, error: packageError } = await supabase
        .from('order_packages')
        .select('id, order_id, package_number, status, description')
        .eq('id', orderPackageId)
        .maybeSingle();

      if (packageError) {
        return { data: null, error: packageError };
      }

      if (!packageRow?.id || !packageRow?.order_id) {
        return {
          data: null,
          error: { message: 'Selected package template was not found.' },
        };
      }

      const packageNumber = Number(packageRow.package_number);
      if (!Number.isFinite(packageNumber) || packageNumber <= 0) {
        return {
          data: null,
          error: { message: 'Package number is invalid for this template.' },
        };
      }

      const normalizedStatus = normalizeInstanceStatus(packageRow.status);

      let overviewId: UUID | null = null;
      let existingOverviewQty = 0;

      const { data: overviewRow, error: overviewError } = await supabase
        .from('order_pkg_overview')
        .select('id, quantity')
        .eq('order_id', packageRow.order_id)
        .eq('pkg_number', packageNumber)
        .maybeSingle();

      if (overviewError) {
        return { data: null, error: overviewError };
      }

      if (overviewRow?.id) {
        overviewId = overviewRow.id;
        existingOverviewQty = Number(overviewRow.quantity || 0);
      } else {
        const { data: createdOverview, error: createdOverviewError } = await supabase
          .from('order_pkg_overview')
          .insert({
            order_id: packageRow.order_id,
            pkg_number: packageNumber,
            status: normalizedStatus,
            quantity: 1,
            quantity_packed: 0,
            description: packageRow.description || null,
          })
          .select('id, quantity')
          .single();

        if (createdOverviewError || !createdOverview?.id) {
          return {
            data: null,
            error: createdOverviewError || { message: 'Failed to create package overview.' },
          };
        }

        overviewId = createdOverview.id;
        existingOverviewQty = Number(createdOverview.quantity || 1);
      }

      const { data: lastInstanceRow, error: lastInstanceError } = await supabase
        .from('order_pkg_instance')
        .select('instance_number')
        .eq('order_pkg_overview_id', overviewId)
        .order('instance_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastInstanceError) {
        return { data: null, error: lastInstanceError };
      }

      const nextInstanceNumber = Math.max(1, Number(lastInstanceRow?.instance_number || 0) + 1);

      const { data: createdInstance, error: createdInstanceError } = await supabase
        .from('order_pkg_instance')
        .insert({
          order_pkg_overview_id: overviewId,
          order_package_id: orderPackageId,
          instance_number: nextInstanceNumber,
          status: normalizedStatus,
          packed_at: normalizedStatus === 'packed' ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (createdInstanceError || !createdInstance?.id) {
        return {
          data: null,
          error: createdInstanceError || { message: 'Failed to create package instance.' },
        };
      }

      targetInstanceId = createdInstance.id;

      if (!Number.isFinite(existingOverviewQty) || existingOverviewQty < nextInstanceNumber) {
        const { error: qtySyncError } = await supabase
          .from('order_pkg_overview')
          .update({ quantity: nextInstanceNumber })
          .eq('id', overviewId);

        if (qtySyncError) {
          console.warn('Unable to sync overview quantity after instance creation:', qtySyncError);
        }
      }
    }

    if (!targetInstanceId) {
      return {
        data: null,
        error: { message: 'Unable to resolve package instance for assignment.' },
      };
    }

    // Look up any existing pkd_item on this instance BEFORE the cap, because confirming an
    // order-create shadow (is_confirmed=false) by re-assigning the same item adds the whole
    // row to confirmed packed_qty, not just parsedQty — the cap and the rollup must use that.
    const { data: existing, error: existingError } = await supabase
      .from('pkd_item')
      .select('id, quantity, is_confirmed')
      .eq('maintenance_db_id', maintenanceDbId)
      .eq('pkg_instance_id', targetInstanceId)
      .maybeSingle();
    if (existingError) {
      return { data: null, error: existingError };
    }
    const existingWasConfirmed = !!existing?.is_confirmed;
    // Quantity this operation NEWLY adds to confirmed packed_qty:
    //  - existing confirmed row → parsedQty (its old qty already counts)
    //  - existing shadow row    → whole row + parsedQty (none of it counted yet)
    //  - no existing row        → parsedQty (new, default-confirmed row)
    const effectiveNewQty =
      existing?.id && !existingWasConfirmed
        ? Number(existing.quantity || 0) + parsedQty
        : parsedQty;

    // Per-destination quota cap. Prefer this box's order_item_allocation (kept in sync by
    // DB triggers) — the authoritative cap. Fall back to the global items_db rollup only
    // when the item has no allocation row (e.g. ad-hoc / non-allocation packing).
    {
      const { data: capInstance, error: capInstanceError } = await supabase
        .from('order_pkg_instance')
        .select('destination, order_pkg_overview_id')
        .eq('id', targetInstanceId)
        .maybeSingle();
      if (capInstanceError) {
        return { data: null, error: capInstanceError };
      }

      let capOrderId: UUID | null = null;
      if (capInstance?.order_pkg_overview_id) {
        const { data: capOverview } = await supabase
          .from('order_pkg_overview')
          .select('order_id')
          .eq('id', capInstance.order_pkg_overview_id)
          .maybeSingle();
        capOrderId = (capOverview?.order_id as UUID) || null;
      }

      let allocExpectedQty: number | null = null;
      let allocRemaining = 0;
      if (capOrderId) {
        const destCode =
          String(capInstance?.destination || '')
            .replace(/[\r\n\t]+/g, '')
            .trim()
            .toUpperCase() || 'UNASSIGNED';
        const { data: destRow } = await supabase
          .from('destinations')
          .select('id')
          .eq('code', destCode)
          .maybeSingle();
        let destId: UUID | null = (destRow?.id as UUID) || null;
        if (!destId) {
          const { data: fallbackDest } = await supabase
            .from('destinations')
            .select('id')
            .eq('code', 'UNASSIGNED')
            .maybeSingle();
          destId = (fallbackDest?.id as UUID) || null;
        }
        if (destId) {
          const { data: allocRow } = await supabase
            .from('order_item_allocation')
            .select('expected_qty, packed_qty')
            .eq('order_id', capOrderId)
            .eq('items_db_id', maintenanceDbId)
            .eq('destination_id', destId)
            .maybeSingle();
          if (allocRow) {
            const ae = Number(allocRow.expected_qty);
            const ap = Number(allocRow.packed_qty);
            allocExpectedQty = Number.isFinite(ae) ? ae : 0;
            allocRemaining = Math.max(0, allocExpectedQty - (Number.isFinite(ap) ? ap : 0));
          }
        }
      }

      if (allocExpectedQty !== null) {
        // Per-destination allocation cap (authoritative).
        if (allocExpectedQty > 0) {
          if (allocRemaining <= 0) {
            return {
              data: null,
              error: { message: `${itemLabel} is fully packed for this destination. Use "Request more" to raise the allocation.` },
            };
          }
          if (effectiveNewQty > allocRemaining) {
            return {
              data: null,
              error: { message: `Only ${allocRemaining} remaining for ${itemLabel} at this destination.` },
            };
          }
        }
      } else {
        // No allocation row: fall back to the global items_db rollup cap.
        const expectedQty = Number(catalogItem.expected_qty);
        const packedQty = Number(catalogItem.packed_qty);
        if (Number.isFinite(expectedQty) && expectedQty > 0) {
          const safePackedQty = Number.isFinite(packedQty) ? packedQty : 0;
          const remainingQty = Math.max(0, expectedQty - safePackedQty);
          if (remainingQty <= 0) {
            return {
              data: null,
              error: { message: `${itemLabel} is already fully packed and cannot be assigned again.` },
            };
          }
          if (effectiveNewQty > remainingQty) {
            return {
              data: null,
              error: { message: `Only ${remainingQty} remaining for ${itemLabel}. Reduce quantity to continue.` },
            };
          }
        }
      }
    }

    if (existing?.id) {
      const nextQty = Number(existing.quantity || 0) + parsedQty;
      const { data, error } = await supabase
        .from('pkd_item')
        // A packer assigning from the catalog/pool IS packing it → confirmed.
        .update({ quantity: nextQty, is_confirmed: true })
        .eq('id', existing.id)
        .select()
        .single();

      if (!error) {
        // Bump the items_db rollup by what was NEWLY confirmed: a shadow row was never
        // counted, so confirming it adds the whole nextQty; an already-confirmed row adds
        // only parsedQty. Keeps items_db consistent with the trigger-computed allocation.
        await supabase.rpc('increment_item_packed_qty', {
          item_id: maintenanceDbId,
          amount: existingWasConfirmed ? parsedQty : nextQty,
        });
      }

      return { data, error };
    }

    const { data, error } = await supabase
      .from('pkd_item')
      .insert({
        maintenance_db_id: maintenanceDbId,
        pkg_instance_id: targetInstanceId,
        quantity: parsedQty,
      })
      .select()
      .single();

    if (!error) {
      // Atomically bump the items_db rollup packed_qty (avoids the lost-update race of a
      // client-side read-modify-write under concurrent packers).
      await supabase.rpc('increment_item_packed_qty', {
        item_id: maintenanceDbId,
        amount: parsedQty,
      });
    }

    return { data, error };
  },

  unassignItemFromPackage: async (maintenancePackageItemId: UUID) => {
    try {
      // 1. Get item details before deletion to know how much to decrement
      const { data: itemData, error: fetchError } = await supabase
        .from('pkd_item')
        .select('maintenance_db_id, quantity, is_confirmed')
        .eq('id', maintenancePackageItemId)
        .single();

      if (fetchError || !itemData) {
        return { data: null, error: fetchError || new Error('Item not found in box.') };
      }

      // 2. Delete any associated media for this item in this box
      await supabase
        .from('media')
        .delete()
        .eq('pkd_item_id', maintenancePackageItemId);

      // 3. Delete the item from the box
      const { error: deleteError } = await supabase
        .from('pkd_item')
        .delete()
        .eq('id', maintenancePackageItemId);

      if (deleteError) return { data: null, error: deleteError };

      // 4. Decrement the items_db rollup ONLY for confirmed (packed) items. Unconfirmed
      // shadows never bumped the rollup, so removing one must not decrement it.
      if (itemData.is_confirmed) {
        await supabase.rpc('decrement_item_packed_qty', {
          item_id: itemData.maintenance_db_id,
          amount: Number(itemData.quantity || 0),
        });
      }

      return { data: { success: true }, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  },

  // Confirm a "shadow" (unconfirmed) pkd_item as actually packed: flips is_confirmed and
  // sets the packed quantity, capped at the box destination's allocation (expected −
  // confirmed-packed). Bumps the items_db rollup once. The packed_qty trigger then
  // recomputes the allocation from confirmed items.
  confirmPackedItem: async (pkdItemId: UUID, quantity?: number) => {
    const { data: pkd, error: fetchErr } = await supabase
      .from('pkd_item')
      .select('id, maintenance_db_id, pkg_instance_id, quantity, is_confirmed')
      .eq('id', pkdItemId)
      .maybeSingle();
    if (fetchErr) return { data: null, error: fetchErr };
    if (!pkd?.id) return { data: null, error: { message: 'Item not found.' } };

    const requested =
      quantity != null ? Number(quantity) : Number(pkd.quantity || 1);
    if (!Number.isFinite(requested) || requested <= 0) {
      return { data: null, error: { message: 'Quantity must be greater than 0.' } };
    }

    // Resolve the per-destination allocation cap for this box.
    const { expected: allocExpected, packed: allocPacked } =
      await resolvePkdAllocation(pkd.pkg_instance_id, pkd.maintenance_db_id);

    // packed_qty counts only confirmed items. A shadow isn't counted yet; an already-
    // confirmed row's own qty IS in allocPacked, so exclude it — this keeps the cap equal
    // to getPkdAllocationContext.remaining for every row state (no UI/server desync).
    const selfPacked = pkd.is_confirmed ? Number(pkd.quantity || 0) : 0;
    if (allocExpected !== null && allocExpected > 0) {
      const remaining = Math.max(0, allocExpected - Math.max(0, allocPacked - selfPacked));
      if (remaining <= 0) {
        return {
          data: null,
          error: {
            message:
              'Already fully packed for this destination. Use "Request more" to raise the allocation.',
          },
        };
      }
      if (requested > remaining) {
        return {
          data: null,
          error: {
            message: `Only ${remaining} remaining for this destination. Reduce the quantity or use "Request more".`,
          },
        };
      }
    }

    const wasConfirmed = !!pkd.is_confirmed;
    const { data, error } = await supabase
      .from('pkd_item')
      .update({ is_confirmed: true, quantity: requested })
      .eq('id', pkdItemId)
      .select()
      .single();
    if (error) return { data: null, error };

    // Shadows never bumped the global rollup — do it once on first confirmation.
    if (!wasConfirmed) {
      await supabase.rpc('increment_item_packed_qty', {
        item_id: pkd.maintenance_db_id,
        amount: requested,
      });
    }
    return { data, error: null };
  },

  // Edit a box item's quantity in place — works for both confirmed (packed) items and
  // unconfirmed shadows. Caps the new qty at the destination allocation's remaining
  // headroom and keeps the global items_db rollup in step (confirmed rows only).
  updatePkdItemQuantity: async (pkdItemId: UUID, newQty: number) => {
    const requested = Math.round(Number(newQty));
    if (!Number.isFinite(requested) || requested <= 0) {
      return { data: null, error: { message: 'Quantity must be a whole number greater than 0.' } };
    }

    const { data: pkd, error: fetchErr } = await supabase
      .from('pkd_item')
      .select('id, maintenance_db_id, pkg_instance_id, quantity, is_confirmed')
      .eq('id', pkdItemId)
      .maybeSingle();
    if (fetchErr) return { data: null, error: fetchErr };
    if (!pkd?.id) return { data: null, error: { message: 'Item not found.' } };

    const oldQty = Number(pkd.quantity || 0);
    if (requested === oldQty) return { data: pkd, error: null };

    const { expected: allocExpected, packed: allocPacked } =
      await resolvePkdAllocation(pkd.pkg_instance_id, pkd.maintenance_db_id);

    // packed_qty already includes THIS row's qty only when it is confirmed, so the
    // headroom is expected − (packed minus our own confirmed contribution).
    if (allocExpected !== null && allocExpected > 0) {
      const otherPacked = pkd.is_confirmed ? Math.max(0, allocPacked - oldQty) : allocPacked;
      const maxAllowed = allocExpected - otherPacked;
      if (requested > maxAllowed) {
        return {
          data: null,
          error: {
            message: `Only ${Math.max(0, maxAllowed)} allowed for this destination. Use "Request more" to raise the allocation.`,
          },
        };
      }
    }

    const { data, error } = await supabase
      .from('pkd_item')
      .update({ quantity: requested })
      .eq('id', pkdItemId)
      .select()
      .single();
    if (error) return { data: null, error };

    // Only confirmed rows feed the global items_db rollup; adjust it by the delta.
    if (pkd.is_confirmed) {
      const delta = requested - oldQty;
      if (delta > 0) {
        await supabase.rpc('increment_item_packed_qty', {
          item_id: pkd.maintenance_db_id,
          amount: delta,
        });
      } else if (delta < 0) {
        await supabase.rpc('decrement_item_packed_qty', {
          item_id: pkd.maintenance_db_id,
          amount: -delta,
        });
      }
    }
    return { data, error: null };
  },

  // Allocation context for a pkd_item: per-destination expected/packed, the remaining
  // headroom (excluding this row's own confirmed contribution), and the ids needed to
  // file a "request more". Powers the confirm modal's remaining display + morph button.
  getPkdAllocationContext: async (pkdItemId: UUID) => {
    const { data: pkd, error } = await supabase
      .from('pkd_item')
      .select('id, maintenance_db_id, pkg_instance_id, quantity, is_confirmed')
      .eq('id', pkdItemId)
      .maybeSingle();
    if (error) return { data: null, error };
    if (!pkd?.id) return { data: null, error: { message: 'Item not found.' } };

    const { expected, packed, orderId, destination } = await resolvePkdAllocation(
      pkd.pkg_instance_id,
      pkd.maintenance_db_id,
    );
    const oldQty = Number(pkd.quantity || 0);
    // For a confirmed row its own qty is already inside `packed`; exclude it so the
    // headroom reflects what OTHER boxes have packed for this destination.
    const otherPacked = pkd.is_confirmed ? Math.max(0, packed - oldQty) : packed;
    const remaining = expected !== null ? Math.max(0, expected - otherPacked) : null;

    return {
      data: {
        orderId,
        itemsDbId: pkd.maintenance_db_id as UUID,
        destination,
        expected,
        packed,
        remaining,
      },
      error: null,
    };
  },

  getOrCreateQrToken: async (entityType: 'package' | 'item' | 'pkd_item', entityId: UUID) => {
    // 1. Try to find an existing active token
    const { data: existing, error: findError } = await supabase
      .from('qr_codes')
      .select('token')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      return { data: existing.token, error: null };
    }

    // 2. If no token found, insert a new one
    // The table handles generating the unique token on DEFAULT
    const { data: inserted, error: insertError } = await supabase
      .from('qr_codes')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        is_active: true
      })
      .select('token')
      .single();

    if (insertError) {
      return { data: null, error: insertError };
    }

    return { data: inserted?.token || null, error: null };
  },

  createAdHocItem: async (input: {
    clientId: UUID;
    description: string;
    quantity: number;
    length?: number;
    width?: number;
    height?: number;
    netWeight?: number;
    reference?: string;
  }) => {
    const { data, error } = await supabase
      .from('items_db')
      .insert({
        client_id: input.clientId,
        description: input.description,
        expected_qty: input.quantity,
        packed_qty: 0,
        length: input.length || null,
        width: input.width || null,
        height: input.height || null,
        net_weight: input.netWeight || null,
        reference: input.reference || null,
      })
      .select('id')
      .single();

    return { data, error };
  },

  getItemMedia: async (pkdItemId: UUID) => {
    const { data, error } = await supabase
      .from('media')
      .select('id, image_url, created_at')
      .eq('pkd_item_id', pkdItemId)
      .order('created_at', { ascending: false });

    if (error || !data) return { data, error };

    const mediaWithUrls = await Promise.all(data.map(async (m: any) => {
      const signedUrl = await getCachedSignedUrl(supabase, 'media', m.image_url);
      return { ...m, image_url: signedUrl || m.image_url };
    }));

    return { data: mediaWithUrls, error: null };
  },

  getPackageMedia: async (orderPackageId: UUID) => {
    const { data, error } = await supabase
      .from('media')
      .select('id, image_url, created_at')
      .eq('order_package_id', orderPackageId)
      .eq('designation', 'package')
      .order('created_at', { ascending: false });

    if (error || !data) return { data, error };

    const mediaWithUrls = await Promise.all(data.map(async (m: any) => {
      const signedUrl = await getCachedSignedUrl(supabase, 'media', m.image_url);
      return { ...m, image_url: signedUrl || m.image_url };
    }));

    return { data: mediaWithUrls, error: null };
  },

  getMediaByEntityId: async (entityId: UUID, designation: string) => {
    const { data, error } = await supabase
      .from('media')
      .select('id, image_url, created_at')
      .eq('order_package_id', entityId) // Using order_package_id as a generic entity id for now, or we could add more specific columns
      .eq('designation', designation)
      .order('created_at', { ascending: false });

    if (error || !data) return { data, error };

    const bucket = 'media';
    const mediaWithUrls = data.map((m: any) => {
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(m.image_url);
      return { ...m, image_url: publicData?.publicUrl || m.image_url };
    });

    return { data: mediaWithUrls, error: null };
  },

  // ===== Box Creation Flow Helpers =====

  /**
   * Returns all box types for the box type picker.
   * Standard boxes have names starting with "Standard Box" and codes starting with "standardbox".
   */
  getAllBoxTypes: async () => {
    const { data, error } = await supabase
      .from('box_type')
      .select('id, name, code')
      .order('name', { ascending: true });
    return { data, error };
  },

  /**
   * Returns categories mapped to an order via category_order_map,
   * each with their tags ordered by tag_order for abbreviation building.
   */
  getOrderCategories: async (orderId: UUID) => {
    const { data, error } = await supabase
      .from('category_order_map')
      .select(`
        category_id,
        pkg_category:pkg_category(
          id,
          label,
          category_tag_map(
            tag_order,
            tag:project_tags(id, name, abbreviation)
          )
        )
      `)
      .eq('order_id', orderId)
      .not('category_id', 'is', null);

    if (error) return { data: null, error };

    const seen = new Set<string>();
    const categories = (data || [])
      .map((row: any) => {
        const cat = Array.isArray(row.pkg_category) ? row.pkg_category[0] : row.pkg_category;
        if (!cat?.id || seen.has(cat.id)) return null;
        seen.add(cat.id);
        return cat;
      })
      .filter(Boolean);

    return { data: categories, error: null };
  },

  /**
   * Builds the abbreviated tag string for a category in tag_order sequence.
   * e.g. category "Power + Non-AC" → "P-NAC"
   * Falls back to deriving abbreviation from tag name if no abbreviation stored.
   */
  buildCategoryTagAbbreviation: async (categoryId: UUID): Promise<string> => {
    const { data, error } = await supabase
      .from('category_tag_map')
      .select('tag_order, tag:project_tags(name, abbreviation)')
      .eq('category_id', categoryId)
      .order('tag_order', { ascending: true });

    if (error || !data?.length) return '';

    const parts = (data as any[]).map((row) => {
      const tag = Array.isArray(row.tag) ? row.tag[0] : row.tag;
      if (tag?.abbreviation) return String(tag.abbreviation).trim();
      // Derive from name as fallback
      const name = String(tag?.name || '').trim();
      // All-caps short tokens kept as-is (AC, NAC, etc.)
      if (/^[A-Z0-9-]{1,5}$/.test(name)) return name;
      // Otherwise take first letter uppercased
      return name.charAt(0).toUpperCase();
    });

    return parts.filter(Boolean).join('-');
  },

  /**
   * Generates and saves the ipac_reference for a custom box instance.
   * Format: DESTINATION-TAGABBREV-ITEMNO-SEQID (zero-padded, min 2 digits)
   * e.g. "ALD-P-NAC-53286-01"
   * For standard boxes no reference is generated (returns null).
   */
  generateAndSaveIpacReference: async (opts: {
    instanceId: UUID;
    destination: string;
    categoryId: UUID;
    itemNum: string | number | null;
    instanceSeq: number;
    isCustomBox: boolean;
  }): Promise<{ ipacReference: string | null; error: any }> => {
    if (!opts.isCustomBox) {
      return { ipacReference: null, error: null };
    }

    // Build tag abbreviation from DB
    const tagAbbrev = await baseDb.buildCategoryTagAbbreviation(opts.categoryId);

    const dest = String(opts.destination || '').trim().toUpperCase();
    const itemNo = String(opts.itemNum ?? '').trim();
    const seq = String(opts.instanceSeq).padStart(2, '0');

    const parts = [dest];
    if (tagAbbrev) parts.push(tagAbbrev);
    if (itemNo) parts.push(itemNo);
    parts.push(seq);

    const ipacReference = parts.join('-');

    const { error } = await supabase
      .from('order_pkg_instance')
      .update({ ipac_reference: ipacReference })
      .eq('id', opts.instanceId);

    return { ipacReference: error ? null : ipacReference, error };
  },

  /**
   * Returns the total packed item quantity for an instance (sum of pkd_item.quantity).
   * Used at label print time to build the accurate QTY caption for custom boxes.
   */
  getInstancePackedItemQty: async (instanceId: UUID): Promise<{ qty: number; error: any }> => {
    const { data, error } = await supabase
      .from('pkd_item')
      .select('quantity')
      .eq('pkg_instance_id', instanceId);

    if (error) return { qty: 0, error };

    const qty = (data || []).reduce((sum: number, row: any) => {
      const q = Number(row.quantity);
      return sum + (Number.isFinite(q) ? q : 0);
    }, 0);

    return { qty, error: null };
  },

  /**
   * Updates destination and/or category_id on an order_pkg_instance row.
   */
  updateInstanceFields: async (
    instanceId: UUID,
    fields: { destination?: string | null; category_id?: UUID | null }
  ) => {
    const patch: Record<string, any> = {};
    if ('destination' in fields) patch.destination = fields.destination ?? null;
    if ('category_id' in fields) patch.category_id = fields.category_id ?? null;

    const { error } = await supabase
      .from('order_pkg_instance')
      .update(patch)
      .eq('id', instanceId);

    return { error };
  },

  /**
   * Resolves the default destination and category for new boxes in an order,
   * inherited from the order's most recently created instance that has them set.
   */
  getOrderBoxDefaults: async (
    orderId: UUID
  ): Promise<{ destination: string | null; categoryId: UUID | null }> => {
    const { data, error } = await supabase
      .from('order_pkg_instance')
      .select('destination, category_id, created_at, order_pkg_overview!inner(order_id)')
      .eq('order_pkg_overview.order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data?.length) return { destination: null, categoryId: null };

    const rows = data as any[];
    const destRow = rows.find((r) => String(r.destination || '').trim());
    const catRow = rows.find((r) => r.category_id);

    return {
      destination: destRow ? String(destRow.destination).trim().toUpperCase() : null,
      categoryId: catRow?.category_id ?? null,
    };
  },

  /**
   * Comma-separated project tag names for a category, in tag_order sequence.
   * Stored on order_pkg_instance.tag so report tag filters can match by name.
   */
  getCategoryTagNames: async (categoryId: UUID): Promise<string | null> => {
    const { data, error } = await supabase
      .from('category_tag_map')
      .select('tag_order, tag:project_tags(name)')
      .eq('category_id', categoryId)
      .order('tag_order', { ascending: true });

    if (error || !data?.length) return null;

    const names = (data as any[])
      .map((row) => {
        const tag = Array.isArray(row.tag) ? row.tag[0] : row.tag;
        return String(tag?.name || '').trim();
      })
      .filter(Boolean);

    return names.length ? names.join(', ') : null;
  },

  /**
   * Duplicates an existing order_pkg_instance, creating a new sibling instance
   * under the same overview/package. The new instance always gets a fresh
   * status='design', packed_at=null, and a unique ipac_reference.
   *
   * Steps:
   *   a. Load source instance
   *   b. Compute nextInstanceNumber for the overview
   *   c. Insert new order_pkg_instance (destination/category_id/tag copied)
   *   d. Generate unique ipac_reference via generateAndSaveIpacReference
   *   e. Bump order_pkg_overview.quantity if needed (mirrors AddPackageTab)
   *   f. Re-seed pkd_item rows from source
   *      - default: shadow rows (is_confirmed=false) — packed state reset
   *      - includeFinalValues=true: copy is_confirmed/quantity verbatim,
   *        clamping confirmed rows to remaining allocation cap
   */
  duplicateBoxInstance: async (
    sourceInstanceId: UUID,
    options: { includeFinalValues?: boolean } = {}
  ): Promise<{
    data: { newInstanceId: string; instanceNumber: number; ipacReference: string | null } | null;
    error: any;
    warning?: string;
  }> => {
    const { includeFinalValues = false } = options;

    // ── a. Load source instance ────────────────────────────────────────────
    const { data: src, error: srcErr } = await supabase
      .from('order_pkg_instance')
      .select('id, order_pkg_overview_id, order_package_id, destination, category_id, tag, ipac_reference, status')
      .eq('id', sourceInstanceId)
      .maybeSingle();

    if (srcErr) return { data: null, error: srcErr };
    if (!src?.id) return { data: null, error: { message: 'Source instance not found.' } };

    const overviewId: UUID = src.order_pkg_overview_id;
    const orderPackageId: UUID = src.order_package_id;
    const destination: string = String(src.destination || '').trim().toUpperCase();
    const categoryId: UUID | null = src.category_id || null;
    const tag: string | null = src.tag ?? null;

    // ── b. Compute nextInstanceNumber ──────────────────────────────────────
    const { data: lastRow, error: lastRowErr } = await supabase
      .from('order_pkg_instance')
      .select('instance_number')
      .eq('order_pkg_overview_id', overviewId)
      .order('instance_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRowErr) return { data: null, error: lastRowErr };
    const nextInstanceNumber = Math.max(1, Number(lastRow?.instance_number || 0) + 1);

    // ── c. Insert new order_pkg_instance ───────────────────────────────────
    const { data: newInst, error: insertErr } = await supabase
      .from('order_pkg_instance')
      .insert({
        order_pkg_overview_id: overviewId,
        order_package_id: orderPackageId,
        instance_number: nextInstanceNumber,
        status: 'design',
        packed_at: null,
        destination: destination || null,
        category_id: categoryId,
        tag,
        ipac_reference: null, // set in step d
      })
      .select('id, instance_number')
      .single();

    if (insertErr || !newInst?.id) return { data: null, error: insertErr || { message: 'Failed to create duplicate instance.' } };

    const newInstanceId: string = newInst.id;

    // ── d. Generate a fresh, unique ipac_reference ─────────────────────────
    // Always give the duplicate a non-null reference so it is fully operational
    // in the report + item fetch — matching admin-panel boxes, which ALWAYS set
    // one. Standard ops boxes were created with a null ref; that is the bug we
    // are fixing, so we do NOT copy a null reference forward. (generateAndSave
    // builds DEST-TAG-[ITEM]-SEQ, unique per overview via instanceSeq.)
    let warning: string | undefined;
    let ipacReference: string | null = null;
    if (categoryId && destination) {
      // Best-effort primary item number for the DEST-TAG-ITEM-SEQ reference.
      let itemNum: string | number | null = null;
      const { data: primaryItem } = await supabase
        .from('pkd_item')
        .select('items_db:items_db(item_num)')
        .eq('pkg_instance_id', sourceInstanceId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (primaryItem) {
        const idb = Array.isArray((primaryItem as any).items_db)
          ? (primaryItem as any).items_db[0]
          : (primaryItem as any).items_db;
        itemNum = idb?.item_num ?? null;
      }

      const refResult = await baseDb.generateAndSaveIpacReference({
        instanceId: newInstanceId,
        destination,
        categoryId,
        itemNum,
        instanceSeq: nextInstanceNumber,
        isCustomBox: true,
      });
      ipacReference = refResult.ipacReference;
      if (refResult.error) {
        warning =
          'ipac_reference generation failed: ' +
          (refResult.error.message || String(refResult.error));
      }
    }

    // ── e. Bump overview.quantity if needed ────────────────────────────────
    // Mirrors AddPackageTab: if overview.quantity < nextInstanceNumber, bump it.
    const { data: ovRow } = await supabase
      .from('order_pkg_overview')
      .select('quantity')
      .eq('id', overviewId)
      .maybeSingle();

    const currentQty = Number(ovRow?.quantity || 0);
    if (!Number.isFinite(currentQty) || currentQty < nextInstanceNumber) {
      await supabase
        .from('order_pkg_overview')
        .update({ quantity: nextInstanceNumber })
        .eq('id', overviewId);
    }

    // ── f. Re-seed pkd_item rows ───────────────────────────────────────────
    const { data: srcItems, error: srcItemsErr } = await supabase
      .from('pkd_item')
      .select('id, maintenance_db_id, quantity, is_confirmed, created_at')
      .eq('pkg_instance_id', sourceInstanceId)
      .order('created_at', { ascending: true });

    if (srcItemsErr) {
      // Non-fatal: instance was created; return with warning
      warning = 'pkd_item re-seed failed: ' + (srcItemsErr.message || String(srcItemsErr));
      return { data: { newInstanceId, instanceNumber: nextInstanceNumber, ipacReference }, error: null, warning };
    }

    if (srcItems && srcItems.length > 0) {
      type PkdItemInsert = {
        maintenance_db_id: string;
        pkg_instance_id: string;
        quantity: number;
        is_confirmed: boolean;
      };
      const newRows: PkdItemInsert[] = [];

      for (const item of srcItems as any[]) {
        const srcQty = Number(item.quantity);
        const safeQty = Number.isFinite(srcQty) && srcQty > 0 ? srcQty : 1;

        if (includeFinalValues && item.is_confirmed) {
          // Clamp to remaining allocation cap to avoid exceeding order targets
          const alloc = await resolvePkdAllocation(sourceInstanceId, item.maintenance_db_id);
          let clampedQty = safeQty;
          if (alloc.expected !== null) {
            const remaining = alloc.expected - alloc.packed;
            if (remaining <= 0) {
              // No room — insert as shadow instead
              newRows.push({ maintenance_db_id: item.maintenance_db_id, pkg_instance_id: newInstanceId, quantity: safeQty, is_confirmed: false });
              continue;
            }
            clampedQty = Math.min(safeQty, remaining);
          }
          newRows.push({ maintenance_db_id: item.maintenance_db_id, pkg_instance_id: newInstanceId, quantity: clampedQty, is_confirmed: true });
        } else {
          // Default: shadow row — planned quantity preserved, packed state reset
          newRows.push({ maintenance_db_id: item.maintenance_db_id, pkg_instance_id: newInstanceId, quantity: safeQty, is_confirmed: false });
        }
      }

      if (newRows.length > 0) {
        const { error: itemsInsertErr } = await supabase
          .from('pkd_item')
          .insert(newRows);

        if (itemsInsertErr) {
          warning = 'pkd_item re-seed failed: ' + (itemsInsertErr.message || String(itemsInsertErr));
        }
      }
    }

    return {
      data: { newInstanceId, instanceNumber: nextInstanceNumber, ipacReference },
      error: null,
      ...(warning ? { warning } : {}),
    };
  },
};

/**
 * Resolve the per-destination allocation row (order_item_allocation) for a pkd_item's
 * instance. `packed` counts only confirmed pkd_item rows (the recompute trigger), so
 * callers cap a new/edited quantity against `expected − packed` for that destination.
 * Returns expected=null when there is no allocation (ad-hoc item / no cap to enforce).
 */
const resolvePkdAllocation = async (
  pkgInstanceId: UUID | null,
  itemsDbId: UUID | null,
): Promise<{
  expected: number | null;
  packed: number;
  orderId: UUID | null;
  destination: string | null;
}> => {
  if (!pkgInstanceId || !itemsDbId)
    return { expected: null, packed: 0, orderId: null, destination: null };

  const { data: inst } = await supabase
    .from('order_pkg_instance')
    .select('destination, order_pkg_overview_id')
    .eq('id', pkgInstanceId)
    .maybeSingle();

  const code =
    String(inst?.destination || '')
      .replace(/[\r\n\t]+/g, '')
      .trim()
      .toUpperCase() || 'UNASSIGNED';

  let orderId: UUID | null = null;
  if (inst?.order_pkg_overview_id) {
    const { data: ov } = await supabase
      .from('order_pkg_overview')
      .select('order_id')
      .eq('id', inst.order_pkg_overview_id)
      .maybeSingle();
    orderId = (ov?.order_id as UUID) || null;
  }
  if (!orderId) return { expected: null, packed: 0, orderId: null, destination: code };

  const { data: destRow } = await supabase
    .from('destinations')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  let destId: UUID | null = (destRow?.id as UUID) || null;
  if (!destId) {
    const { data: fb } = await supabase
      .from('destinations')
      .select('id')
      .eq('code', 'UNASSIGNED')
      .maybeSingle();
    destId = (fb?.id as UUID) || null;
  }
  if (!destId) return { expected: null, packed: 0, orderId, destination: code };

  const { data: alloc } = await supabase
    .from('order_item_allocation')
    .select('expected_qty, packed_qty')
    .eq('order_id', orderId)
    .eq('items_db_id', itemsDbId)
    .eq('destination_id', destId)
    .maybeSingle();
  if (!alloc) return { expected: null, packed: 0, orderId, destination: code };

  const ae = Number(alloc.expected_qty);
  const ap = Number(alloc.packed_qty);
  return {
    expected: Number.isFinite(ae) ? ae : 0,
    packed: Number.isFinite(ap) ? ap : 0,
    orderId,
    destination: code,
  };
};

const attendanceApi = createAttendanceApi(supabase);
const packingApi = createPackingApi(supabase);
const tasksApi = createTasksApi(supabase);
const servicesApi = createServicesApi(supabase);

export const db = {
  ...baseDb,
  ...attendanceApi,
  ...packingApi,
  ...tasksApi,
  ...servicesApi,
  query: supabase,
  auth: supabase.auth,
};

export default supabase;
