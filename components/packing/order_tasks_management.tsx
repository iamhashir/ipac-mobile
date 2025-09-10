import React, { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    const init = async () => {
      const { data: team } = await db.getTeamPackersForOrder(orderId);
      const t = (team || []) as TeamPacker[];
      setTeamPackers(t);

      await refreshBusyStatus(t);

      const { data: tasksList } = await db.getTasks();
      setTaskTypes((tasksList || []).map((t: any) => ({ id: t.id, name: t.name })));

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
        await refreshLogs();
        await refreshBusyStatus();
      })
      .subscribe();

    // Fallback polling every 5s in case websocket can't connect
    const poll = setInterval(() => {
      refreshLogs();
      refreshBusyStatus();
    }, 5000);

    return () => {
      clearInterval(poll);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [orderId]);

  const refreshLogs = async () => {
    const ids = orderPackages.map(op => op.id);
    const { data } = await db.getTaskLogsByOrderPackageIds(ids);
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
    const { data: busyIds } = await db.getBusyPackerIds();
    const busySet = new Set<string>(busyIds || []);
    setBusyPackerIds(busySet);
    const list = team || teamPackers;
    setAvailableCount(list.filter(x => !busySet.has(x.id)).length);
    setBusyCount(list.filter(x => busySet.has(x.id)).length);
  };

  const tabs: TabDefinition[] = useMemo(() => {
    const overview: TabDefinition = {
      key: 'overview',
      title: 'Overview',
      content: (
        <View className="mx-4 mb-4 bg-white rounded-lg border border-gray-300 mt-4">
          <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200 rounded-t-lg">
            <Text className="text-gray-800 font-semibold">Task logs</Text>
            <TouchableOpacity className="bg-primary-600 px-3 py-1 rounded" onPress={() => setActiveKey('new')}>
              <Text className="text-white">Create Task</Text>
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
                  const { error } = await db.finishTaskLog(id);
                  if (error) {
                    console.error('Error finishing task:', error);
                    return;
                  }
                  setOpenTaskIds(prev => prev.filter(x => x !== id));
                  await refreshLogs();
                  await refreshBusyStatus();
                  setActiveKey('overview');
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

          {/* Packers multi-select (simple toggle list) */}
            <View className="flex-row items-start mt-4">
              <View className="flex-1">
                <Text className="text-gray-600 mb-1">Assign Packer(s)</Text>
                <View className="border border-gray-300 rounded-md p-2 bg-white">
                  <ScrollView style={{ maxHeight: 160 }}>
                    {teamPackers.map((p) => {
                      const selected = selectedPackerIds.includes(p.id);
                      const isBusy = busyPackerIds.has(p.id);
                      return (
                        <TouchableOpacity
                          key={p.id}
                          className={`flex-row items-center justify-between px-2 py-2 border-b border-gray-100 ${isBusy ? 'opacity-60' : ''}`}
                          onPress={() => {
                            if (isBusy) return; // disable busy packer selection
                            setSelectedPackerIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                          }}
                          activeOpacity={isBusy ? 1 : 0.7}
                        >
                          <Text className={`text-gray-800`}>{p.full_name || p.username}</Text>
                          <Text className={`text-xs ${selected ? 'text-primary-700' : isBusy ? 'text-red-600' : 'text-green-700'}`}>{selected ? 'Selected' : (isBusy ? 'Busy' : 'Available')}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Notes */}
                <View className="mt-3">
                  <Text className="text-gray-600 mb-1">Notes</Text>
                  <TextInput
                    className="border border-gray-300 rounded-md bg-white px-2 py-1"
                    placeholder="Any special instructions..."
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />
                </View>
              </View>

              <View className="ml-3 w-[22%]">
                <TouchableOpacity className="bg-blue-100 px-3 py-2 rounded mb-2" onPress={() => setConsolidateOpen(true)}>
                  <Text className="text-blue-800 text-center">Consolidate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`px-3 py-2 rounded ${(!selectedTaskTypeId || !selectedPackageIds.length || !selectedPackerIds.length) ? 'bg-green-300' : 'bg-green-600'}`}
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
                    // persist detail tab for the new task
                    setOpenTaskIds(prev => [...prev, data.task_log_id]);
                    setActiveKey(`task:${data.task_log_id}`);
                    // reset selections (keep task for convenience)
                    setSelectedPackerIds([]);
                    setNotes('');
                  }
                    // reset selections (keep task for convenience)
                    setSelectedPackerIds([]);
                    setNotes('');
                  }}
                >
                  <Text className="text-white text-center">Start</Text>
                </TouchableOpacity>
              </View>
            </View>

          {/* Consolidate modal */}
          <Modal visible={consolidateOpen} transparent animationType="fade" onRequestClose={() => setConsolidateOpen(false)}>
            <View className="flex-1 bg-black/30 justify-center items-center">
              <View className="bg-white rounded-xl p-4 w-4/5 max-h-[70%]">
                <Text className="text-gray-800 font-semibold mb-2">Consolidate with order packages</Text>
                <ScrollView>
                  {orderPackages.map((op) => {
                    const checked = selectedPackageIds.includes(op.id);
                    return (
                      <TouchableOpacity key={op.id} className="flex-row items-center justify-between px-2 py-2 border-b border-gray-100"
                        onPress={() => setSelectedPackageIds(prev => checked ? prev.filter(id => id !== op.id) : [...prev, op.id])}
                      >
                        <Text className="text-gray-800">Box #{op.package_number ?? '—'}</Text>
                        <Text className={`text-xs ${checked ? 'text-primary-700' : 'text-gray-500'}`}>{checked ? 'Selected' : 'Tap to select'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View className="flex-row justify-end mt-3">
                  <TouchableOpacity className="mr-3" onPress={() => setConsolidateOpen(false)}>
                    <Text className="text-gray-700">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="bg-primary-600 px-3 py-1 rounded" onPress={() => setConsolidateOpen(false)}>
                    <Text className="text-white">Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      ),
    };

    // Create detail tabs for openTaskIds
    const details: TabDefinition[] = openTaskIds.map((id) => {
      const log = (taskLogs as any[]).find(l => l.id === id);
      const title = log?.tasks?.name ? `Task: ${log.tasks.name}` : 'Task Detail';
      return {
        key: `task:${id}`,
        title,
        content: (
          <View className="mx-4 mb-4 bg-white rounded-lg border border-gray-200 p-4">
            <Text className="text-gray-800 font-semibold mb-2">Edit Task</Text>
            {/* Notes editor */}
            <View className="mt-2">
              <Text className="text-gray-600 mb-1">Notes</Text>
              {/* reuse simple TextInput inline */}
              <View className="border border-gray-300 rounded-md bg-white px-2 py-1">
                <Text className="text-gray-700">{log?.notes || '—'}</Text>
              </View>
            </View>

            {/* Controls */}
            <View className="flex-row mt-3">
              <TouchableOpacity
                className="px-3 py-2 rounded bg-yellow-100 mr-2"
                onPress={async () => {
                  // Pause/Resume toggle (same as list)
                  const paused = pauseStartMap[id] != null;
                  if (!paused) {
                    await db.updateTaskAssignmentsStatus(id, 'paused');
                    setPauseStartMap(prev => ({ ...prev, [id]: Date.now() }));
                  } else {
                    const now = Date.now();
                    const deltaSec = Math.max(0, Math.floor((now - (pauseStartMap[id] || now)) / 1000));
                    await db.updateTaskAssignmentsStatus(id, 'in_progress');
                    await db.addPauseDuration(id, deltaSec);
                    const copy = { ...pauseStartMap }; delete copy[id]; setPauseStartMap(copy);
                  }
                  await refreshLogs();
                  await refreshBusyStatus();
                }}
              >
                <Text className="text-yellow-800">{pauseStartMap[id] ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="px-3 py-2 rounded bg-green-600"
                onPress={async () => {
                  // Use the new finishTaskLog function that properly calculates duration
                  const { error } = await db.finishTaskLog(id);
                  if (error) {
                    console.error('Error finishing task:', error);
                    return;
                  }
                  setOpenTaskIds(prev => prev.filter(x => x !== id));
                  await refreshLogs();
                  setActiveKey('overview');
                }}
              >
                <Text className="text-white">Finish</Text>
              </TouchableOpacity>
            </View>
          </View>
        ),
      } as TabDefinition;
    });

    const baseTabs = activeKey === 'new' ? [overview, newTask] : [overview];
    return [...baseTabs, ...details];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskLogs, taskTypes, teamPackers, activeKey, selectedTaskTypeId, selectedPackerIds, selectedPackageIds]);

  return (
    <View>
      <TaskAssignmentHeader availableCount={availableCount} busyCount={busyCount} />
      <TabLayout tabs={tabs} activeKey={activeKey} onChange={setActiveKey} />
    </View>
  );
};

export default OrderTasksManagement;
