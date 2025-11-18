import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json, SupabaseUpdatePayload, UUID } from '../types';

interface AttendanceLogRow extends Record<string, unknown> {
  id: UUID;
  order_id: UUID;
  packer_id: UUID;
  shift_period: string;
  created_at: string;
  log_date: string;
}

interface TeamOrderData {
  order_name: string;
  client_name?: string | null;
  project_lead_name?: string | null;
  clients?: { name?: string | null } | null;
  project_lead?: { full_name?: string | null } | null;
}

export const createAttendanceApi = (supabase: SupabaseClient) => ({
  createPackerSession: async (sessionData: Json) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .insert(sessionData)
      .select()
      .single();

    return { data, error };
  },

  getActivePackerSession: async (packerId: UUID) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .select('*')
      .eq('packer_id', packerId)
      .eq('session_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    return {
      data: data && data.length > 0 ? data[0] : null,
      error,
    };
  },

  updatePackerSession: async (sessionId: UUID, updates: SupabaseUpdatePayload) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single();

    return { data, error };
  },

  getPackerAttendanceByOrderAndDate: async (orderId: UUID, packerId: UUID, date: string) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('order_id', orderId)
      .eq('packer_id', packerId)
      .eq('log_date', date)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  getLatestAttendanceForOrder: async (orderId: UUID) => {
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

    const latestRecords: Record<string, AttendanceLogRow> = {};

    (data || []).forEach((record) => {
      const key = `${record.packer_id}_${record.shift_period}`;
      const existing = latestRecords[key];
      const recordDate = new Date(record.created_at);
      if (!existing || recordDate > new Date(existing.created_at)) {
        latestRecords[key] = record as AttendanceLogRow;
      }
    });

    return { data: Object.values(latestRecords), error };
  },

  getAllAttendanceForOrder: async (orderId: UUID) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('log_date')
      .eq('order_id', orderId)
      .order('log_date', { ascending: false });

    return { data, error };
  },

  getPackerSessionById: async (sessionId: UUID) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    return { data, error };
  },

  getActiveSessionsForOrder: async (orderId: UUID) => {
    const { data, error } = await supabase
      .from('packer_sessions')
      .select('*')
      .eq('order_id', orderId)
      .eq('session_active', true)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  createTeamSessions: async (orderId: UUID, orderData: TeamOrderData, packerIds: UUID[]) => {
    try {
      const sessions: unknown[] = [];

      for (const packerId of packerIds) {
        const { data: existingSession } = await supabase
          .from('packer_sessions')
          .select('*')
          .eq('packer_id', packerId)
          .eq('order_id', orderId)
          .eq('session_active', true)
          .maybeSingle();

        if (!existingSession) {
          const sessionData = {
            packer_id: packerId,
            order_id: orderId,
            order_name: orderData.order_name,
            client_name: orderData.client_name ?? orderData.clients?.name ?? null,
            project_lead_name: orderData.project_lead_name ?? orderData.project_lead?.full_name ?? null,
            team_selected: true,
            attendance_completed: false,
            packaging_started: false,
            session_active: true,
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

  canUserMarkAttendance: async (orderId: UUID) => {
    const { data, error } = await supabase
      .rpc('can_user_mark_attendance', {
        order_uuid: orderId,
      });

    return { data, error };
  },

  removePackerFromOrder: async (orderId: UUID, packerId: UUID) => {
    try {
      const { error: memberError } = await supabase
        .from('order_team_members')
        .delete()
        .eq('order_id', orderId)
        .eq('packer_id', packerId);

      if (memberError) throw memberError;

      const { error: sessionError } = await supabase
        .from('packer_sessions')
        .delete()
        .eq('packer_id', packerId);

      if (sessionError) console.warn('Session deletion failed:', sessionError);

      const { error: statusError } = await supabase
        .from('profiles')
        .update({
          packer_status: 'available',
          current_order_id: null,
        })
        .eq('id', packerId);

      if (statusError) console.warn('Status update failed:', statusError);

      return { data: { success: true }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  addPackerToOrder: async (orderId: UUID, packerId: UUID, orderData: TeamOrderData) => {
    try {
      const { error: memberError } = await supabase
        .from('order_team_members')
        .insert({
          order_id: orderId,
          packer_id: packerId,
          is_team_lead: false,
        });

      if (memberError) throw memberError;

      const sessionData = {
        packer_id: packerId,
        order_id: orderId,
        order_name: orderData.order_name,
        client_name: orderData.client_name ?? orderData.clients?.name ?? null,
        project_lead_name: orderData.project_lead_name ?? orderData.project_lead?.full_name ?? null,
        team_selected: true,
        attendance_completed: false,
        packaging_started: false,
        session_active: true,
      };

      const { error: sessionError } = await supabase
        .from('packer_sessions')
        .insert(sessionData);

      if (sessionError) console.warn('Session creation failed:', sessionError);

      const { error: statusError } = await supabase
        .from('profiles')
        .update({
          packer_status: 'busy',
          current_order_id: orderId,
        })
        .eq('id', packerId);

      if (statusError) console.warn('Status update failed:', statusError);

      return { data: { success: true }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  canRecordAttendance: async (orderId: UUID, packerId: UUID, shiftPeriod: string) => {
    const { data, error } = await supabase
      .rpc('can_record_attendance', {
        order_uuid: orderId,
        packer_uuid: packerId,
        shift_period_param: shiftPeriod,
      });

    return { data, error };
  },

  needsToolboxBriefing: async (orderId: UUID, packerId: UUID) => {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const currentShift = hour >= 12 ? 'afternoon' : 'morning';

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('id, toolbox_briefing_completed')
      .eq('order_id', orderId)
      .eq('packer_id', packerId)
      .eq('log_date', today)
      .eq('shift_period', currentShift)
      .eq('toolbox_briefing_completed', true)
      .limit(1);

    if (error) return { data: true, error };

    return { data: !data || data.length === 0, error: null };
  },
});

export type AttendanceApi = ReturnType<typeof createAttendanceApi>;
