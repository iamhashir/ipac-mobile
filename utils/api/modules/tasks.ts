import type { SupabaseClient } from '@supabase/supabase-js';
import type { UUID } from '../types';

interface StartTaskInput {
  taskTypeId: UUID;
  orderPackageIds?: UUID[];
  packerIds?: UUID[];
  notes?: string | null;
}

export const createTasksApi = (supabase: SupabaseClient) => ({
  getTasks: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, name, description')
      .order('name');
    return { data, error };
  },

  getTeamPackersForOrder: async (orderId: UUID) => {
    const { data, error } = await supabase
      .from('order_team_members')
      .select('packer_id, profiles(id, full_name, username, packer_status)')
      .eq('order_id', orderId);
    if (error) return { data: null, error };
    const team = (data || []).map((row: any) => row.profiles).filter(Boolean);
    return { data: team, error: null };
  },

  getTaskLogsByOrderPackageIds: async (orderPackageIds: UUID[]) => {
    if (!orderPackageIds || orderPackageIds.length === 0) return { data: [], error: null };

    const { data: taskPackages, error: tpErr } = await supabase
      .from('task_packages')
      .select('task_log_id')
      .in('order_package_id', orderPackageIds);
    if (tpErr) return { data: null, error: tpErr };

    const taskLogIds = Array.from(new Set((taskPackages || []).map((tp: any) => tp.task_log_id).filter(Boolean)));
    if (taskLogIds.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from('task_logs')
      .select(`
        id,
        start_time,
        end_time,
        duration_minutes,
        pause_duration,
        restart_time,
        task_id,
        update_counter,
        notes,
        tasks(name),
        task_assignments(packer_id, task_status, profiles(full_name)),
        task_packages(order_package_id)
      `)
      .in('id', taskLogIds)
      .order('start_time', { ascending: false });
    return { data, error };
  },

  getTaskPackages: async (taskLogId: UUID) => {
    const { data, error } = await supabase
      .from('task_packages')
      .select('order_package_id')
      .eq('task_log_id', taskLogId);
    if (error) return { data: null, error };
    const ids = (data || []).map((row: any) => row.order_package_id).filter(Boolean);
    return { data: ids, error: null };
  },

  getTaskLogsForPackage: async (orderPackageId: UUID) => {
    if (!orderPackageId) return { data: [], error: null };

    const { data: taskPackages, error: tpErr } = await supabase
      .from('task_packages')
      .select('task_log_id')
      .eq('order_package_id', orderPackageId);
    if (tpErr) return { data: null, error: tpErr };

    const taskLogIds = Array.from(new Set((taskPackages || []).map((row: any) => row.task_log_id).filter(Boolean)));
    if (taskLogIds.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from('task_logs')
      .select('id, start_time, end_time, duration_minutes, pause_duration, restart_time, task_id, update_counter, notes, tasks(name), task_assignments(packer_id, task_status, profiles(full_name)), task_packages(order_package_id)')
      .in('id', taskLogIds)
      .order('start_time', { ascending: false });
    return { data, error };
  },

  addTaskPackages: async (taskLogId: UUID, orderPackageIds: UUID[]) => {
    if (!orderPackageIds || orderPackageIds.length === 0) return { data: [], error: null };
    const { data: existing } = await supabase
      .from('task_packages')
      .select('order_package_id')
      .eq('task_log_id', taskLogId);
    const existingSet = new Set((existing || []).map((row: any) => row.order_package_id));
    const toInsert = orderPackageIds.filter((id) => id && !existingSet.has(id));
    if (toInsert.length === 0) return { data: [], error: null };
    const rows = toInsert.map((orderPackageId) => ({ task_log_id: taskLogId, order_package_id: orderPackageId }));
    const { data, error } = await supabase.from('task_packages').insert(rows).select('order_package_id');
    return { data, error };
  },

  getTaskLogById: async (id: UUID) => {
    const { data, error } = await supabase
      .from('task_logs')
      .select('id, start_time, end_time, duration_minutes, pause_duration, restart_time, task_id, update_counter, notes, tasks(name)')
      .eq('id', id)
      .single();
    return { data, error };
  },

  updateTaskLogFields: async (id: UUID, fields: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('task_logs')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, update_counter, pause_duration')
      .single();
    return { data, error };
  },

  incrementTaskLogCounter: async (id: UUID, fields: Record<string, unknown> = {}) => {
    const { data: current } = await supabase
      .from('task_logs')
      .select('update_counter')
      .eq('id', id)
      .single();
    const next = (current?.update_counter || 0) + 1;
    const { data, error } = await supabase
      .from('task_logs')
      .update({ ...fields, update_counter: next, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, update_counter')
      .single();
    return { data, error };
  },

  addPauseDuration: async (id: UUID, seconds: number) => {
    const { data: current } = await supabase
      .from('task_logs')
      .select('pause_duration, update_counter')
      .eq('id', id)
      .single();
    const nextPause = (Number(current?.pause_duration) || 0) + (seconds || 0);
    const nextCounter = (current?.update_counter || 0) + 1;
    const { data, error } = await supabase
      .from('task_logs')
      .update({ pause_duration: nextPause, update_counter: nextCounter, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, pause_duration, update_counter')
      .single();
    return { data, error };
  },

  updateTaskAssignmentsStatus: async (taskId: UUID, status: string, packerIds: UUID[] | null = null) => {
    let query = supabase.from('task_assignments').update({ task_status: status }).eq('task_id', taskId);
    if (packerIds && packerIds.length > 0) {
      query = query.in('packer_id', packerIds);
    }
    const { data, error } = await query.select('id');
    return { data, error };
  },

  finishTaskLog: async (taskLogId: UUID) => {
    const nowIso = new Date().toISOString();
    const { data: row, error: fetchErr } = await supabase
      .from('task_logs')
      .select('id, start_time, restart_time, duration_minutes')
      .eq('id', taskLogId)
      .single();
    if (fetchErr || !row) return { data: null, error: fetchErr };

    const start = row.restart_time ? new Date(row.restart_time) : new Date(row.start_time);
    const now = new Date();
    const deltaMin = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
    const currentMinutes = typeof row.duration_minutes === 'number' ? row.duration_minutes : 0;
    const { data, error } = await supabase
      .from('task_logs')
      .update({ end_time: nowIso, duration_minutes: currentMinutes + deltaMin })
      .eq('id', taskLogId)
      .select('id, end_time, duration_minutes')
      .single();
    return { data, error };
  },

  restartTaskLog: async (taskLogId: UUID) => {
    const { data: assignments, error: assignedErr } = await supabase
      .from('task_assignments')
      .select('packer_id')
      .eq('task_id', taskLogId);
    if (assignedErr) return { data: null, error: assignedErr };
    const assignedIds = (assignments || []).map((row: any) => row.packer_id).filter(Boolean);

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

    const { data: counters, error: readErr } = await supabase
      .from('task_logs')
      .select('update_counter')
      .eq('id', taskLogId)
      .single();
    if (readErr) return { data: null, error: readErr };

    const nextCounter = (counters?.update_counter || 0) + 1;
    let updateError: unknown = null;
    const firstAttempt = await supabase
      .from('task_logs')
      .update({ restart_time: new Date().toISOString(), end_time: null, update_counter: nextCounter })
      .eq('id', taskLogId);
    updateError = firstAttempt.error;

    if (updateError && (updateError as any).code === '22P02') {
      const epoch = Math.floor(Date.now() / 1000);
      const fallback = await supabase
        .from('task_logs')
        .update({ restart_time: epoch, end_time: null, update_counter: nextCounter })
        .eq('id', taskLogId);
      if (fallback.error) return { data: null, error: fallback.error };
    } else if (updateError) {
      return { data: null, error: updateError };
    }

    const { error: statusErr } = await supabase
      .from('task_assignments')
      .update({ task_status: 'in_progress' })
      .eq('task_id', taskLogId);
    if (statusErr) return { data: null, error: statusErr };

    return { data: { canRestart: true }, error: null };
  },

  getBusyPackerIds: async () => {
    const { data, error } = await supabase
      .from('task_logs')
      .select('id, end_time, task_assignments(packer_id, task_status)')
      .is('end_time', null);

    if (error) {
      return { data: [], error };
    }

    const busySet = new Set<UUID>();
    (data || []).forEach((log: any) => {
      if (!log || !Array.isArray(log.task_assignments)) return;
      log.task_assignments.forEach((assignment: any) => {
        if (assignment && ['in_progress', 'paused'].includes(assignment.task_status) && assignment.packer_id) {
          busySet.add(assignment.packer_id);
        }
      });
    });

    return { data: Array.from(busySet), error: null };
  },

  addTaskAssignments: async (taskId: UUID, packerIds: UUID[]) => {
    if (!packerIds || packerIds.length === 0) return { data: [], error: null };
    const rows = packerIds.map((packerId) => ({ task_id: taskId, packer_id: packerId }));
    const { data, error } = await supabase
      .from('task_assignments')
      .insert(rows)
      .select('id');
    return { data, error };
  },

  removeTaskAssignments: async (taskId: UUID, packerIds: UUID[]) => {
    if (!packerIds || packerIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('task_assignments')
      .delete()
      .eq('task_id', taskId)
      .in('packer_id', packerIds)
      .select('id');
    return { data, error };
  },

  startTaskForPackages: async ({ taskTypeId, orderPackageIds = [], packerIds = [], notes = null }: StartTaskInput) => {
    const nowIso = new Date().toISOString();
    const { data: taskLog, error: logErr } = await supabase
      .from('task_logs')
      .insert({ start_time: nowIso, task_id: taskTypeId, notes, pause_duration: 0, duration_minutes: 0, update_counter: 0 })
      .select()
      .single();
    if (logErr || !taskLog) return { data: null, error: logErr || new Error('Failed to create task log') };

    const logId = taskLog.id as UUID;

    if (orderPackageIds.length > 0) {
      const rows = orderPackageIds.map((orderPackageId) => ({ task_log_id: logId, order_package_id: orderPackageId }));
      const { error: pkgErr } = await supabase.from('task_packages').insert(rows);
      if (pkgErr) return { data: null, error: pkgErr };
    }

    if (packerIds.length > 0) {
      const rows = packerIds.map((packerId) => ({ task_id: logId, packer_id: packerId }));
      const { error: assignErr } = await supabase.from('task_assignments').insert(rows);
      if (assignErr) return { data: null, error: assignErr };
    }

    return { data: { task_log_id: logId }, error: null };
  },

  canResumeTask: async (taskLogId: UUID) => {
    const { data, error } = await supabase
      .rpc('can_resume_task', { task_log_id: taskLogId });
    return { data, error };
  },

  resumeTask: async (taskLogId: UUID) => {
    const { data, error } = await supabase
      .rpc('resume_task', { task_log_id: taskLogId });
    return { data, error };
  },

  completeTask: async (taskLogId: UUID) => {
    const { data, error } = await supabase
      .rpc('complete_task', { task_log_id: taskLogId });
    return { data, error };
  },

  pauseTask: async (taskLogId: UUID) => {
    const { data, error } = await supabase
      .rpc('pause_task', { task_log_id: taskLogId });
    return { data, error };
  },

  unpauseTask: async (taskLogId: UUID, pauseDurationSeconds: number | null = null) => {
    const { data, error } = await supabase
      .rpc('unpause_task', {
        task_log_id: taskLogId,
        pause_duration_seconds: pauseDurationSeconds,
      });
    return { data, error };
  },

  getTaskStatusView: async (taskLogIds: UUID[] | null = null) => {
    let query = supabase.from('task_status_view').select('*');
    if (taskLogIds && taskLogIds.length > 0) {
      query = query.in('task_log_id', taskLogIds);
    }
    const { data, error } = await query.order('start_time', { ascending: false });
    return { data, error };
  },

  getActiveTasksForPackages: async (orderPackageIds: UUID[]) => {
    if (!orderPackageIds || orderPackageIds.length === 0) return { data: [], error: null };

    const { data: taskPackages, error: tpErr } = await supabase
      .from('task_packages')
      .select('task_log_id')
      .in('order_package_id', orderPackageIds);
    if (tpErr) return { data: null, error: tpErr };

    const taskLogIds = Array.from(new Set((taskPackages || []).map((row: any) => row.task_log_id).filter(Boolean)));
    if (taskLogIds.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from('task_status_view')
      .select('*')
      .neq('overall_status', 'completed')
      .in('task_log_id', taskLogIds);

    return { data, error };
  },
});

export type TasksApi = ReturnType<typeof createTasksApi>;
