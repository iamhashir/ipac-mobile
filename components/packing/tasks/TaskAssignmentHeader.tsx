import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface TaskAssignmentHeaderProps {
  availableCount: number;
  busyCount: number;
  onBreakPress?: () => void;
  onAvailablePress?: () => void;
  onBusyPress?: () => void;
}

const TaskAssignmentHeader: React.FC<TaskAssignmentHeaderProps> = ({ availableCount, busyCount, onBreakPress, onAvailablePress, onBusyPress }) => {
  return (
    <View className="mx-4 mt-4 mb-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-800">Task Assignment</Text>
        <View className="flex-row items-center">
          <TouchableOpacity onPress={onAvailablePress} className="flex-row items-center mr-3 bg-green-50 border border-green-600 px-2 py-1 rounded-full">
            <Text className="text-green-700 font-medium text-xs">{availableCount} available</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBusyPress} className="flex-row items-center mr-3 bg-amber-50 border border-amber-600 px-2 py-1 rounded-full">
            <Text className="text-amber-700 font-medium text-xs">{busyCount} busy</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-blue-50 border border-blue-600 px-3 py-1 rounded-md" onPress={onBreakPress}>
            <Text className="text-blue-700">Break</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default TaskAssignmentHeader;
