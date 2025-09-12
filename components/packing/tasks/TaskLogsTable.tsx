import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';

interface Assignment { profiles?: { full_name?: string | null } | null; packer_id?: string; task_status?: string }
interface LogRow {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  tasks?: { name?: string } | null;
  task_assignments?: Assignment[];
}

interface TaskLogsTableProps {
  rows: LogRow[];
  onPause?: (logId: string) => void;
  onFinish?: (logId: string) => void;
  onRestart?: (logId: string) => void;
  onRowPress?: (logId: string) => void;
}

const formatTime = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
};

const formatDuration = (startIso: string, endIso: string | null, durationMinutes: number | null) => {
  if (durationMinutes != null) return `${Math.round(durationMinutes)} min`;
  if (!endIso) return '—';
  try {
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    const mins = Math.max(0, Math.floor(ms / 60000));
    return `${mins} min`;
  } catch { return '—'; }
};

const TaskLogsTable: React.FC<TaskLogsTableProps> = ({ rows, onPause, onFinish, onRestart, onRowPress }) => {
  const [packersModal, setPackersModal] = useState<{ open: boolean; names: string[] }>({ open: false, names: []});

  const openPackers = (assignments?: Assignment[]) => {
    const names = (assignments || []).map(a => a?.profiles?.full_name || '—');
    setPackersModal({ open: true, names });
  };

  const isTaskCompleted = (row: LogRow) => {
    return row.end_time !== null || 
           (row.task_assignments || []).every(a => a?.task_status === 'completed');
  };

  return (
    <View>
      {/* Header */}
      <View className="flex-row bg-gray-100 px-3 py-2 rounded-t-md border border-gray-200 mt-2">
        <Text style={{ flex: 2.5 }} className="font-semibold text-gray-700">Tasks log</Text>
        <Text style={{ flex: 1 }} className="font-semibold text-gray-700">Start time</Text>
        <Text style={{ flex: 1 }} className="font-semibold text-gray-700">End time</Text>
        <Text style={{ flex: 1 }} className="font-semibold text-gray-700">Duration</Text>
        <Text style={{ flex: 1.5 }} className="font-semibold text-gray-700">Actions</Text>
      </View>

      {/* Rows */}
      {rows.map((r) => {
        const completed = isTaskCompleted(r);
        const rowStyle = completed 
          ? "flex-row items-center px-3 py-2 border-x border-b border-gray-200 bg-gray-100"
          : "flex-row items-center px-3 py-2 border-x border-b border-gray-200 bg-white";
        const textStyle = completed ? "text-gray-500" : "text-gray-800";
        
        if (completed) {
          // Completed: row not clickable, restart remains prominent
          return (
            <View key={r.id} className={rowStyle}>
              <Text style={{ flex: 2.5 }} className={`${textStyle}`} numberOfLines={1}>{r.tasks?.name || '—'}</Text>
              <Text style={{ flex: 1 }} className={`${textStyle}`}>{formatTime(r.start_time)}</Text>
              <Text style={{ flex: 1 }} className={`${textStyle}`}>{formatTime(r.end_time)}</Text>
              <Text style={{ flex: 1 }} className={`${textStyle}`}>{formatDuration(r.start_time, r.end_time, r.duration_minutes)}</Text>

              {/* Action buttons */}
              <View style={{ flex: 1.5 }} className="flex-row">
                <TouchableOpacity
                  className="px-2 py-1 rounded bg-blue-100 mr-2"
                  onPress={() => openPackers(r.task_assignments)}
                >
                  <Text className="text-blue-800 text-sm">{(r.task_assignments || []).length} Packers</Text>
                </TouchableOpacity>
                {/* Resume only */}
                <TouchableOpacity 
                  className="px-2 py-1 rounded bg-blue-600"
                  onPress={() => onRestart?.(r.id)}
                >
                  <Text className="text-white text-sm font-semibold">Resume</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }
        
        // Active: row clickable
        return (
          <TouchableOpacity key={r.id} className={rowStyle} onPress={() => onRowPress?.(r.id)} activeOpacity={0.7}>
            <Text style={{ flex: 2.5 }} className={`${textStyle}`} numberOfLines={1}>{r.tasks?.name || '—'}</Text>
            <Text style={{ flex: 1 }} className={`${textStyle}`}>{formatTime(r.start_time)}</Text>
            <Text style={{ flex: 1 }} className={`${textStyle}`}>{formatTime(r.end_time)}</Text>
            <Text style={{ flex: 1 }} className={`${textStyle}`}>{formatDuration(r.start_time, r.end_time, r.duration_minutes)}</Text>

            {/* Action buttons */}
            <View style={{ flex: 1.5 }} className="flex-row">
              <TouchableOpacity
                className="px-2 py-1 rounded bg-blue-100 mr-2"
                onPress={() => openPackers(r.task_assignments)}
              >
                <Text className="text-blue-800 text-sm">{(r.task_assignments || []).length} Packers</Text>
              </TouchableOpacity>
              <TouchableOpacity className="px-2 py-1 rounded bg-yellow-100 mr-2" onPress={() => onPause?.(r.id)}>
                <Text className="text-yellow-800 text-sm">Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity className="px-2 py-1 rounded bg-green-600" onPress={() => onFinish?.(r.id)}>
                <Text className="text-white text-sm">Finish</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Packers modal */}
      <Modal visible={packersModal.open} transparent animationType="fade" onRequestClose={() => setPackersModal({ open: false, names: []})}>
        <View className="flex-1 bg-black/30 justify-center items-center">
          <View className="bg-white rounded-xl p-4 w-4/5">
            <Text className="text-gray-800 font-semibold mb-2">Assigned Packers</Text>
            {packersModal.names.length === 0 ? (
              <Text className="text-gray-600">No packers assigned.</Text>
            ) : (
              packersModal.names.map((n, idx) => (
                <Text key={idx} className="text-gray-800 mb-1">• {n}</Text>
              ))
            )}
            <TouchableOpacity className="mt-3 self-end" onPress={() => setPackersModal({ open: false, names: []})}>
              <Text className="text-primary-700 font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TaskLogsTable;
