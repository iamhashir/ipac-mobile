import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { db } from '../../../../../utils/api/supabase';
import { useTextSize } from '../../../../../utils/TextSizeContext';

interface Assignment { profiles?: { full_name?: string | null } | null; packer_id?: string; task_status?: string }
interface TaskPackage { order_package_id?: string }
interface LogRow {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  restart_time?: string | null;
  pause_duration?: number | null;
  tasks?: { name?: string } | null;
  task_assignments?: Assignment[];
  task_packages?: TaskPackage[];
}

interface TaskLogsTableProps {
  rows: LogRow[];
  onPause?: (logId: string) => void;
  onFinish?: (logId: string) => void;
  onRestart?: (logId: string) => void;
  onRowPress?: (logId: string) => void;
  currentPackageId?: string; // For filtering tasks to specific package
  getTaskPackages?: (taskLogId: string) => Promise<{ data: string[] | null; error: any }>;
  orderPackageId?: string; // For media uploads
  pausedTaskIds?: Set<string>; // Track which tasks are paused
  allOrderPackages?: { id: string; package_number: number | null }[]; // All boxes for displaying box numbers
}

const formatTime = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
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

const TaskLogsTable: React.FC<TaskLogsTableProps> = ({ 
  rows, 
  onPause, 
  onFinish, 
  onRestart, 
  onRowPress, 
  currentPackageId,
  getTaskPackages,
  orderPackageId,
  pausedTaskIds = new Set(),
  allOrderPackages = []
}) => {
  const { size } = useTextSize();
  const [taskDetailsModal, setTaskDetailsModal] = useState<{ open: boolean; packerNames: string[]; boxNumbers: (number | null)[] }>({ open: false, packerNames: [], boxNumbers: []});
  const [taskPackageMap, setTaskPackageMap] = useState<Record<string, string[]>>({});

  const handleCameraPress = async (taskRow: LogRow) => {
    if (!orderPackageId) {
      Alert.alert('Error', 'Order package ID not available');
      return;
    }
    Alert.alert('Attach image', 'Choose source', [
      { text: 'Gallery', onPress: () => pickFromGallery(taskRow) },
      { text: 'Camera', onPress: () => takePhoto(taskRow) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromGallery = async (taskRow: LogRow) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Media library access is needed.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.8 
    });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri, taskRow);
    }
  };

  const takePhoto = async (taskRow: LogRow) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri, taskRow);
    }
  };

  const uploadAsset = async (uri: string, taskRow: LogRow) => {
    if (!orderPackageId) return;
    try {
      const taskName = taskRow.tasks?.name || 'Unknown Task';
      const notes = `Task: ${taskName}`;
      const { data, error } = await db.uploadMediaToStorage(orderPackageId, uri, 'task', notes);
      if (error) {
        Alert.alert('Upload failed', 'Could not upload image to storage.');
      } else {
        Alert.alert('Uploaded', 'Image uploaded successfully.');
      }
    } catch (e) {
      Alert.alert('Upload error', 'Unexpected error while uploading.');
    }
  };

  // Cache task-package relationships when currentPackageId filtering is needed
  useEffect(() => {
    if (!currentPackageId || !getTaskPackages) return;
    
    const fetchTaskPackages = async () => {
      const newMap: Record<string, string[]> = {};
      for (const row of rows) {
        if (!taskPackageMap[row.id]) {
          try {
            const { data } = await getTaskPackages(row.id);
            if (data) {
              newMap[row.id] = data;
            }
          } catch (error) {
            console.warn(`Failed to fetch packages for task ${row.id}:`, error);
          }
        }
      }
      if (Object.keys(newMap).length > 0) {
        setTaskPackageMap(prev => ({ ...prev, ...newMap }));
      }
    };
    
    fetchTaskPackages();
  }, [currentPackageId, rows, getTaskPackages]);

  // Filter rows based on currentPackageId
  const filteredRows = useMemo(() => {
    if (!currentPackageId) return rows;
    
    return rows.filter(row => {
      const packages = taskPackageMap[row.id];
      return packages ? packages.includes(currentPackageId) : false;
    });
  }, [rows, currentPackageId, taskPackageMap]);

  const openTaskDetails = (assignments?: Assignment[], taskPackages?: TaskPackage[], isCompleted?: boolean) => {
    // For completed tasks, show all assignments. For active tasks, filter out completed assignments.
    const displayAssignments = isCompleted 
      ? (assignments || [])
      : (assignments || []).filter(a => a?.task_status !== 'completed');
    const packerNames = displayAssignments.map(a => a?.profiles?.full_name || '—');
    const packageIds = (taskPackages || []).map(tp => tp.order_package_id).filter(Boolean) as string[];
    const boxNumbers = packageIds.map(id => {
      const pkg = allOrderPackages.find(p => p.id === id);
      return pkg?.package_number ?? null;
    });
    setTaskDetailsModal({ open: true, packerNames, boxNumbers });
  };

  const isTaskCompleted = (row: LogRow) => {
    return row.end_time !== null || 
           (row.task_assignments || []).every(a => a?.task_status === 'completed');
  };

  const isTaskPaused = (row: LogRow) => {
    return pausedTaskIds.has(row.id) || 
           (row.task_assignments || []).some(a => a?.task_status === 'paused');
  };

  const headerFontSize = size === 'small' ? 13 : size === 'large' ? 16 : size === 'xl' ? 18 : size === 'xxl' ? 20 : 14;
  const cellFontSize = size === 'small' ? 12 : size === 'large' ? 15 : size === 'xl' ? 17 : size === 'xxl' ? 19 : 13;
  const buttonFontSize = size === 'small' ? 11 : size === 'large' ? 14 : size === 'xl' ? 16 : size === 'xxl' ? 18 : 12;
  const buttonPadding = size === 'xxl' ? 10 : size === 'xl' ? 8 : 6;

  return (
    <View>
      {/* Header */}
      <View className="flex-row bg-gray-100 px-3 py-2 rounded-t-md border border-gray-200 mt-2">
        <Text style={{ flex: 2.5, fontSize: headerFontSize }} className="font-semibold text-gray-700">Tasks log</Text>
        <Text style={{ flex: 1, fontSize: headerFontSize }} className="font-semibold text-gray-700">Start time</Text>
        <Text style={{ flex: 1, fontSize: headerFontSize }} className="font-semibold text-gray-700">End time</Text>
        <Text style={{ flex: 1, fontSize: headerFontSize }} className="font-semibold text-gray-700">Duration</Text>
        <Text style={{ flex: 2.5 , fontSize: headerFontSize}} className="font-semibold text-gray-700">Actions</Text>
        {orderPackageId && <Text style={{ flex: 0.5, fontSize: headerFontSize }} className="font-semibold text-gray-700"></Text>}
      </View>

      {/* Rows */}
      {filteredRows.map((r) => {
        const completed = isTaskCompleted(r);
        const rowStyle = completed 
          ? "flex-row items-center px-3 py-2 border-x border-b border-gray-200 bg-gray-100"
          : "flex-row items-center px-3 py-2 border-x border-b border-gray-200 bg-white";
        const textStyle = completed ? "text-gray-500" : "text-gray-800";
        
        if (completed) {
          // Completed: row not clickable, restart remains prominent
          return (
            <View key={r.id} className={rowStyle}>
              <Text style={{ flex: 2.5, fontSize: cellFontSize }} className={`${textStyle}`} numberOfLines={1}>{r.tasks?.name || '—'}</Text>
              <Text style={{ flex: 1, fontSize: cellFontSize }} className={`${textStyle}`}>{formatTime(r.start_time)}</Text>
              <Text style={{ flex: 1, fontSize: cellFontSize }} className={`${textStyle}`}>{formatTime(r.end_time)}</Text>
              <Text style={{ flex: 1, fontSize: cellFontSize }} className={`${textStyle}`}>{formatDuration(r.start_time, r.end_time, r.duration_minutes)}</Text>

              {/* Action buttons */}
              <View style={{ flex: 2.5 }} className="flex-row flex-wrap items-center">
                <TouchableOpacity
                  style={{ paddingHorizontal: buttonPadding, paddingVertical: buttonPadding / 2, marginRight: 4, marginBottom: 2 }}
                  className="rounded bg-blue-100"
                  onPress={() => openTaskDetails(r.task_assignments, r.task_packages, true)}
                >
                  <Text style={{ fontSize: buttonFontSize }} className="text-blue-800">
                    {(r.task_assignments || []).length} Packer{(r.task_assignments || []).length !== 1 ? 's' : ''} • {(r.task_packages || []).length} Box{(r.task_packages || []).length !== 1 ? 'es' : ''}
                  </Text>
                </TouchableOpacity>
                {/* Finished status instead of Resume */}
                <View
                  style={{ paddingHorizontal: buttonPadding, paddingVertical: buttonPadding / 2, marginBottom: 2 }}
                  className="rounded bg-green-50"
                >
                  <Text style={{ fontSize: buttonFontSize }} className="text-green-600 font-semibold">Finished</Text>
                </View>
              </View>
              {/* Camera icon */}
              {orderPackageId && (
                <TouchableOpacity
                  style={{ flex: 0.5 }}
                  className="items-center justify-center"
                  onPress={() => handleCameraPress(r)}
                  activeOpacity={0.7}
                >
                  <Camera size={18} color="#2563eb" />
                </TouchableOpacity>
              )}
            </View>
          );
        }
        
        // Active: row clickable
        return (
          <TouchableOpacity key={r.id} className={rowStyle} onPress={() => onRowPress?.(r.id)} activeOpacity={0.7}>
            <Text style={{ flex: 2.5, fontSize: cellFontSize }} className={`${textStyle}`} numberOfLines={1}>{r.tasks?.name || '—'}</Text>
            <Text style={{ flex: 1, fontSize: cellFontSize }} className={`${textStyle}`}>{formatTime(r.start_time)}</Text>
            <Text style={{ flex: 1, fontSize: cellFontSize }} className={`${textStyle}`}>{formatTime(r.end_time)}</Text>
            <Text style={{ flex: 1, fontSize: cellFontSize }} className={`${textStyle}`}>{formatDuration(r.start_time, r.end_time, r.duration_minutes)}</Text>

            {/* Action buttons */}
            <View style={{ flex: 2.5 }} className="flex-row flex-wrap">
              <TouchableOpacity
                style={{ paddingHorizontal: buttonPadding, paddingVertical: buttonPadding / 2, marginRight: 4, marginBottom: 2 }}
                className="rounded bg-blue-100"
                onPress={() => openTaskDetails(r.task_assignments, r.task_packages, false)}
              >
                <Text style={{ fontSize: buttonFontSize }} className="text-blue-800">
                  {(r.task_assignments || []).filter(a => a?.task_status !== 'completed').length} Packer{(r.task_assignments || []).filter(a => a?.task_status !== 'completed').length !== 1 ? 's' : ''} • {(r.task_packages || []).length} Box{(r.task_assignments || []).length !== 1 ? 'es' : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingHorizontal: buttonPadding, paddingVertical: buttonPadding / 2, marginRight: 4, marginBottom: 2 }}
                className={`rounded ${isTaskPaused(r) ? 'bg-blue-50 border border-blue-600' : 'bg-amber-50 border border-amber-600'}`}
                onPress={() => onPause?.(r.id)}
              >
                <Text style={{ fontSize: buttonFontSize }} className={isTaskPaused(r) ? 'text-blue-700' : 'text-amber-700'}>{isTaskPaused(r) ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ paddingHorizontal: buttonPadding, paddingVertical: buttonPadding / 2, marginBottom: 2 }}
                className="rounded bg-green-50 border border-green-600" 
                onPress={() => onFinish?.(r.id)}
              >
                <Text style={{ fontSize: buttonFontSize }} className="text-green-700">Finish</Text>
              </TouchableOpacity>
            </View>
            {/* Camera icon */}
            {orderPackageId && (
              <TouchableOpacity
                style={{ flex: 0.5 }}
                className="items-center justify-center"
                onPress={(e) => {
                  e.stopPropagation();
                  handleCameraPress(r);
                }}
                activeOpacity={0.7}
              >
                <Camera size={18} color="#2563eb" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Task Details modal - merged packers and boxes */}
      <Modal visible={taskDetailsModal.open} transparent animationType="fade" onRequestClose={() => setTaskDetailsModal({ open: false, packerNames: [], boxNumbers: []})}>
        <View className="flex-1 bg-black/30 justify-center items-center">
          <View className="bg-white rounded-xl p-4 w-4/5">
            <Text className="text-gray-800 font-semibold mb-3 text-lg">Task Details</Text>
            
            {/* Assigned Packers */}
            <View className="mb-3">
              <Text className="text-gray-700 font-semibold mb-1">Assigned Packers:</Text>
              {taskDetailsModal.packerNames.length === 0 ? (
                <Text className="text-gray-600 ml-2">No packers assigned.</Text>
              ) : (
                taskDetailsModal.packerNames.map((n, idx) => (
                  <Text key={idx} className="text-gray-800 mb-1 ml-2">• {n}</Text>
                ))
              )}
            </View>
            
            {/* Related Boxes */}
            <View>
              <Text className="text-gray-700 font-semibold mb-1">Related Boxes:</Text>
              {taskDetailsModal.boxNumbers.length === 0 ? (
                <Text className="text-gray-600 ml-2">No boxes assigned.</Text>
              ) : (
                taskDetailsModal.boxNumbers.map((num, idx) => (
                  <Text key={idx} className="text-gray-800 mb-1 ml-2">• Box #{num ?? '—'}</Text>
                ))
              )}
            </View>
            
            <TouchableOpacity className="mt-4 self-end" onPress={() => setTaskDetailsModal({ open: false, packerNames: [], boxNumbers: []})}>
              <Text className="text-primary-700 font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TaskLogsTable;
