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

  const [activeKey, setActiveKey] = useState('overview');
  const [openTaskIds, setOpenTaskIds] = useState<string[]>([]);
  const [pauseStartMap, setPauseStartMap] = useState<Record<string, number>>({}); // taskId -> epoch ms

  // New Task form state
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<string | null>(null);
  const [selectedPackerIds, setSelectedPackerIds] = useState<string[]>([]);
  const [consolidateOpen, setConsolidateOpen] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>(orderPackages.length ? [orderPackages[0].id] : []);
  const [notes, setNotes] = useState<string>('');

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

  const refreshLogs = async () => {
    let data;
    if (orderPackages.length === 1) {
      // Single package mode - use package-specific query to only get tasks for this package
      const { data: packageData } = await db.getTaskLogsForPackage(orderPackages[0].id);
      data = packageData;
    } else {
      // Multi-package mode (overview) - get tasks for all packages
      const ids = orderPackages.map(op => op.id);
      const { data: allData } = await db.getTaskLogsByOrderPackageIds(ids);
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

  // When switching to a task detail tab, preload its assignments and linked packages
  useEffect(() => {
    if (!activeKey.startsWith('task:')) return;
    const id = activeKey.replace('task:', '');
    const log = (taskLogs as any[]).find(l => l.id === id);
    if (!log) return;
    setCurrentDetailTaskId(id);
    const assigned = (log.task_assignments || []).map((a: any) => a.packer_id).filter(Boolean);
    setCurrentDetailAssignedPackers(assigned);
    setSelectedPackerIds(assigned);
    setDetailNotesMap(prev => ({ ...prev, [id]: prev[id] ?? (log?.notes || '') }));
    (async () => {
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
            <View className="px-4 py-3">
              <TaskLogsTable
                rows={taskLogs as any}
                orderPackageId={orderPackages.length === 1 ? orderPackages[0].id : undefined}
                onRowPress={(id) => {
                  if (!openTaskIds.includes(id)) setOpenTaskIds(prev => [...prev, id]);
                  setActiveKey(`task:${id}`);
                }}
                onPause={async (id) => {
                  // Toggle pause/resume based on current state
                  const now = Date.now();
                  const paused = pauseStartMap[id] != null;
                  if (!paused) {
                    await db.updateTaskAssignmentsStatus(id, 'paused');
                    setPauseStartMap(prev => ({ ...prev, [id]: now }));
                  } else {
                    // Resume: set to in_progress and add pause seconds
                    const deltaSec = Math.max(0, Math.floor((now - (pauseStartMap[id] || now)) / 1000));
                    await db.updateTaskAssignmentsStatus(id, 'in_progress');
                    await db.addPauseDuration(id, deltaSec);
                    const copy = { ...pauseStartMap }; delete copy[id]; setPauseStartMap(copy);
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
            </View>
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
              className={`px-4 py-3 rounded-lg flex-1 ml-2 ${(!selectedTaskTypeId || !selectedPackageIds.length || !selectedPackerIds.length) ? 'bg-gray-300' : 'bg-green-50 border border-green-600'}`}
              disabled={!selectedTaskTypeId || !selectedPackageIds.length || !selectedPackerIds.length}
              onPress={async () => {
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
                    await refreshLogs();
                    await refreshBusyStatus();
                    // persist detail tab for the new task
                    setOpenTaskIds(prev => [...prev, data.task_log_id]);
                    // Switch to overview tab after starting task
                    setActiveKey('overview');
                    // reset selections (keep task for convenience)
                    setSelectedPackerIds([]);
                    setNotes('');
                  }
                    // reset selections (keep task for convenience)
                    setSelectedPackerIds([]);
                    setNotes('');
                  }}
                >
                  <Text className={`text-center font-medium ${(!selectedTaskTypeId || !selectedPackageIds.length || !selectedPackerIds.length) ? 'text-gray-600' : 'text-green-700'}`}>Start Task</Text>
                </TouchableOpacity>
          </View>

          {/* Consolidate modal */}
          <Modal visible={consolidateOpen} transparent animationType="fade" onRequestClose={() => setConsolidateOpen(false)}>
            <TouchableOpacity className="flex-1 bg-black/30 justify-center items-center" activeOpacity={1} onPress={() => setConsolidateOpen(false)}>
              <TouchableOpacity className="bg-white rounded-xl p-4 w-4/5 max-h-[70%]" activeOpacity={1} onPress={(e) => e.stopPropagation()}>
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
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </View>
      ),
    };

    // Create detail tabs for openTaskIds
    const details: TabDefinition[] = openTaskIds.map((id) => {
      const log = (taskLogs as any[]).find(l => l.id === id);
      const title = log?.tasks?.name ? `Task: ${log.tasks.name}` : 'Task Detail';
      const assignedIds = (log?.task_assignments || []).map((a: any) => a.packer_id).filter(Boolean);
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
                }}
              >
                <Text className={`text-center font-medium ${hasChanges ? 'text-green-700' : 'text-gray-600'}`}>Update Task</Text>
              </TouchableOpacity>
            </View>

            {/* Consolidate modal (reused) */}
            <Modal visible={consolidateOpen} transparent animationType="fade" onRequestClose={() => setConsolidateOpen(false)}>
              <TouchableOpacity className="flex-1 bg-black/30 justify-center items-center" activeOpacity={1} onPress={() => setConsolidateOpen(false)}>
                <TouchableOpacity className="bg-white rounded-xl p-4 w-4/5 max-h-[70%]" activeOpacity={1} onPress={(e) => e.stopPropagation()}>
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
                </TouchableOpacity>
              </TouchableOpacity>
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
    // Map packer -> set of task names from active logs
    const map: Record<string, Set<string>> = {};
    const activeLogs = (taskLogs || []).filter((l: any) => !l.end_time);
    activeLogs.forEach((log: any) => {
      const taskName = log?.tasks?.name || 'Task';
      (log.task_assignments || []).forEach((a: any) => {
        if (a?.packer_id && ['in_progress', 'paused'].includes(a.task_status)) {
          if (!map[a.packer_id]) map[a.packer_id] = new Set<string>();
          map[a.packer_id].add(taskName);
        }
      });
    });
    return Object.keys(map).map(pid => ({ name: idToName[pid] || pid, task: Array.from(map[pid]).join(', ') }));
  }, [taskLogs, idToName]);

  return (
    <View>
      <TaskAssignmentHeader 
        availableCount={availableCount} 
        busyCount={busyCount}
        onAvailablePress={() => setShowAvailableModal(true)}
        onBusyPress={() => setShowBusyModal(true)}
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
          <View className="bg-white rounded-xl p-4 w-4/5">
            <Text className="text-gray-800 font-semibold mb-2">Busy Packers</Text>
            {busyDetails.length === 0 ? (
              <Text className="text-gray-600">No one is busy right now.</Text>
            ) : (
              busyDetails.map((d, i) => (
                <Text key={i} className="text-gray-800 mb-1">• {d.name} — {d.task}</Text>
              ))
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
