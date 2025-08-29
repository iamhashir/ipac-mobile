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
        <Text className="text-lg font-semibold text-gray-800">Task Assignment Section</Text>
        <View className="flex-row items-center">
          <Text className="text-gray-700 mr-4">{availableCount} packers available</Text>
          <Text className="text-gray-700 mr-4">{busyCount} packers busy</Text>
          <TouchableOpacity className="bg-primary-600 px-3 py-1 rounded" onPress={onBreakPress}>
            <Text className="text-white">Break</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default TaskAssignmentHeader;
