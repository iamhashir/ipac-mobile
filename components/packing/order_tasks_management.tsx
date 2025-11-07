import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, Alert } from 'react-native';
import TabLayout, { TabDefinition } from './TabLayout';
import SimpleSelect from './tasks/SimpleSelect';
import TaskAssignmentHeader from './tasks/TaskAssignmentHeader';
import TaskLogsTable from './tasks/TaskLogsTable';
import { db, supabase } from '../../utils/api/supabase';

interface OrderTasksManagementProps {
  orderId: string;
  orderPackages: { id: string; package_number: number | null }[];
}

interface TeamPacker { id: string; full_name?: string; username?: string; packer_status?: string; }

const OrderTasksManagement: React.FC<OrderTasksManagementProps> = ({ orderId, orderPackages }) => {
  const [teamPackers, setTeamPackers] = useState<TeamPacker[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [busyCount, setBusyCount] = useState(0);
  const [busyPackerIds, setBusyPackerIds] = useState<Set<string>>(new Set());
  const [showAvailableModal, setShowAvailableModal] = useState(false);
  const [showBusyModal, setShowBusyModal] = useState(false);
  
  // Use refs to avoid stale closures in polling callbacks
  const teamPackersRef = useRef<TeamPacker[]>([]);
  const isMountedRef = useRef(true);

  const [taskTypes, setTaskTypes] = useState<{ id: string; name: string }[]>([]);
  const [taskLogs, setTaskLogs] = useState<any[]>([]);
  const [allTaskLogs, setAllTaskLogs] = useState<any[]>([]); // All tasks across all packages for busy indicator

  const [activeKey, setActiveKey] = useState('overview');
  const [openTaskIds, setOpenTaskIds] = useState<string[]>([]);
  const [pauseStartMap, setPauseStartMap] = useState<Record<string, number>>({}); // taskId -> epoch ms
  const [pausedTaskIds, setPausedTaskIds] = useState<Set<string>>(new Set()); // Track paused tasks
  const [isOnBreak, setIsOnBreak] = useState(false); // Track if all packers are on break
  const [breakStartTime, setBreakStartTime] = useState<number | null>(null); // Break start timestamp

  // New Task form state
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<string | null>(null);
  const [selectedPackerIds, setSelectedPackerIds] = useState<string[]>([]);
  const [consolidateOpen, setConsolidateOpen] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>(orderPackages.length ? [orderPackages[0].id] : []);
  const [notes, setNotes] = useState<string>('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const isCreatingTaskRef = useRef(false); // Ref for immediate blocking

  // List of ALL boxes in this order for consolidation UI
  const [allOrderPackages, setAllOrderPackages] = useState<{ id: string; package_number: number | null }[]>([]);

  // For detail tabs: track current task context
  const [currentDetailTaskId, setCurrentDetailTaskId] = useState<string | null>(null);
  const [currentDetailAssignedPackers, setCurrentDetailAssignedPackers] = useState<string[]>([]);
  const [currentDetailPackages, setCurrentDetailPackages] = useState<string[]>([]);
  const [detailNotesMap, setDetailNotesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    isMountedRef.current = true;
    
    const init = async () => {
      const { data: team } = await db.getTeamPackersForOrder(orderId);
      const t = (team || []) as TeamPacker[];
      
      if (!isMountedRef.current) return; // Check if still mounted
      
      setTeamPackers(t);
      teamPackersRef.current = t; // Keep ref in sync

      await refreshBusyStatus(t);

      const { data: tasksList } = await db.getTasks();
      setTaskTypes((tasksList || []).map((t: any) => ({ id: t.id, name: t.name })));

      // Load ALL order packages for consolidation UI (buttons)
      const { data: allPkgs } = await db.getOrderPackages(orderId);
      setAllOrderPackages((allPkgs || []).map((p: any) => ({ id: p.id, package_number: p.package_number ?? null })));

      await refreshLogs();
    };
    init();

    // Realtime: subscribe to task_logs changes for live updates
    const channel = supabase
      .channel('task-logs-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_logs',
      }, async (_payload) => {
        if (isMountedRef.current) {
          await refreshLogs();
          await refreshBusyStatus();
        }
      })
      .subscribe();

    // Fallback polling every 5s in case websocket can't connect
    const poll = setInterval(async () => {
      if (isMountedRef.current) {
        await refreshLogs();
        await refreshBusyStatus();
      }
    }, 5000);

    return () => {
      isMountedRef.current = false; // Mark as unmounted
      clearInterval(poll);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [orderId]);

  // Refresh logs when orderPackages changes (when switching between box tabs)
  useEffect(() => {
    if (isMountedRef.current && orderPackages.length > 0) {
      refreshLogs();
      
      // Clean up openTaskIds to only keep tasks that belong to current packages
      // This prevents showing task tabs from other boxes when switching
      if (orderPackages.length === 1 && openTaskIds.length > 0) {
        // We need to check which open tasks belong to the current package
        // Filter will happen in the tabs useMemo, but we should also close any active detail tabs
        // that don't belong to current box to avoid showing stale data
        if (activeKey.startsWith('task:')) {
          setActiveKey('overview'); // Switch back to overview when changing boxes
        }
      }
    }
  }, [orderPackages]);

  // Fetch ALL tasks across all packages for busy indicator
  const refreshAllTaskLogs = async () => {
    if (allOrderPackages.length === 0) return;
    
    const allPackageIds = allOrderPackages.map(p => p.id);
    const { data: allData } = await db.getTaskLogsByOrderPackageIds(allPackageIds);
    setAllTaskLogs(allData || []);
  };

  // Refresh all task logs when allOrderPackages changes or periodically
  useEffect(() => {
    if (allOrderPackages.length > 0) {
      refreshAllTaskLogs();
    }
  }, [allOrderPackages]);

  // Also refresh all task logs when main task logs refresh
  useEffect(() => {
    refreshAllTaskLogs();
  }, [taskLogs]);

  const refreshLogs = async () => {
    let data;
    if (orderPackages.length === 1) {
      // Single package mode - use package-specific query to only get tasks for this package
      const { data: packageData, error: packageError } = await db.getTaskLogsForPackage(orderPackages[0].id);
      if (packageError) {
        console.error('Error fetching task logs for package:', packageError);
      }
      // Filter tasks to only include those that have this specific package in task_packages
      const currentPackageId = orderPackages[0].id;
      data = (packageData || []).filter((log: any) => {
        const taskPackageIds = (log.task_packages || []).map((tp: any) => tp.order_package_id);
        return taskPackageIds.includes(currentPackageId);
      });
    } else {
      // Multi-package mode (overview) - get tasks for all packages
      const ids = orderPackages.map(op => op.id);
      const { data: allData, error: allError } = await db.getTaskLogsByOrderPackageIds(ids);
      if (allError) {
        console.error('Error fetching task logs by package IDs:', allError);
      }
      data = allData;
    }
    
    // Order: active (in_progress/paused) first, completed at bottom
    const rows = (data || []).slice();
    const score = (r: any) => {
      const statuses = (r.task_assignments || []).map((a: any) => a.task_status);
      const anyInProgress = statuses.includes('in_progress');
      const anyPaused = statuses.includes('paused');
      const completed = r.end_time != null || (statuses.length > 0 && statuses.every((s: any) => s === 'completed'));
      if (completed) return 2;
      if (anyInProgress || anyPaused) return 0;
      return 1; // anything else in the middle
    };
    rows.sort((a: any, b: any) => {
      const sa = score(a), sb = score(b);
      if (sa !== sb) return sa - sb;
      return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
    });
    setTaskLogs(rows);
    
    // Update paused task IDs set based on assignments
    const newPausedSet = new Set<string>();
    rows.forEach((r: any) => {
      const hasPaused = (r.task_assignments || []).some((a: any) => a.task_status === 'paused');
      if (hasPaused && !r.end_time) {
        newPausedSet.add(r.id);
      }
    });
    setPausedTaskIds(newPausedSet);
    
    // Check if we're currently on break (all active tasks are paused)
    const activeTasks = rows.filter((r: any) => !r.end_time);
    if (activeTasks.length > 0) {
      const allPaused = activeTasks.every((r: any) => 
        (r.task_assignments || []).every((a: any) => a.task_status === 'paused' || a.task_status === 'completed')
      );
      setIsOnBreak(allPaused && activeTasks.length > 0);
    } else {
      setIsOnBreak(false);
    }
  };

  const refreshBusyStatus = async (team?: TeamPacker[]) => {
    try {
      const { data: busyIds, error } = await db.getBusyPackerIds();
      if (error) {
        console.warn('Error fetching busy packer IDs:', error);
        return; // Don't update counts on error to prevent reset to 0
      }
      
      const busySet = new Set<string>(busyIds || []);
      if (!isMountedRef.current) return; // Prevent state updates after unmount
      
      setBusyPackerIds(busySet);
      
      // Use the provided team or fall back to current ref (not stale state)
      const list = team || teamPackersRef.current;
      setAvailableCount(list.filter(x => !busySet.has(x.id)).length);
      setBusyCount(list.filter(x => busySet.has(x.id)).length);
    } catch (error) {
      console.error('Exception in refreshBusyStatus:', error);
    }
  };

  // Handle Break button - pause all active tasks for all packers
  const handleBreak = async () => {
    const now = Date.now();
    
    if (!isOnBreak) {
      // START BREAK: Pause all active tasks
      const activeTasks = taskLogs.filter((log: any) => !log.end_time);
      
      if (activeTasks.length === 0) {
        Alert.alert('No Active Tasks', 'There are no active tasks to pause.');
        return;
      }
      
      // Pause each active task
      for (const task of activeTasks) {
        const taskId = task.id;
        const alreadyPaused = pausedTaskIds.has(taskId);
        
        if (!alreadyPaused) {
          await db.updateTaskAssignmentsStatus(taskId, 'paused');
          await db.incrementTaskLogCounter(taskId);
          setPauseStartMap(prev => ({ ...prev, [taskId]: now }));
        }
      }
      
      setBreakStartTime(now);
      Alert.alert('Break Started', 'All active tasks have been paused.');
    } else {
      // END BREAK: Resume all paused tasks
      const pausedTasks = Array.from(pausedTaskIds);
      
      if (pausedTasks.length === 0) {
        setIsOnBreak(false);
        setBreakStartTime(null);
        return;
      }
      
      // Resume each paused task
      for (const taskId of pausedTasks) {
        const pauseStartTime = pauseStartMap[taskId] || breakStartTime || now;
        const deltaSec = Math.max(0, Math.floor((now - pauseStartTime) / 1000));
        
        // Add pause duration and set status back to in_progress
        await db.addPauseDuration(taskId, deltaSec);
        await db.updateTaskAssignmentsStatus(taskId, 'in_progress');
      }
      
      // Clear all pause states
      setPauseStartMap({});
      setBreakStartTime(null);
      Alert.alert('Break Ended', 'All tasks have been resumed.');
    }
    
    await refreshLogs();
    await refreshBusyStatus();
  };

  // When switching tabs, reset or load appropriate form values
  useEffect(() => {
    if (activeKey === 'new') {
      // Reset to fresh state for new task
      setSelectedPackerIds([]);
      setSelectedPackageIds(orderPackages.length ? [orderPackages[0].id] : []);
      setNotes('');
      return;
    }
    
    if (!activeKey.startsWith('task:')) return;
    
    const id = activeKey.replace('task:', '');
    
    // Refresh logs to get latest data when switching to a task tab
    (async () => {
      await refreshLogs();
      
      const log = (taskLogs as any[]).find(l => l.id === id);
      if (!log) return;
      
      setCurrentDetailTaskId(id);
      // Filter only non-completed assignments
      const assigned = (log.task_assignments || [])
        .filter((a: any) => a.task_status !== 'completed')
        .map((a: any) => a.packer_id)
        .filter(Boolean);
      setCurrentDetailAssignedPackers(assigned);
      setSelectedPackerIds(assigned);
      setDetailNotesMap(prev => ({ ...prev, [id]: prev[id] ?? (log?.notes || '') }));
      
      const { data: linked } = await db.getTaskPackages(id);
      setCurrentDetailPackages(linked || []);
      setSelectedPackageIds(linked && linked.length ? linked : (orderPackages.length ? [orderPackages[0].id] : []));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const tabs: TabDefinition[] = useMemo(() => {
    const overview: TabDefinition = {
      key: 'overview',
      title: 'Overview',
      content: (
        <View className="mx-4 mb-4 bg-white rounded-lg border border-gray-300 mt-4">
          <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200 rounded-t-lg">
            <Text className="text-gray-800 font-semibold">Task logs</Text>
            <TouchableOpacity className="bg-blue-50 border border-blue-600 px-3 py-1 rounded" onPress={() => setActiveKey('new')}>
              <Text className="text-blue-700">Create Task</Text>
            </TouchableOpacity>
          </View>

          {taskLogs.length === 0 ? (
            <View className="px-4 py-6 items-center">
              <Text className="text-gray-700">No Tasks Assigned!</Text>
              <Text className="text-gray-500 text-sm mt-1">press create task button to start task</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 400 }} className="px-4 py-3">
              <TaskLogsTable
                rows={taskLogs as any}
                orderPackageId={orderPackages.length === 1 ? orderPackages[0].id : undefined}
                pausedTaskIds={pausedTaskIds}
                allOrderPackages={allOrderPackages}
                onRowPress={(id) => {
                  if (!openTaskIds.includes(id)) setOpenTaskIds(prev => [...prev, id]);
                  setActiveKey(`task:${id}`);
                }}
                onPause={async (id) => {
                  // Toggle pause/resume based on current state
                  const now = Date.now();
                  const isPaused = pausedTaskIds.has(id);
                  
                  // Get the current task to find active (non-completed) packers
                  const task = (taskLogs as any[]).find(t => t.id === id);
                  const activePackerIds = (task?.task_assignments || [])
                    .filter((a: any) => a.task_status !== 'completed')
                    .map((a: any) => a.packer_id)
                    .filter(Boolean);
                  
                  if (!isPaused) {
                    // PAUSE: Set status to paused for active assignments only
                    await db.updateTaskAssignmentsStatus(id, 'paused', activePackerIds);
                    await db.incrementTaskLogCounter(id);
                    setPauseStartMap(prev => ({ ...prev, [id]: now }));
                  } else {
                    // RESUME: Calculate pause duration, set status back to in_progress for active assignments only
                    const pauseStartTime = pauseStartMap[id] || now;
                    const deltaSec = Math.max(0, Math.floor((now - pauseStartTime) / 1000));
                    
                    // Add pause duration and increment counter
                    await db.addPauseDuration(id, deltaSec);
                    await db.updateTaskAssignmentsStatus(id, 'in_progress', activePackerIds);
                    
                    // Clear pause start time
                    const copy = { ...pauseStartMap };
                    delete copy[id];
                    setPauseStartMap(copy);
                  }
                  
                  await refreshLogs();
                  await refreshBusyStatus();
                }}
                onFinish={async (id) => {
                  // Use server-side completion to ensure assignments, counters, and durations are correct per business rules
                  const { error } = await db.completeTask(id);
                  if (error) {
                    console.error('Error completing task:', error);
                    return;
                  }
                  setOpenTaskIds(prev => prev.filter(x => x !== id));
                  await refreshLogs();
                  await refreshBusyStatus();
                  setActiveKey('overview');
                }}
                onRestart={async (id) => {
                  const { data, error } = await db.restartTaskLog(id);
                  if (error) {
                    console.error('Error restarting task:', error);
                    return;
                  }
                  if (!data?.canRestart) {
                    Alert.alert('Packers Busy', 'Please wait for packers to be available or create a new task with available packers.');
                    return;
                  }
                  if (!openTaskIds.includes(id)) setOpenTaskIds(prev => [...prev, id]);
                  await refreshLogs();
                  await refreshBusyStatus();
                  setActiveKey(`task:${id}`);
                }}
              />
            </ScrollView>
          )}
        </View>
      ),
    };

    const newTask: TabDefinition = {
      key: 'new',
      title: 'New Task',
      content: (
        <View className="mx-4 mb-4 bg-white rounded-lg border border-gray-200 p-4">
          {/* Task type select */}
          <SimpleSelect
            label="Task"
            items={taskTypes.map(t => ({ label: t.name, value: t.id }))}
            value={selectedTaskTypeId}
            onChange={setSelectedTaskTypeId}
            placeholder="Select a task"
          />

          {/* Packers multi-select (small boxes) */}
          <View className="mt-4">
            <Text className="text-gray-600 mb-2">Assign Packer(s)</Text>
            <View className="border border-gray-300 rounded-md p-3 bg-white">
              <ScrollView style={{ maxHeight: 180 }}>
                <View className="flex-row flex-wrap">
                  {teamPackers.map((p) => {
                    const selected = selectedPackerIds.includes(p.id);
                    const isBusy = busyPackerIds.has(p.id);
                    
                    // Determine box styling
                    let boxStyle = 'px-3 py-2 m-1 rounded-lg border-2 ';
                    let textStyle = 'text-sm font-medium ';
                    
                    if (selected) {
                      boxStyle += 'bg-blue-50 border-blue-500';
                      textStyle += 'text-blue-700';
                    } else if (isBusy) {
                      boxStyle += 'bg-red-50 border-red-400';
                      textStyle += 'text-red-600';
                    } else {
                      boxStyle += 'bg-green-50 border-green-400';
                      textStyle += 'text-green-600';
                    }
                    
                    return (
                      <TouchableOpacity
                        key={p.id}
                        className={boxStyle}
                        onPress={() => {
                          if (isBusy) return; // disable busy packer selection
                          setSelectedPackerIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                        }}
                        activeOpacity={isBusy ? 1 : 0.7}
                      >
                        <Text className={textStyle} numberOfLines={1}>
                          {p.full_name || p.username}
                        </Text>
                        <Text className={`text-xs mt-1 ${selected ? 'text-blue-600' : isBusy ? 'text-red-500' : 'text-green-500'}`}>
                          {selected ? 'Selected' : (isBusy ? 'Busy' : 'Available')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Notes */}
          <View className="mt-4">
            <Text className="text-gray-600 mb-1">Notes</Text>
            <TextInput
              className="border border-gray-300 rounded-md bg-white px-2 py-2"
              placeholder="Any special instructions..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Bottom Action Buttons */}
          <View className="flex-row justify-between mt-6">
            <TouchableOpacity className="bg-blue-50 border border-blue-300 px-4 py-3 rounded-lg flex-1 mr-2" onPress={() => setConsolidateOpen(true)}>
              <Text className="text-blue-700 text-center font-medium">Consolidate Packages</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-4 py-3 rounded-lg flex-1 ml-2 ${(!selectedTaskTypeId || !selectedPackageIds.length || !selectedPackerIds.length || isCreatingTask) ? 'bg-gray-300' : 'bg-green-50 border border-green-600'}`}
              disabled={!selectedTaskTypeId || !selectedPackageIds.length || !selectedPackerIds.length || isCreatingTask}
              onPress={async () => {
                    // IMMEDIATELY block using ref (synchronous check)
                    if (isCreatingTaskRef.current) {
                      console.log('Task creation already in progress, ignoring duplicate press');
                      return;
                    }
                    
                    // Basic validation before locking
                    if (!selectedTaskTypeId) {
                      Alert.alert('Select task', 'Please select a task type.');
                      return;
                    }
                    if (!selectedPackageIds.length) {
                      Alert.alert('Select package(s)', 'Please select at least one package to start a task.');
                      return;
                    }
                    if (!selectedPackerIds.length) {
                      Alert.alert('Assign packers', 'Please select at least one packer to assign.');
                      return;
                    }

                    // LOCK immediately with ref (synchronous)
                    isCreatingTaskRef.current = true;
                    setIsCreatingTask(true);
                    
                    try {
                      // Refresh busy map to be safe
                      await refreshBusyStatus();
                      const busyChosen = selectedPackerIds.filter(id => busyPackerIds.has(id));
                      if (busyChosen.length) {
                        Alert.alert('Packer busy', 'One or more selected packers are currently in progress on another task.');
                        return;
                      }

                      const { data, error } = await db.startTaskForPackages({
                        taskTypeId: selectedTaskTypeId,
                        orderPackageIds: selectedPackageIds,
                        packerIds: selectedPackerIds,
                        notes: notes || null,
                      });
                      
                      if (!error && data?.task_log_id) {
                        // Switch to overview FIRST (immediate user feedback)
                        setActiveKey('overview');
                        
                        // Then refresh data in background
                        await refreshLogs();
                        await refreshBusyStatus();
                        
                        // persist detail tab for the new task
                        setOpenTaskIds(prev => [...prev, data.task_log_id]);
                        
                        // reset selections (keep task for convenience)
                        setSelectedPackerIds([]);
                        setNotes('');
                      } else if (error) {
                        Alert.alert('Error', 'Failed to create task. Please try again.');
                      }
                    } catch (err) {
                      console.error('Error creating task:', err);
                      Alert.alert('Error', 'An unexpected error occurred.');
                    } finally {
                      // UNLOCK
                      isCreatingTaskRef.current = false;
                      setIsCreatingTask(false);
                    }
                  }}
                >
                  <Text className={`text-center font-medium ${(!selectedTaskTypeId || !selectedPackageIds.length || !selectedPackerIds.length || isCreatingTask) ? 'text-gray-600' : 'text-green-700'}`}>
                    {isCreatingTask ? 'Creating...' : 'Start Task'}
                  </Text>
                </TouchableOpacity>
          </View>

          {/* Consolidate modal */}
          <Modal visible={consolidateOpen} transparent animationType="none" onRequestClose={() => setConsolidateOpen(false)}>
            <View className="flex-1 bg-black/30 justify-center items-center">
              <View className="bg-white rounded-xl p-4 w-4/5 max-h-[70%]">
                <Text className="text-gray-800 font-semibold mb-3">Consolidate with boxes</Text>
                <ScrollView>
                  <View className="flex-row flex-wrap">
                    {allOrderPackages.map((op) => {
                      const checked = selectedPackageIds.includes(op.id);
                      return (
                        <TouchableOpacity
                          key={op.id}
                          className={`px-3 py-2 m-1 rounded-md border ${checked ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-300'}`}
                          onPress={() => setSelectedPackageIds(prev => checked ? prev.filter(id => id !== op.id) : [...prev, op.id])}
                        >
                          <Text className={`text-sm ${checked ? 'text-blue-800' : 'text-gray-800'}`}>Box #{op.package_number ?? '—'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                <View className="flex-row justify-end mt-3">
                  <TouchableOpacity className="mr-3" onPress={() => setConsolidateOpen(false)}>
                    <Text className="text-gray-700">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="bg-blue-50 border border-blue-600 px-3 py-1 rounded" onPress={() => setConsolidateOpen(false)}>
                    <Text className="text-blue-700">Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      ),
    };

    // Create detail tabs for openTaskIds - but only for tasks that belong to current packages
    const details: TabDefinition[] = openTaskIds
      .filter((id) => {
        // Check if this task belongs to any of the current orderPackages
        const log = (taskLogs as any[]).find(l => l.id === id);
        if (!log) return false;
        
        // Get the package IDs for this task
        const taskPackageIds = (log.task_packages || []).map((tp: any) => tp.order_package_id);
        
        // If we're in single-package mode, only show tasks for that specific package
        if (orderPackages.length === 1) {
          return taskPackageIds.includes(orderPackages[0].id);
        }
        
        // In multi-package mode, show tasks for any of the current packages
        const currentPackageIds = orderPackages.map(op => op.id);
        return taskPackageIds.some(tpId => currentPackageIds.includes(tpId));
      })
      .map((id) => {
      const log = (taskLogs as any[]).find(l => l.id === id);
      const title = log?.tasks?.name ? `Task: ${log.tasks.name}` : 'Task Detail';
      // Filter only non-completed assignments for accurate count
      const assignedIds = (log?.task_assignments || [])
        .filter((a: any) => a.task_status !== 'completed')
        .map((a: any) => a.packer_id)
        .filter(Boolean);
      const detailTaskTypeId = log?.task_id || null;
      const detailNotes = detailNotesMap[id] ?? (log?.notes || '');

      // Determine changes for enabling Update
      const selectedSet = new Set(selectedPackerIds);
      const assignedSet = new Set(assignedIds);
      const toAddPackers = selectedPackerIds.filter(pid => !assignedSet.has(pid));
      const toRemovePackers = assignedIds.filter(pid => !selectedSet.has(pid));
      const toAddPackages = selectedPackageIds.filter(opId => !(currentDetailPackages || []).includes(opId));
      const hasChanges = (toAddPackers.length + toRemovePackers.length + toAddPackages.length) > 0;

      return {
        key: `task:${id}`,
        title,
        content: (
          <View className="mx-4 mb-4 bg-white rounded-lg border border-gray-200 p-4">
            {/* Task type select (disabled) */}
            <SimpleSelect
              label="Task"
              items={taskTypes.map(t => ({ label: t.name, value: t.id }))}
              value={detailTaskTypeId}
              onChange={() => {}}
              placeholder="Select a task"
              disabled
            />

            {/* Packers multi-select */}
            <View className="mt-4">
              <Text className="text-gray-600 mb-2">Assign/Remove Packer(s)</Text>
                <View className="border border-gray-300 rounded-md p-3 bg-white">
                  <ScrollView style={{ maxHeight: 180 }}>
                    <View className="flex-row flex-wrap">
                      {teamPackers.map((p) => {
                        const selected = selectedPackerIds.includes(p.id);
                        const isBusy = busyPackerIds.has(p.id) && !assignedSet.has(p.id); // assigned are always selectable
                        
                        let boxStyle = 'px-3 py-2 m-1 rounded-lg border-2 ';
                        let textStyle = 'text-sm font-medium ';
                        if (selected) {
                          boxStyle += 'bg-blue-50 border-blue-500';
                          textStyle += 'text-blue-700';
                        } else if (isBusy) {
                          boxStyle += 'bg-red-50 border-red-400';
                          textStyle += 'text-red-600';
                        } else {
                          boxStyle += 'bg-green-50 border-green-400';
                          textStyle += 'text-green-600';
                        }
                        return (
                          <TouchableOpacity
                            key={p.id}
                            className={boxStyle}
                            onPress={() => {
                              if (isBusy) return;
                              setSelectedPackerIds(prev => selected ? prev.filter(pid => pid !== p.id) : [...prev, p.id]);
                            }}
                            activeOpacity={isBusy ? 1 : 0.7}
                          >
                            <Text className={textStyle} numberOfLines={1}>{p.full_name || p.username}</Text>
                            <Text className={`text-xs mt-1 ${selected ? 'text-blue-600' : isBusy ? 'text-red-500' : 'text-green-500'}`}>{selected ? 'Selected' : (isBusy ? 'Busy' : assignedSet.has(p.id) ? 'Assigned' : 'Available')}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
            </View>

            {/* Notes (editable) */}
            <View className="mt-4">
              <Text className="text-gray-600 mb-1">Notes</Text>
              <TextInput
                className="border border-gray-300 rounded-md bg-white px-2 py-2"
                placeholder="Any special instructions..."
                value={detailNotes}
                onChangeText={(t) => setDetailNotesMap(prev => ({ ...prev, [id]: t }))}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Bottom Action Buttons */}
            <View className="flex-row justify-between mt-6">
              <TouchableOpacity className="bg-blue-50 border border-blue-300 px-4 py-3 rounded-lg flex-1 mr-2" onPress={() => setConsolidateOpen(true)}>
                <Text className="text-blue-700 text-center font-medium">Consolidate Packages</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-4 py-3 rounded-lg flex-1 ml-2 ${hasChanges ? 'bg-green-50 border border-green-600' : 'bg-gray-300'}`}
                disabled={!hasChanges}
                onPress={async () => {
                  // Apply packer changes
                  if (toAddPackers.length) {
                    await db.addTaskAssignments(id, toAddPackers);
                  }
                  if (toRemovePackers.length) {
                    // Mark removed packers as completed to free them
                    await db.updateTaskAssignmentsStatus(id, 'completed', toRemovePackers);
                  }
                  // Apply consolidation additions
                  if (toAddPackages.length) {
                    await db.addTaskPackages(id, toAddPackages);
                  }
                  // Increment update counter per rules and persist notes if changed
                  const nextFields: any = {};
                  if ((log?.notes || '') !== (detailNotesMap[id] ?? '')) nextFields.notes = (detailNotesMap[id] ?? '');
                  await db.incrementTaskLogCounter(id, nextFields);

                  await refreshLogs();
                  await refreshBusyStatus();
                  
                  // Redirect to overview tab
                  setActiveKey('overview');
                }}
              >
                <Text className={`text-center font-medium ${hasChanges ? 'text-green-700' : 'text-gray-600'}`}>Update Task</Text>
              </TouchableOpacity>
            </View>

            {/* Consolidate modal (reused) */}
            <Modal visible={consolidateOpen} transparent animationType="none" onRequestClose={() => setConsolidateOpen(false)}>
              <View className="flex-1 bg-black/30 justify-center items-center">
                <View className="bg-white rounded-xl p-4 w-4/5 max-h-[70%]">
                  <Text className="text-gray-800 font-semibold mb-3">Consolidate with boxes</Text>
                  <ScrollView>
                    <View className="flex-row flex-wrap">
                      {allOrderPackages.map((op) => {
                        const checked = selectedPackageIds.includes(op.id);
                        return (
                          <TouchableOpacity
                            key={op.id}
                            className={`px-3 py-2 m-1 rounded-md border ${checked ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-300'}`}
                            onPress={() => setSelectedPackageIds(prev => checked ? prev.filter(pid => pid !== op.id) : [...prev, op.id])}
                          >
                            <Text className={`text-sm ${checked ? 'text-blue-800' : 'text-gray-800'}`}>Box #{op.package_number ?? '—'}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <View className="flex-row justify-end mt-3">
                    <TouchableOpacity className="mr-3" onPress={() => setConsolidateOpen(false)}>
                      <Text className="text-gray-700">Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="bg-blue-50 border border-blue-600 px-3 py-1 rounded" onPress={() => setConsolidateOpen(false)}>
                      <Text className="text-blue-700">Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        ),
      } as TabDefinition;
    });

    const baseTabs = activeKey === 'new' ? [overview, newTask] : [overview];
    return [...baseTabs, ...details];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskLogs, taskTypes, teamPackers, activeKey, selectedTaskTypeId, selectedPackerIds, selectedPackageIds]);

  // Build modal data
  const idToName = useMemo(() => {
    const map: Record<string, string> = {};
    (teamPackers || []).forEach(p => { map[p.id] = p.full_name || p.username || p.id; });
    return map;
  }, [teamPackers]);

  const availableNames = useMemo(() => {
    return (teamPackers || [])
      .filter(p => !busyPackerIds.has(p.id))
      .map(p => idToName[p.id]);
  }, [teamPackers, busyPackerIds, idToName]);

  const busyDetails = useMemo(() => {
    // Use allTaskLogs (all tasks across all packages) instead of just taskLogs (current view)
    const activeLogs = (allTaskLogs || []).filter((l: any) => !l.end_time);
    
    // Group by task, then show packers and boxes for each task
    const taskMap: Record<string, { taskName: string; packerIds: Set<string>; boxNumbers: Set<number | null> }> = {};
    
    activeLogs.forEach((log: any) => {
      const taskName = log?.tasks?.name || 'Task';
      const taskId = log.id;
      
      // Get box numbers for this task
      const packageIds = (log.task_packages || []).map((tp: any) => tp.order_package_id).filter(Boolean);
      const boxNumbers = packageIds.map((pkgId: string) => {
        const pkg = allOrderPackages.find(p => p.id === pkgId);
        return pkg?.package_number ?? null;
      });
      
      // Get active packers for this task
      const activePackers = (log.task_assignments || [])
        .filter((a: any) => a?.packer_id && ['in_progress', 'paused'].includes(a.task_status))
        .map((a: any) => a.packer_id);
      
      if (activePackers.length > 0) {
        if (!taskMap[taskId]) {
          taskMap[taskId] = { taskName, packerIds: new Set(), boxNumbers: new Set(boxNumbers) };
        }
        activePackers.forEach((pid: string) => taskMap[taskId].packerIds.add(pid));
      }
    });
    
    // Convert to display format: group by task, show all packers and boxes
    return Object.values(taskMap).map(({ taskName, packerIds, boxNumbers }) => {
      const packerNames = Array.from(packerIds).map(pid => idToName[pid] || pid).join(', ');
      const boxList = Array.from(boxNumbers).map(num => `Box #${num ?? '—'}`).join(', ');
      return { task: taskName, packers: packerNames, boxes: boxList };
    });
  }, [allTaskLogs, idToName, allOrderPackages]);

  return (
    <View>
      <TaskAssignmentHeader 
        availableCount={availableCount} 
        busyCount={busyCount}
        onAvailablePress={() => setShowAvailableModal(true)}
        onBusyPress={() => setShowBusyModal(true)}
        onBreakPress={handleBreak}
        isOnBreak={isOnBreak}
      />
      <TabLayout tabs={tabs} activeKey={activeKey} onChange={setActiveKey} />

      {/* Available modal */}
      <Modal visible={showAvailableModal} transparent animationType="fade" onRequestClose={() => setShowAvailableModal(false)}>
        <View className="flex-1 bg-black/30 justify-center items-center">
          <View className="bg-white rounded-xl p-4 w-4/5">
            <Text className="text-gray-800 font-semibold mb-2">Available Packers</Text>
            {availableNames.length === 0 ? (
              <Text className="text-gray-600">No one is available right now.</Text>
            ) : (
              availableNames.map((n, i) => (
                <Text key={i} className="text-gray-800 mb-1">• {n}</Text>
              ))
            )}
            <TouchableOpacity className="mt-3 self-end" onPress={() => setShowAvailableModal(false)}>
              <Text className="text-primary-700 font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Busy modal */}
      <Modal visible={showBusyModal} transparent animationType="fade" onRequestClose={() => setShowBusyModal(false)}>
        <View className="flex-1 bg-black/30 justify-center items-center">
          <View className="bg-white rounded-xl p-4 w-4/5 max-h-[80%]">
            <Text className="text-gray-800 font-semibold mb-3 text-lg">Active Tasks</Text>
            {busyDetails.length === 0 ? (
              <Text className="text-gray-600">No active tasks right now.</Text>
            ) : (
              <ScrollView>
                {busyDetails.map((d, i) => (
                  <View key={i} className="mb-3 p-2 bg-gray-50 rounded">
                    <Text className="text-gray-800 font-semibold mb-1">{d.task}</Text>
                    <Text className="text-gray-700 text-sm">
                      <Text className="font-medium">Packers:</Text> {d.packers}
                    </Text>
                    <Text className="text-gray-700 text-sm">
                      <Text className="font-medium">Boxes:</Text> {d.boxes}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity className="mt-3 self-end" onPress={() => setShowBusyModal(false)}>
              <Text className="text-primary-700 font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OrderTasksManagement;
