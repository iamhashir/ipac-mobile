import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { db } from '../../../utils/api/supabase';

interface TaskActivity {
  task_log_id: string;
  task_name: string;
  task_status: 'in_progress' | 'paused' | 'mixed';
  working_on_boxes: string[];
  start_time: string | null;
  end_time: string | null;
  duration: string;
  packers: {
    packer_id: string;
    packer_name: string;
    status: 'in_progress' | 'paused';
  }[];
}

interface IdlePacker {
  packer_id: string;
  packer_name: string;
}

interface ActivityMonitorProps {
  orderId: string;
  orderPackages: { id: string; package_number: number | null }[]; // Used for box number display
}

export default function ActivityMonitor({ orderId, orderPackages }: ActivityMonitorProps) {
  const [taskActivities, setTaskActivities] = useState<TaskActivity[]>([]);
  const [idlePackers, setIdlePackers] = useState<IdlePacker[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  useEffect(() => {
    loadAvailableDates();
  }, [orderId]);

  useEffect(() => {
    loadActivities();
    
    // Only auto-refresh if viewing today
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    if (!isToday) return;

    const interval = setInterval(() => {
      loadActivities();
    }, 10000);

    return () => clearInterval(interval);
  }, [orderId, selectedDate]);

  const loadAvailableDates = async () => {
    try {
      // Get ALL task logs for the entire order (not just specific packages)
      const { data: orderData } = await db.getOrderById(orderId);
      if (!orderData) {
        setAvailableDates([new Date().toISOString().split('T')[0]]);
        return;
      }

      // Get all packages for this order
      const { data: allPackages } = await db.getOrderPackages(orderId);
      const allPackageIds = (allPackages || []).map((p: any) => p.id);
      
      if (allPackageIds.length === 0) {
        setAvailableDates([new Date().toISOString().split('T')[0]]);
        return;
      }

      // Get all task logs for ALL packages in the order
      const { data: allTaskLogs } = await db.getTaskLogsByOrderPackageIds(allPackageIds);

      // Collect unique dates from task start times
      const datesSet = new Set<string>();
      
      (allTaskLogs || []).forEach((log: any) => {
        if (log.start_time) {
          const dateStr = log.start_time.split('T')[0];
          datesSet.add(dateStr);
        }
      });

      // Always include today
      const today = new Date().toISOString().split('T')[0];
      datesSet.add(today);

      // Sort dates in descending order (most recent first)
      const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
      setAvailableDates(sortedDates);
    } catch (error) {
      console.error('Error loading dates:', error);
      setAvailableDates([new Date().toISOString().split('T')[0]]);
    }
  };

  const loadActivities = async () => {
    try {
      // Get all packers for this order
      const { data: packersData } = await db.getOrderPackers(orderId);
      if (!packersData || packersData.length === 0) {
        setTaskActivities([]);
        setIdlePackers([]);
        setLoading(false);
        return;
      }

      // Get ALL task logs for the entire order (not just current packages)
      const { data: allPackages } = await db.getOrderPackages(orderId);
      const allPackageIds = (allPackages || []).map((p: any) => p.id);
      
      if (allPackageIds.length === 0) {
        setTaskActivities([]);
        setIdlePackers([]);
        setLoading(false);
        return;
      }

      const { data: taskLogs } = await db.getTaskLogsByOrderPackageIds(allPackageIds);

      // Filter tasks by selected date
      const filteredTasks = (taskLogs || []).filter((log: any) => {
        if (!log.start_time) return false;
        const taskDate = log.start_time.split('T')[0];
        return taskDate === selectedDate;
      });

      // Get busy packer IDs
      const { data: busyPackerIds } = await db.getBusyPackerIds();
      const busySet = new Set(busyPackerIds || []);

      // Group by task logs
      const taskActivitiesList: TaskActivity[] = [];
      const assignedPackerIds = new Set<string>();

      // Determine if viewing today for active/completed filtering
      const isToday = selectedDate === new Date().toISOString().split('T')[0];
      
      // Process tasks based on date
      const tasksToProcess = isToday 
        ? filteredTasks.filter((log: any) => !log.end_time) // Only active tasks for today
        : filteredTasks; // All tasks (including completed) for historical dates

      for (const taskLog of tasksToProcess) {
        const assignments = taskLog.task_assignments || [];
        const activeAssignments = assignments.filter((a: any) => 
          a.task_status === 'in_progress' || a.task_status === 'paused'
        );

        if (activeAssignments.length === 0) continue;

        // Track assigned packers
        activeAssignments.forEach((a: any) => assignedPackerIds.add(a.packer_id));

        // Get box numbers for this task (use ALL packages for lookup)
        const taskPackages = taskLog.task_packages || [];
        const { data: allPkgs } = await db.getOrderPackages(orderId);
        const boxNumbers = taskPackages
          .map((tp: any) => {
            const pkg = (allPkgs || []).find((p: any) => p.id === tp.order_package_id);
            return pkg ? `#${pkg.package_number}` : null;
          })
          .filter(Boolean);

        // Determine overall task status
        const hasInProgress = activeAssignments.some((a: any) => a.task_status === 'in_progress');
        const hasPaused = activeAssignments.some((a: any) => a.task_status === 'paused');
        let taskStatus: 'in_progress' | 'paused' | 'mixed' = 'in_progress';
        if (hasInProgress && hasPaused) {
          taskStatus = 'mixed';
        } else if (hasPaused) {
          taskStatus = 'paused';
        }

        // Get packer details
        const packersList = activeAssignments.map((a: any) => {
          const packerData = packersData.find((p: any) => 
            (p.packer_id || p.id) === a.packer_id
          );
          return {
            packer_id: a.packer_id,
            packer_name: packerData?.full_name || packerData?.username || 'Unknown',
            status: a.task_status,
          };
        });

        taskActivitiesList.push({
          task_log_id: taskLog.id,
          task_name: taskLog.tasks?.name || 'Unknown Task',
          task_status: taskStatus,
          working_on_boxes: boxNumbers,
          start_time: taskLog.start_time,
          end_time: taskLog.end_time,
          duration: calculateDuration(taskLog.start_time, taskLog.pause_duration || 0),
          packers: packersList,
        });
      }

      // Find idle packers (only for today)
      const idlePackersList: IdlePacker[] = isToday 
        ? packersData
            .filter((p: any) => {
              const packerId = p.packer_id || p.id;
              return !assignedPackerIds.has(packerId);
            })
            .map((p: any) => ({
              packer_id: p.packer_id || p.id,
              packer_name: p.full_name || p.username || 'Unknown',
            }))
        : []; // No idle packers for historical dates

      setTaskActivities(taskActivitiesList);
      setIdlePackers(idlePackersList);
      setLastRefresh(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error loading activities:', error);
      setLoading(false);
    }
  };

  const calculateDuration = (startTime: string | null, pauseDuration: number): string => {
    if (!startTime) return '—';
    
    try {
      const start = new Date(startTime);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const totalMinutes = Math.floor(diffMs / (1000 * 60)) - Math.floor(pauseDuration / 60);
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      return `${hours}h ${minutes}m`;
    } catch {
      return '—';
    }
  };

  const formatTime = (isoString: string | null): string => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return '—';
    }
  };

  const formatDateDisplay = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateString === today) return 'Today';
    if (dateString === yesterdayStr) return 'Yesterday';
    
    return date.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: '2-digit', 
      month: 'short' 
    });
  };

  const getTaskStatusColor = (status: TaskActivity['task_status']): string => {
    switch (status) {
      case 'in_progress':
        return 'bg-green-50 border-green-500 text-green-700';
      case 'paused':
        return 'bg-yellow-50 border-yellow-500 text-yellow-700';
      case 'mixed':
        return 'bg-orange-50 border-orange-500 text-orange-700';
      default:
        return 'bg-gray-50 border-gray-400 text-gray-600';
    }
  };

  const getTaskStatusText = (status: TaskActivity['task_status']): string => {
    switch (status) {
      case 'in_progress':
        return 'Active';
      case 'paused':
        return 'On Break';
      case 'mixed':
        return 'Mixed';
      default:
        return 'Unknown';
    }
  };

  const getPackerStatusBadge = (status: 'in_progress' | 'paused'): string => {
    return status === 'in_progress' 
      ? 'bg-green-100 text-green-700' 
      : 'bg-yellow-100 text-yellow-700';
  };

  if (loading) {
    return (
      <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <View className="flex-row items-center justify-center py-4">
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text className="ml-2 text-gray-600">Loading activity...</Text>
        </View>
      </View>
    );
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const workingCount = taskActivities.reduce((sum, t) => sum + t.packers.filter(p => p.status === 'in_progress').length, 0);
  const breakCount = taskActivities.reduce((sum, t) => sum + t.packers.filter(p => p.status === 'paused').length, 0);

  return (
    <View className="bg-white rounded-lg border border-gray-200 mb-4">
      {/* Header */}
      <View className="px-4 py-3 bg-purple-50 border-b border-purple-200 rounded-t-lg">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-lg font-semibold text-purple-900">Packer Activity Monitor</Text>
          
          {/* Stats - Only show for today */}
          {isToday ? (
            <View className="flex-row items-center gap-4">
              <View className="items-center">
                <Text className="text-xs text-purple-700">Active Tasks</Text>
                <Text className="text-lg font-bold text-purple-900">{taskActivities.length}</Text>
              </View>
              <View className="items-center">
                <Text className="text-xs text-purple-700">Working</Text>
                <Text className="text-lg font-bold text-green-600">{workingCount}</Text>
              </View>
              <View className="items-center">
                <Text className="text-xs text-purple-700">On Break</Text>
                <Text className="text-lg font-bold text-yellow-600">{breakCount}</Text>
              </View>
              <View className="items-center">
                <Text className="text-xs text-purple-700">Idle</Text>
                <Text className="text-lg font-bold text-gray-600">{idlePackers.length}</Text>
              </View>
            </View>
          ) : (
            <Text className="text-xs text-purple-700">Last updated: {lastRefresh.toLocaleTimeString()}</Text>
          )}
        </View>
        
        {/* Date Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {availableDates.map((date) => (
            <TouchableOpacity
              key={date}
              onPress={() => setSelectedDate(date)}
              className={`px-3 py-1.5 mr-2 rounded-lg border ${
                selectedDate === date
                  ? 'bg-purple-600 border-purple-700'
                  : 'bg-white border-purple-300'
              }`}
            >
              <Text className={`text-xs font-medium ${
                selectedDate === date ? 'text-white' : 'text-purple-700'
              }`}>
                {formatDateDisplay(date)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Active Tasks */}
      {taskActivities.length === 0 && idlePackers.length === 0 ? (
        <View className="px-4 py-6">
          <Text className="text-center text-gray-500">No packers assigned to this order</Text>
        </View>
      ) : (
        <ScrollView className="px-4 py-3" style={{ maxHeight: 400 }}>
          {/* Active Tasks Section */}
          {taskActivities.length > 0 && (
            <View className="mb-3">
              <Text className="text-xs font-semibold text-purple-900 mb-2 uppercase">Active Tasks</Text>
              {taskActivities.map((task) => (
                <View 
                  key={task.task_log_id} 
                  className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-300"
                >
                  {/* Task Header */}
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-gray-900">{task.task_name}</Text>
                      {task.working_on_boxes.length > 0 && (
                        <Text className="text-xs text-gray-600 mt-0.5">
                          Boxes: {task.working_on_boxes.join(', ')}
                        </Text>
                      )}
                    </View>
                    <View className={`px-2 py-1 rounded-full border ml-2 ${getTaskStatusColor(task.task_status)}`}>
                      <Text className={`text-xs font-medium ${getTaskStatusColor(task.task_status).split(' ').pop()}`}>
                        {getTaskStatusText(task.task_status)}
                      </Text>
                    </View>
                  </View>

                  {/* Time Details */}
                  <View className="mb-2">
                    <View className="flex-row items-center mb-1">
                      <Text className="text-xs text-gray-600 w-16">Start:</Text>
                      <Text className="text-xs text-gray-900 font-medium">{formatTime(task.start_time)}</Text>
                    </View>
                    <View className="flex-row items-center mb-1">
                      <Text className="text-xs text-gray-600 w-16">End:</Text>
                      <Text className="text-xs text-gray-900 font-medium">
                        {task.end_time ? formatTime(task.end_time) : (task.start_time ? 'In Progress' : '—')}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Text className="text-xs text-gray-600 w-16">Duration:</Text>
                      <Text className="text-xs text-gray-900 font-medium">{task.duration}</Text>
                    </View>
                  </View>

                  {/* Packers working on this task */}
                  <View className="mt-2 pt-2 border-t border-gray-200">
                    <Text className="text-xs text-gray-600 mb-1">Packers ({task.packers.length}):</Text>
                    <View className="flex-row flex-wrap">
                      {task.packers.map((packer) => (
                        <View 
                          key={packer.packer_id}
                          className={`px-2 py-1 mr-1 mb-1 rounded ${getPackerStatusBadge(packer.status)}`}
                        >
                          <Text className="text-xs font-medium">
                            {packer.packer_name}
                            {packer.status === 'paused' ? ' (Break)' : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Idle Packers Section */}
          {idlePackers.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-700 mb-2 uppercase">Idle Packers</Text>
              <View className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                <View className="flex-row flex-wrap">
                  {idlePackers.map((packer) => (
                    <View 
                      key={packer.packer_id}
                      className="px-2 py-1 mr-1 mb-1 rounded bg-gray-200 border border-gray-400"
                    >
                      <Text className="text-xs font-medium text-gray-700">{packer.packer_name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
