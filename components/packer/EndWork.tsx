import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { db } from '../../utils/api/supabase';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ActiveTaskSummary, buildActiveTaskSummaries, formatBoxList, formatPackerList } from '../../utils/tasks/activeTaskSummaries';

interface EndWorkProps {
  orderId: string;
  packerId: string;
  packerName: string;
  shiftPeriod: 'morning' | 'afternoon';
  onUpdate: () => void;
}

export const EndWork: React.FC<EndWorkProps> = ({
  orderId,
  packerId,
  packerName,
  shiftPeriod,
  onUpdate
}) => {
  const [updating, setUpdating] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [preparingSummary, setPreparingSummary] = useState(false);
  const [taskSummary, setTaskSummary] = useState<ActiveTaskSummary[]>([]);

  const loadTaskSummary = async () => {
    const nameLookup = { [packerId]: packerName };
    try {
      const { data, error } = await db.getActiveTasksForPackers(orderId, [packerId]);
      if (error) {
        console.warn('Error loading tasks before ending work:', error);
        setTaskSummary([]);
        return;
      }
      setTaskSummary(buildActiveTaskSummaries(data || [], nameLookup));
    } catch (err) {
      console.error('Unexpected task summary error:', err);
      setTaskSummary([]);
    }
  };

  const finalizeEndWork = async () => {
    const endTime = new Date().toISOString();
    const { error } = await db.updateAttendanceEndTimeByDetails(
      orderId,
      packerId,
      shiftPeriod,
      endTime
    );

    if (error) {
      console.error('Error updating end time:', error);
      Alert.alert('Error', 'Failed to record end time');
      return false;
    }

    Alert.alert('Success', `End time recorded for ${packerName}`);
    onUpdate();
    return true;
  };

  const handleConfirmEndWork = async () => {
    try {
      setUpdating(true);
      const { error } = await db.completeAssignmentsForPackers(orderId, [packerId]);
      if (error) {
        console.error('Error clearing active tasks:', error);
        Alert.alert('Error', 'Failed to close active tasks before ending work');
        return;
      }

      const success = await finalizeEndWork();
      if (success) {
        setConfirmVisible(false);
        setTaskSummary([]);
      }
    } catch (error) {
      console.error('Unexpected error while ending work:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setUpdating(false);
    }
  };

  const handleStartEndWork = async () => {
    try {
      setPreparingSummary(true);
      await loadTaskSummary();
      setConfirmVisible(true);
    } catch (error) {
      console.error('Error preparing end work confirmation:', error);
      Alert.alert('Error', 'Failed to load active tasks');
    } finally {
      setPreparingSummary(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleStartEndWork}
      disabled={updating || preparingSummary}
      className={`py-2 px-4 rounded ${
        updating || preparingSummary ? 'bg-gray-300' : 'bg-red-500'
      }`}
    >
      <Text className={`text-center font-medium ${
        updating || preparingSummary ? 'text-gray-500' : 'text-white'
      }`}>
        {preparingSummary ? 'Checking tasks...' : updating ? 'Updating...' : 'End Work'}
      </Text>

      <ConfirmModal
        visible={confirmVisible}
        title="End Work"
        description={`The following tasks assigned to ${packerName} will be marked completed before recording the end time.`}
        confirmText={updating ? 'Saving...' : 'Confirm'}
        cancelText="Cancel"
        variant="danger"
        loading={updating}
        onCancel={() => {
          if (updating) return;
          setConfirmVisible(false);
          setTaskSummary([]);
        }}
        onConfirm={handleConfirmEndWork}
      >
        {taskSummary.length === 0 ? (
          <Text className="text-gray-700">No active tasks will be updated.</Text>
        ) : (
          taskSummary.map((task, index) => (
            <View key={`${task.task}-${index}`} className="mb-3 p-2 bg-gray-50 rounded">
              <Text className="text-gray-900 font-semibold">{task.task}</Text>
              <Text className="text-gray-700 text-sm mt-1">
                <Text className="font-medium">Packers:</Text> {formatPackerList(task.packerNames)}
              </Text>
              <Text className="text-gray-700 text-sm">
                <Text className="font-medium">Boxes:</Text> {formatBoxList(task.boxes)}
              </Text>
            </View>
          ))
        )}
      </ConfirmModal>
    </TouchableOpacity>
  );
};
