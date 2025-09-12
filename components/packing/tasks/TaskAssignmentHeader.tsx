import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface TaskAssignmentHeaderProps {
  availableCount: number;
  busyCount: number;
  onBreakPress?: () => void;
}

const TaskAssignmentHeader: React.FC<TaskAssignmentHeaderProps> = ({ availableCount, busyCount, onBreakPress }) => {
  return (
    <View className="mx-4 mt-4 mb-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-800">Task Assignment</Text>
        <View className="flex-row items-center">
          <View className="flex-row items-center mr-3 bg-green-100 px-2 py-1 rounded-full">
            <Text className="text-green-700 font-medium text-xs">{availableCount} available</Text>
          </View>
          <View className="flex-row items-center mr-3 bg-amber-100 px-2 py-1 rounded-full">
            <Text className="text-amber-700 font-medium text-xs">{busyCount} busy</Text>
          </View>
          <TouchableOpacity className="bg-primary-600 px-3 py-1 rounded-md" onPress={onBreakPress}>
            <Text className="text-white">Break</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default TaskAssignmentHeader;
