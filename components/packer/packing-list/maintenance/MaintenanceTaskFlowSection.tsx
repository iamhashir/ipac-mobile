import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Plus } from 'lucide-react-native';

import CollapsibleCard from '../common/CollapsibleCard';
import { db } from '../../../../utils/api/supabase';
import GasPackingSection from '../section_07_gas/GasPackingSection';
import VacuumPackingSection from '../section_08_vacuum/VacuumPackingSection';
import OrderPackageMaterialsSection from '../shared/materials/OrderPackageMaterialsSection';

import { usePackerSession } from '../../../../utils/PackerSessionContext';

type MaintenanceTaskCategory = 'survey' | 'unpack' | 'repack';
type MaintenanceTaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

type TaskLogRow = {
  id: string;
  order_package_id: string;
  task_id: string;
  sequence_order: number;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  task_status: MaintenanceTaskStatus;
  category: MaintenanceTaskCategory;
  tasks?: { name?: string; description?: string } | Array<{ name?: string; description?: string }> | null;
};

type TaskDefinition = {
  id: string;
  name: string;
  description: string | null;
};

const CATEGORY_ORDER: MaintenanceTaskCategory[] = ['survey', 'unpack', 'repack'];
const CATEGORY_LABEL: Record<MaintenanceTaskCategory, string> = {
  survey: 'Survey',
  unpack: 'Unpack',
  repack: 'Repack',
};

const FALLBACK_TASK_COPY: Record<string, string> = {
  'External Inspection': 'Take 4 photos, one from each corner of the package.',
  'Indicator Check': 'Check for battery humidity/temp indicators and take a picture of the value.',
  'Oxygen Verification': 'Measure and photo oxygen levels (Gas Packing only).',
  'Internal Securing Review': 'Take photos of the interior of the package.',
  'Barrier Check': 'Take photos of the vacuum bag/laminate before it is cut.',
  'Equipment Verification': 'Take photos of the bare equipment once fully unpacked.',
  'External Device Reading': 'If requested, log result and photo of certified sensor reading.',
  'New Barrier Check': 'Take photos of the new vacuum bag/laminate.',
  'Final Documentation': 'Take photos of the physical working sheet and file reference if it is there.',
  'New Package Evidence': 'Take photos of the new package.',
};

const isDone = (status: MaintenanceTaskStatus) => status === 'completed' || status === 'skipped';

const asTaskRelation = (value: TaskLogRow['tasks']) => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

type RepackChip = 'vacuum' | 'gas' | 'defensor' | 'heatshrink';

interface MaintenanceTaskFlowSectionProps {
  orderPackageId: string;
  orderPkgInstanceId?: string | null;
  readOnly?: boolean;
  activeSeiCategoryId?: string | null;
  activeSeiProtectionId?: string | null;
  activeBoxTypeId?: string | null;
}

type SeiCategoryLookup = { id: number; code: number | null; name: string; description?: string | null };
type SeiProtectionLookup = { id: number; code: string; name: string; description?: string | null };

const MaintenanceTaskFlowSection: React.FC<MaintenanceTaskFlowSectionProps> = ({ orderPackageId, orderPkgInstanceId = null, readOnly = false, activeSeiCategoryId, activeSeiProtectionId, activeBoxTypeId }) => {
  const { getRetrospectiveTimestamp } = usePackerSession();
  const [rows, setRows] = useState<TaskLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingTaskId, setWorkingTaskId] = useState<string | null>(null);
  const [taskMediaCount, setTaskMediaCount] = useState<Record<string, number>>({});
  const [taskMediaByTaskId, setTaskMediaByTaskId] = useState<Record<string, any[]>>({});
  const [allTasks, setAllTasks] = useState<TaskDefinition[]>([]);
  const [addPickerCategory, setAddPickerCategory] = useState<MaintenanceTaskCategory | null>(null);
  const [teamPackers, setTeamPackers] = useState<Array<{ id: string; full_name?: string; username?: string }>>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string[]>>({});
  const [assignmentPickerTaskId, setAssignmentPickerTaskId] = useState<string | null>(null);
  const [repackChips, setRepackChips] = useState<Record<RepackChip, boolean>>({
    vacuum: false,
    gas: false,
    defensor: false,
    heatshrink: false,
  });
  const [seiCategoryId, setSeiCategoryId] = useState<string | null>(null);
  const [seiProtectionId, setSeiProtectionId] = useState<string | null>(null);
  const [seiCategories, setSeiCategories] = useState<Record<string, SeiCategoryLookup>>({});
  const [seiProtections, setSeiProtections] = useState<Record<string, SeiProtectionLookup>>({});
  const [maintenancePackageType, setMaintenancePackageType] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<MaintenanceTaskCategory, TaskLogRow[]> = {
      survey: [],
      unpack: [],
      repack: [],
    };

    rows
      .slice()
      .sort((first, second) => Number(first.sequence_order || 0) - Number(second.sequence_order || 0))
      .forEach((row) => {
        map[row.category].push(row);
      });

    return map;
  }, [rows]);

  const orderedRows = useMemo(
    () => rows.slice().sort((first, second) => Number(first.sequence_order || 0) - Number(second.sequence_order || 0)),
    [rows]
  );

  const effectiveAssignmentMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    let carry: string[] = [];

    orderedRows.forEach((row) => {
      const explicit = assignmentMap[row.id];
      if (explicit && explicit.length > 0) {
        carry = explicit;
        map[row.id] = explicit;
      } else {
        map[row.id] = carry;
      }
    });

    return map;
  }, [orderedRows, assignmentMap]);

  const refreshTaskArtifacts = async (taskLogIds: string[]) => {
    if (!taskLogIds.length) return;

    const mediaResults = await Promise.all(
      taskLogIds.map(async (taskLogId) => {
        const result = await db.getMediaForMaintenanceTask(taskLogId as any);
        return { taskLogId, media: result.data || [] };
      })
    );

    setTaskMediaCount((prev) => {
      const next = { ...prev };
      mediaResults.forEach(({ taskLogId, media }) => {
        next[taskLogId] = media.length;
      });
      return next;
    });

    setTaskMediaByTaskId((prev) => {
      const next = { ...prev };
      mediaResults.forEach(({ taskLogId, media }) => {
        next[taskLogId] = media;
      });
      return next;
    });

    const { data: assignmentRows, error: assignmentError } = await db.getMaintenanceTaskAssignmentsByTaskLogIds(taskLogIds as any);
    if (assignmentError) {
      console.log('➡️ MaintenanceTaskFlowSection: failed loading assignments', assignmentError);
      return;
    }

    setAssignmentMap((prev) => {
      const next = { ...prev };
      taskLogIds.forEach((id) => {
        next[id] = [];
      });
      (assignmentRows || []).forEach((row: any) => {
        const key = row.maintenance_task_log_id;
        if (!next[key]) next[key] = [];
        if (row.packer_id) next[key].push(row.packer_id);
      });
      return next;
    });
  };

  const refreshRows = async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const { data, error } = await db.getMaintenanceTaskLogsForPackage(orderPackageId);
      if (error) {
        console.log('➡️ MaintenanceTaskFlowSection: failed loading logs', error);
        Alert.alert('Error', 'Failed to load maintenance tasks');
        return;
      }

      const nextRows = ((data || []) as TaskLogRow[]).sort(
        (first, second) => Number(first.sequence_order || 0) - Number(second.sequence_order || 0)
      );
      setRows(nextRows);
      await refreshTaskArtifacts(nextRows.map((row) => row.id));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const refreshTeamPackers = async () => {
    const { data: pkg, error: pkgError } = await db.getOrderPackageById(orderPackageId);
    if (pkgError || !pkg) {
      console.log('➡️ MaintenanceTaskFlowSection: failed loading package for team', pkgError);
      return;
    }

    const { data: teamRows, error: teamError } = await db.getTeamPackersForOrder((pkg as any).order_id);
    if (teamError) {
      console.log('➡️ MaintenanceTaskFlowSection: failed loading team packers', teamError);
      return;
    }

    setTeamPackers((teamRows || []) as Array<{ id: string; full_name?: string; username?: string }>);
  };

  const refreshPackageMetadata = async () => {
    // If we have active props, use them first to avoid flashing empty state
    if (activeSeiCategoryId !== undefined) setSeiCategoryId(activeSeiCategoryId);
    if (activeSeiProtectionId !== undefined) setSeiProtectionId(activeSeiProtectionId);

    const { data, error } = await db.getOrderPackageById(orderPackageId);
    if (error) {
      console.log('➡️ MaintenanceTaskFlowSection: failed loading package metadata', error);
      return;
    }

    // sync the DB values if props are not provided
    if (activeSeiCategoryId === undefined && activeSeiProtectionId === undefined) {
      const finalInfoId = (data as any)?.final_pkg_info || null;
      const originalInfoId = (data as any)?.original_pkg_info || null;
      const targetInfoId = finalInfoId || originalInfoId;

      if (targetInfoId) {
        const { data: infoRows, error: infoError } = await db.getPackageInfosByIds([targetInfoId] as any);
        if (infoError) {
          console.log('➡️ MaintenanceTaskFlowSection: failed loading package_info metadata', infoError);
        } else {
          const row = (infoRows || [])[0] as any;
          setSeiCategoryId(row?.sei_category !== null && row?.sei_category !== undefined ? String(row.sei_category) : null);
          setSeiProtectionId(row?.sei_protection !== null && row?.sei_protection !== undefined ? String(row.sei_protection) : null);
        }
      } else {
        setSeiCategoryId(null);
        setSeiProtectionId(null);
      }
    }

    setMaintenancePackageType(((data as any)?.maintenance_package_type || null) as string | null);
  };

  const refreshSeiLookups = async () => {
    const [{ data: categoryRows, error: categoryError }, { data: protectionRows, error: protectionError }] = await Promise.all([
      db.getSeiCategories(),
      db.getSeiProtections(),
    ]);

    if (categoryError) {
      console.log('➡️ MaintenanceTaskFlowSection: failed loading sei categories', categoryError);
    }
    if (protectionError) {
      console.log('➡️ MaintenanceTaskFlowSection: failed loading sei protections', protectionError);
    }

    const categoryMap: Record<string, SeiCategoryLookup> = {};
    (categoryRows || []).forEach((row: any) => {
      categoryMap[String(row.id)] = {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
      };
    });

    const protectionMap: Record<string, SeiProtectionLookup> = {};
    (protectionRows || []).forEach((row: any) => {
      protectionMap[String(row.id)] = {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
      };
    });

    setSeiCategories(categoryMap);
    setSeiProtections(protectionMap);
  };

  const refreshTaskLibrary = async () => {
    const { data, error } = await db.getTasks();
    if (error) {
      console.log('➡️ MaintenanceTaskFlowSection: failed loading task library', error);
      return;
    }

    setAllTasks(
      (data || []).map((task: any) => ({
        id: task.id,
        name: task.name,
        description: task.description || null,
      }))
    );
  };

  useEffect(() => {
    if (activeSeiCategoryId !== undefined) setSeiCategoryId(activeSeiCategoryId);
  }, [activeSeiCategoryId]);

  useEffect(() => {
    if (activeSeiProtectionId !== undefined) {
      setSeiProtectionId(activeSeiProtectionId);
    }
  }, [activeSeiProtectionId]);

  useEffect(() => {
    if (!orderPackageId) return;
    setRows([]);
    setTaskMediaCount({});
    setTaskMediaByTaskId({});
    setAssignmentMap({});
    refreshRows({ showLoading: true });
    refreshTaskLibrary();
    refreshSeiLookups();
    refreshPackageMetadata();
    refreshTeamPackers();
  }, [orderPackageId]);

  useEffect(() => {
    const protectionCode = seiProtectionId ? seiProtections[seiProtectionId]?.code : null;
    const normalizedProtection = String(protectionCode || '').toLowerCase().trim();

    const canGasBySei = ['cdi', 'ci', 'i'].includes(normalizedProtection) || normalizedProtection.includes('gas');
    const canVacuumBySei = ['c', 'cd'].includes(normalizedProtection) || normalizedProtection.includes('vacuum');

    setRepackChips((previous) => ({
      ...previous,
      vacuum: canVacuumBySei ? true : false,
      gas: canGasBySei ? true : false,
      defensor: previous.defensor,
      heatshrink: previous.heatshrink,
    }));
  }, [seiProtectionId, seiProtections]);

  const availableRepackChips: RepackChip[] = useMemo(() => {
    const protectionCode = seiProtectionId ? seiProtections[seiProtectionId]?.code : null;
    const normalizedProtection = String(protectionCode || '').toLowerCase().trim();

    const canGas = ['cdi', 'ci', 'i'].includes(normalizedProtection) || normalizedProtection.includes('gas');
    const canVacuum = ['c', 'cd'].includes(normalizedProtection) || normalizedProtection.includes('vacuum');

    const chips: RepackChip[] = [];
    if (canVacuum) chips.push('vacuum');
    if (canGas) chips.push('gas');
    chips.push('defensor');
    chips.push('heatshrink');
    return chips;
  }, [seiProtectionId, seiProtections]);

  const chipLabel = (chip: RepackChip) => {
    if (chip === 'vacuum') return 'Vacuum';
    if (chip === 'gas') return 'Gas';
    if (chip === 'defensor') return 'Defensor';
    return 'Heatshrink';
  };

  const canUnlockTask = (row: TaskLogRow) => {
    if (row.task_status !== 'pending' && row.task_status !== 'in_progress') return false;
    if (row.task_status === 'in_progress') return true;

    const categoryIndex = CATEGORY_ORDER.indexOf(row.category);

    for (let index = 0; index < categoryIndex; index += 1) {
      const previousCategory = CATEGORY_ORDER[index];
      const previousRows = grouped[previousCategory];
      if (previousRows.length > 0 && previousRows.some((entry) => !isDone(entry.task_status))) {
        return false;
      }
    }

    const currentCategoryRows = grouped[row.category];
    const ordered = currentCategoryRows
      .slice()
      .sort((first, second) => Number(first.sequence_order || 0) - Number(second.sequence_order || 0));
    const currentIndex = ordered.findIndex((entry) => entry.id === row.id);
    if (currentIndex <= 0) return true;

    const previousInCategory = ordered[currentIndex - 1];
    return isDone(previousInCategory.task_status);
  };

  const updateTaskStatus = async (row: TaskLogRow, status: MaintenanceTaskStatus) => {
    const assigned = effectiveAssignmentMap[row.id] || [];
    if (status === 'in_progress' && assigned.length === 0) {
      Alert.alert('Assign packers', 'Please assign at least one packer before starting this task.');
      return;
    }

    setWorkingTaskId(row.id);
    const previousRows = rows;
    try {
      if (status === 'in_progress') {
        const explicit = assignmentMap[row.id] || [];
        if (explicit.length === 0 && assigned.length > 0) {
          const { error: assignmentError } = await db.setMaintenanceTaskAssignments(row.id as any, assigned as any);
          if (assignmentError) {
            console.log('➡️ MaintenanceTaskFlowSection: failed inheriting assignments', assignmentError);
            Alert.alert('Error', 'Could not apply packer assignments for this task');
            return;
          }
          setAssignmentMap((prev) => ({ ...prev, [row.id]: assigned }));
        }
      }

      const nowIso = getRetrospectiveTimestamp();
      const patch: Record<string, unknown> = { task_status: status };

      if (status === 'in_progress') {
        patch.start_time = row.start_time || nowIso;
        patch.end_time = null;
      }

      if (status === 'completed' || status === 'skipped') {
        const startIso = row.start_time || nowIso;
        const durationMinutes = Math.max(0, Math.floor((new Date(nowIso).getTime() - new Date(startIso).getTime()) / 60000));
        patch.end_time = nowIso;
        patch.duration_minutes = durationMinutes;
      }

      setRows((prev) =>
        prev.map((entry) =>
          entry.id === row.id
            ? {
                ...entry,
                task_status: status,
                start_time: (patch.start_time as string | null | undefined) ?? entry.start_time,
                end_time: (patch.end_time as string | null | undefined) ?? entry.end_time,
                duration_minutes:
                  typeof patch.duration_minutes === 'number'
                    ? (patch.duration_minutes as number)
                    : entry.duration_minutes,
              }
            : entry
        )
      );

      const { error } = await db.updateMaintenanceTaskLog(row.id, patch);
      if (error) {
        console.log('➡️ MaintenanceTaskFlowSection: failed updating status', error);
        Alert.alert('Error', 'Could not update task status');
        setRows(previousRows);
        return;
      }
    } finally {
      setWorkingTaskId(null);
    }
  };

  const pickAndUploadPhoto = async (row: TaskLogRow) => {
    if (readOnly) return;

    const uploadFromUri = async (uri: string) => {
      setWorkingTaskId(row.id);
      try {
        const relation = asTaskRelation(row.tasks);
        const notes = relation?.name ? `${relation.name} - seq ${row.sequence_order}` : `Maintenance task ${row.sequence_order}`;
        const { error } = await db.uploadMaintenanceTaskMedia(orderPackageId, row.id, row.category, uri, notes, orderPkgInstanceId);

        if (error) {
          console.log('➡️ MaintenanceTaskFlowSection: failed upload', error);
          Alert.alert('Upload failed', error?.message || 'Could not upload photo');
          return;
        }

        await refreshTaskArtifacts([row.id]);
      } finally {
        setWorkingTaskId(null);
      }
    };

    Alert.alert('Attach image', 'Choose source', [
      {
        text: 'Gallery',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (permission.status !== 'granted') {
            Alert.alert('Permission required', 'Media library access is needed.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
          if (!result.canceled && result.assets?.length) {
            await uploadFromUri(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Camera',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (permission.status !== 'granted') {
            Alert.alert('Permission required', 'Camera access is needed.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled && result.assets?.length) {
            await uploadFromUri(result.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleComplete = async (row: TaskLogRow) => {
    const mediaCount = taskMediaCount[row.id] || 0;
    if (mediaCount <= 0) {
      Alert.alert('Photo required', 'Please capture at least one photo before completing this task.');
      return;
    }

    if (row.sequence_order === 9 && mediaCount <= 0) {
      Alert.alert('Working sheet required', 'Task 9 requires at least one photo before completion.');
      return;
    }

    await updateTaskStatus(row, 'completed');
  };

  const addTaskToCategory = async (category: MaintenanceTaskCategory, task: TaskDefinition) => {
    setWorkingTaskId(task.id);
    try {
      const maxSequence = rows.reduce((max, row) => Math.max(max, Number(row.sequence_order || 0)), 0);
      const nextSequence = maxSequence + 1;
      const { data, error } = await db.addMaintenanceTaskLogRow(orderPackageId, task.id, nextSequence, category);
      if (error || !data) {
        console.log('➡️ MaintenanceTaskFlowSection: failed adding row', error);
        Alert.alert('Error', 'Could not add task to category');
        return;
      }

      const insertedRow: TaskLogRow = {
        id: (data as any).id,
        order_package_id: orderPackageId,
        task_id: task.id,
        sequence_order: nextSequence,
        start_time: null,
        end_time: null,
        duration_minutes: null,
        task_status: 'pending',
        category,
        tasks: { name: task.name, description: task.description || undefined },
      };

      setRows((prev) =>
        [...prev, insertedRow].sort((first, second) => Number(first.sequence_order || 0) - Number(second.sequence_order || 0))
      );
      setTaskMediaCount((prev) => ({ ...prev, [insertedRow.id]: 0 }));
      setTaskMediaByTaskId((prev) => ({ ...prev, [insertedRow.id]: [] }));
      setAssignmentMap((prev) => ({ ...prev, [insertedRow.id]: [] }));
      setAddPickerCategory(null);
    } finally {
      setWorkingTaskId(null);
    }
  };

  const getAssignedPackerNames = (taskLogId: string) => {
    const ids = effectiveAssignmentMap[taskLogId] || [];
    if (ids.length === 0) return [];
    const lookup = new Map(teamPackers.map((packer) => [packer.id, packer.full_name || packer.username || 'Packer']));
    return ids.map((id) => lookup.get(id) || 'Packer');
  };

  const toggleTaskPacker = async (taskLogId: string, packerId: string) => {
    const current = assignmentMap[taskLogId] || effectiveAssignmentMap[taskLogId] || [];
    const next = current.includes(packerId)
      ? current.filter((id) => id !== packerId)
      : [...current, packerId];

    setAssignmentMap((prev) => {
      const copy = { ...prev };
      if (next.length > 0) copy[taskLogId] = next;
      else delete copy[taskLogId];
      return copy;
    });
    const { error } = await db.setMaintenanceTaskAssignments(taskLogId as any, next as any);
    if (error) {
      console.log('➡️ MaintenanceTaskFlowSection: failed updating assignments', error);
      Alert.alert('Error', 'Could not update task packer assignments');
      setAssignmentMap((prev) => ({ ...prev, [taskLogId]: current }));
      return;
    }
  };

  return (
    <View className="mx-4 mt-4 mb-4">
      <CollapsibleCard
        title="Maintenance Task Flow"
        containerClassName="bg-white border-gray-500"
        defaultOpen
      >
        {loading ? (
          <Text className="text-gray-500 px-3 py-2">Loading maintenance tasks...</Text>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const categoryRows = grouped[category];
            return (
              <View key={category} className="mb-4 border border-gray-200 rounded-lg p-3 bg-gray-50">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-gray-900">{CATEGORY_LABEL[category]}</Text>
                  {!readOnly && (
                    <TouchableOpacity
                      onPress={() => setAddPickerCategory((current) => (current === category ? null : category))}
                      className="px-3 py-2 rounded border border-blue-200 bg-blue-50"
                    >
                      <View className="flex-row items-center">
                        <Plus size={14} color="#1d4ed8" />
                        <Text className="text-xs text-blue-700 font-semibold ml-1">Add Task</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {addPickerCategory === category && !readOnly && (
                  <ScrollView className="max-h-36 mb-2 border border-gray-200 rounded bg-white">
                    {allTasks.map((task) => (
                      <TouchableOpacity
                        key={`${category}-${task.id}`}
                        onPress={() => addTaskToCategory(category, task)}
                        className="px-3 py-2 border-b border-gray-100"
                      >
                        <Text className="text-sm font-medium text-gray-900">{task.name}</Text>
                        {!!task.description && <Text className="text-xs text-gray-600 mt-0.5">{task.description}</Text>}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {categoryRows.length === 0 ? (
                  <Text className="text-gray-500 text-sm">No tasks yet</Text>
                ) : (
                  categoryRows
                    .slice()
                    .sort((first, second) => Number(first.sequence_order || 0) - Number(second.sequence_order || 0))
                    .map((row) => {
                      const relation = asTaskRelation(row.tasks);
                      const taskName = relation?.name || `Task #${row.sequence_order}`;
                      const taskDescription = relation?.description || FALLBACK_TASK_COPY[taskName] || '';
                      const unlocked = canUnlockTask(row);
                      const mediaCount = taskMediaCount[row.id] || 0;
                      const mediaItems = taskMediaByTaskId[row.id] || [];
                      const isBusy = workingTaskId === row.id;
                      const assignedNames = getAssignedPackerNames(row.id);
                      const assignedCount = (effectiveAssignmentMap[row.id] || []).length;
                      const hasExplicitAssignment = (assignmentMap[row.id] || []).length > 0;
                      const pickerSelection = assignmentMap[row.id] || effectiveAssignmentMap[row.id] || [];

                      return (
                        <View key={row.id} className="border border-gray-300 rounded-lg p-3 mb-2 bg-white">
                          <View className="flex-row items-start justify-between">
                            <View className="flex-1 pr-2">
                              <Text className="text-sm font-semibold text-gray-900">{row.sequence_order}. {taskName}</Text>
                              {!!taskDescription && <Text className="text-xs text-gray-700 mt-1">{taskDescription}</Text>}
                              <Text className="text-[11px] text-gray-500 mt-1">Status: {row.task_status} • Photos: {mediaCount}</Text>
                              <Text className="text-[11px] text-gray-500 mt-1">
                                Packers: {assignedNames.length > 0 ? assignedNames.join(', ') : 'None assigned'}
                              </Text>
                            </View>
                            <View className={`px-2 py-1 rounded ${row.task_status === 'completed' ? 'bg-green-100' : row.task_status === 'skipped' ? 'bg-yellow-100' : row.task_status === 'in_progress' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                              <Text className="text-[10px] font-semibold text-gray-700">{row.task_status}</Text>
                            </View>
                          </View>

                          <View className="flex-row mt-3 gap-2 flex-wrap">
                            {!readOnly && (
                              <TouchableOpacity
                                onPress={() => setAssignmentPickerTaskId((current) => (current === row.id ? null : row.id))}
                                className="px-3 py-2 rounded border border-indigo-300 bg-indigo-50"
                              >
                                <Text className="text-xs font-semibold text-indigo-700">
                                  {assignedCount > 0 ? `${hasExplicitAssignment ? 'Assigned' : 'Inherited'} (${assignedCount})` : 'Assign Packers'}
                                </Text>
                              </TouchableOpacity>
                            )}

                            {!readOnly && (
                              <TouchableOpacity
                                disabled={isBusy || !unlocked || row.task_status !== 'pending' || assignedCount === 0}
                                onPress={() => updateTaskStatus(row, 'in_progress')}
                                className={`px-3 py-2 rounded ${isBusy || !unlocked || row.task_status !== 'pending' || assignedCount === 0 ? 'bg-gray-200' : 'bg-blue-500'}`}
                              >
                                <Text className={`text-xs font-semibold ${isBusy || !unlocked || row.task_status !== 'pending' || assignedCount === 0 ? 'text-gray-500' : 'text-white'}`}>Start</Text>
                              </TouchableOpacity>
                            )}

                            {!readOnly && (
                              <TouchableOpacity
                                disabled={isBusy || !unlocked || (row.task_status !== 'in_progress' && row.task_status !== 'pending')}
                                onPress={() => pickAndUploadPhoto(row)}
                                className={`px-3 py-2 rounded border ${isBusy || !unlocked || (row.task_status !== 'in_progress' && row.task_status !== 'pending') ? 'bg-gray-100 border-gray-300' : 'bg-green-50 border-green-300'}`}
                              >
                                <View className="flex-row items-center">
                                  <Camera size={14} color={isBusy || !unlocked || (row.task_status !== 'in_progress' && row.task_status !== 'pending') ? '#9ca3af' : '#166534'} />
                                  <Text className={`text-xs font-semibold ml-1 ${isBusy || !unlocked || (row.task_status !== 'in_progress' && row.task_status !== 'pending') ? 'text-gray-500' : 'text-green-700'}`}>Camera</Text>
                                </View>
                              </TouchableOpacity>
                            )}

                            {!readOnly && (
                              <TouchableOpacity
                                disabled={isBusy || !unlocked || (row.task_status !== 'in_progress' && row.task_status !== 'pending')}
                                onPress={() => updateTaskStatus(row, 'skipped')}
                                className={`px-3 py-2 rounded ${isBusy || !unlocked || (row.task_status !== 'in_progress' && row.task_status !== 'pending') ? 'bg-gray-200' : 'bg-rose-200'}`}
                              >
                                <Text className={`text-xs font-semibold ${isBusy || !unlocked || (row.task_status !== 'in_progress' && row.task_status !== 'pending') ? 'text-gray-500' : 'text-rose-900'}`}>Skip</Text>
                              </TouchableOpacity>
                            )}

                            {!readOnly && (
                              <TouchableOpacity
                                disabled={isBusy || !unlocked || row.task_status !== 'in_progress'}
                                onPress={() => handleComplete(row)}
                                className={`px-3 py-2 rounded ${isBusy || !unlocked || row.task_status !== 'in_progress' ? 'bg-gray-200' : 'bg-lime-400'}`}
                              >
                                <Text className={`text-xs font-semibold ${isBusy || !unlocked || row.task_status !== 'in_progress' ? 'text-gray-500' : 'text-lime-900'}`}>Complete</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {assignmentPickerTaskId === row.id && !readOnly && (
                            <View className="mt-2 border border-indigo-200 rounded bg-indigo-50 p-2">
                              <Text className="text-xs font-semibold text-indigo-800 mb-2">Assign Packers</Text>
                              <View className="flex-row flex-wrap gap-2">
                                {teamPackers.map((packer) => {
                                  const selected = pickerSelection.includes(packer.id);
                                  return (
                                    <TouchableOpacity
                                      key={`${row.id}-${packer.id}`}
                                      onPress={() => toggleTaskPacker(row.id, packer.id)}
                                      className={`px-3 py-2 rounded border ${selected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-indigo-200'}`}
                                    >
                                      <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-indigo-700'}`}>
                                        {packer.full_name || packer.username || 'Packer'}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          )}

                          {mediaItems.length > 0 && (
                            <ScrollView horizontal className="mt-2" showsHorizontalScrollIndicator={false}>
                              <View className="flex-row">
                                {mediaItems.map((media: any) => (
                                  <View key={media.id} className="mr-2">
                                    <Image
                                      source={{ uri: media.signedUrl || media.image_url }}
                                      style={{ width: 76, height: 76, borderRadius: 8, backgroundColor: '#e5e7eb' }}
                                      resizeMode="cover"
                                    />
                                  </View>
                                ))}
                              </View>
                            </ScrollView>
                          )}
                        </View>
                      );
                    })
                )}

                {category === 'repack' && (
                  <View className="mt-2 border border-indigo-200 rounded-lg bg-indigo-50 p-3">
                    <Text className="text-sm font-semibold text-indigo-900 mb-2">Repack Material Chips</Text>
                    <Text className="text-xs text-indigo-700 mb-2">
                      SEI Category: {(seiCategoryId && seiCategories[seiCategoryId]) ? `${seiCategories[seiCategoryId].code ?? ''} ${seiCategories[seiCategoryId].name}`.trim() : '—'} • SEI Protection: {(seiProtectionId && seiProtections[seiProtectionId]) ? `${seiProtections[seiProtectionId].code} - ${seiProtections[seiProtectionId].name}` : '—'} • Package Type: {maintenancePackageType || '—'}
                    </Text>

                    <View className="flex-row flex-wrap gap-2 mb-3">
                      {availableRepackChips.map((chip) => {
                        const active = !!repackChips[chip];
                        return (
                          <TouchableOpacity
                            key={chip}
                            onPress={() => setRepackChips((previous) => ({ ...previous, [chip]: !previous[chip] }))}
                            className={`px-3 py-2 rounded border ${active ? 'bg-blue-600 border-blue-600' : 'bg-white border-blue-200'}`}
                          >
                            <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-blue-700'}`}>{chipLabel(chip)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {repackChips.vacuum && (
                      <VacuumPackingSection orderPackageId={orderPackageId} editable={!readOnly} />
                    )}

                    {repackChips.gas && (
                      <GasPackingSection orderPackageId={orderPackageId} editable={!readOnly} />
                    )}

                    {repackChips.defensor && (
                      <OrderPackageMaterialsSection
                        orderPackageId={orderPackageId}
                        title="Defensor"
                        materialType="Defensor"
                        variantSources={[{ type: 'material', value: 'Defensor' }]}
                        quantityLabel="Qty"
                        mediaDesignation="maint_repack"
                        editable={!readOnly}
                        addPendingConfig={{ autoTag: 'Defensor', materialType: 'Defensor' }}
                      />
                    )}

                    {repackChips.heatshrink && (
                      <OrderPackageMaterialsSection
                        orderPackageId={orderPackageId}
                        title="Heatshrink"
                        materialType="Heatshrink"
                        variantSources={[{ type: 'material', value: 'Heatshrink' }]}
                        quantityLabel="Qty"
                        mediaDesignation="maint_repack"
                        editable={!readOnly}
                        addPendingConfig={{ autoTag: 'Heatshrink', materialType: 'Heatshrink' }}
                      />
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </CollapsibleCard>
    </View>
  );
};

export default MaintenanceTaskFlowSection;
