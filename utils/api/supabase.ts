import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { Json, Maybe, NullableDate, SupabaseUpdatePayload, UUID } from './types';
import { createAttendanceApi } from './modules/attendance';
import { createPackingApi } from './modules/packing';
import { createTasksApi } from './modules/tasks';
import { createServicesApi } from './modules/services';

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

    const busyWithoutOrderName = basePackers.filter(
      (packer) => packer.packer_status !== 'available' && !packer.current_order_name
    );

    const activeSessionOrderNameByPacker: Record<string, string> = {};
    if (busyWithoutOrderName.length > 0) {
      const busyIds = busyWithoutOrderName.map((packer) => packer.id);
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

    const unresolvedBusyPackers = busyWithoutOrderName.filter(
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

      if (packer.packer_status === 'available') {
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
      .rpc('update_project_lead_with_status', {
        order_uuid: orderId,
        lead_id: projectLeadId
      });
    
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
        const { data: signedUrlData } = await supabase
          .storage
          .from('media')
          .createSignedUrl(item.image_url, 31536000);

        return {
          ...item,
          signedUrl: signedUrlData?.signedUrl || null,
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

    const uploaded = await baseDb.uploadMediaToStorage(orderPackageId, fileUri, designation, notes);
    if (uploaded.error || !uploaded.data?.mediaId) {
      return uploaded;
    }

    const { error: linkError } = await supabase
      .from('media')
      .update({ maintenance_task_log_id: maintenanceTaskLogId })
      .eq('id', uploaded.data.mediaId);

    if (linkError) {
      return { data: null, error: linkError };
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

  getMaintenanceItemsForPackages: async (
    opIds: UUID[],
    clientId?: UUID,
    pkgInstanceIds?: UUID[]
  ) => {
    const packageIds = Array.from(new Set((opIds || []).filter(Boolean)));
    const requestedInstanceIds = Array.from(new Set((pkgInstanceIds || []).filter(Boolean)));

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
        .in('order_package_id', packageIds);

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

    const { data, error } = await supabase
      .from('pkd_item')
      .select(`
        id,
        quantity,
        created_at,
        pkg_instance_id,
        maintenance_db_id,
        pkg_instance:order_pkg_instance(
          id,
          order_package_id,
          order_pkg_overview_id,
          instance_number,
          status
        ),
        maintenance_items:items_db!inner(
          id,
          client_id,
          reference,
          ipac_comments,
          expected_qty,
          packed_qty,
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
        )
      `)
      .in('pkg_instance_id', instanceIds);

    if (error) {
      return { data: null, error };
    }

    let normalized = (data || []).map((row: any) => ({
      ...row,
      order_package_id:
        row?.pkg_instance?.order_package_id ||
        packageIdByInstanceId.get(String(row?.pkg_instance_id || '')) ||
        null,
    }));

    if (clientId) {
      normalized = normalized.filter(
        (row: any) => String(row?.maintenance_items?.client_id || '') === String(clientId)
      );
    }

    if (normalized.length === 0 && requestedInstanceIds.length === 0) {
      return await loadLegacyPackageItems();
    }

    return { data: normalized, error: null };
  },

  getUnassignedCatalogItems: async (clientId: UUID, orderId?: UUID | null, search?: string) => {
    const { data: mappedCategoryIds, error: categoryMapError } =
      await getMappedCategoryIdsForOrder(orderId);

    if (categoryMapError) {
      return { data: null, error: categoryMapError };
    }

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
      .order('item_num', { ascending: true });

    if ((mappedCategoryIds || []).length > 0) {
      query = query.in('category_id', mappedCategoryIds || []);
    }

    if (search && search.trim() !== '') {
      // NOTE: Supabase OR with foreign tables requires filtering carefully or using an RPC.
      // We will do a generic text search on the main table for reference if needed, 
      // but typically we'd just fetch and filter client-side if it's not massive, 
      // or we'll filter on the joined item_num/description.
      // For now we'll fetch all unassigned for the client, then filter client-side to keep it robust.
    }
    
    return await query;
  },

  getMaintenanceCatalogItemsByItemNumber: async (
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
      .order('reference', { ascending: true });

    if ((mappedCategoryIds || []).length > 0) {
      query = query.in('category_id', mappedCategoryIds || []);
    }

    const { data, error } = await query;

    return { data: data || [], error };
  },

  getMaintenanceCatalogItemsByDefaultBin: async (
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

    const expectedQty = Number(catalogItem.expected_qty);
    const packedQty = Number(catalogItem.packed_qty);
    if (Number.isFinite(expectedQty) && expectedQty > 0) {
      const safePackedQty = Number.isFinite(packedQty) ? packedQty : 0;
      const remainingQty = Math.max(0, expectedQty - safePackedQty);
      const itemLabel =
        catalogItem.item_num ||
        catalogItem.reference ||
        catalogItem.description ||
        'Selected item';

      if (remainingQty <= 0) {
        return {
          data: null,
          error: { message: `${itemLabel} is already fully packed and cannot be assigned again.` },
        };
      }

      if (parsedQty > remainingQty) {
        return {
          data: null,
          error: { message: `Only ${remainingQty} remaining for ${itemLabel}. Reduce quantity to continue.` },
        };
      }
    }

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

    const { data: existing, error: existingError } = await supabase
      .from('pkd_item')
      .select('id, quantity')
      .eq('maintenance_db_id', maintenanceDbId)
      .eq('pkg_instance_id', targetInstanceId)
      .maybeSingle();

    if (existingError) {
      return { data: null, error: existingError };
    }

    if (existing?.id) {
      const nextQty = Number(existing.quantity || 0) + parsedQty;
      const { data, error } = await supabase
        .from('pkd_item')
        .update({ quantity: nextQty })
        .eq('id', existing.id)
        .select()
        .single();

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

    return { data, error };
  },

  unassignItemFromPackage: async (maintenancePackageItemId: UUID) => {
    const { error } = await supabase
      .from('pkd_item')
      .delete()
      .eq('id', maintenancePackageItemId);

    return { data: null, error };
  },

  getOrCreateQrToken: async (entityType: 'package' | 'item', entityId: UUID) => {
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
