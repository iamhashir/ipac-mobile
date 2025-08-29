import React from 'react';
import { View, Text } from 'react-native';

interface GroupBoxProps {
  title: string;
  children: React.ReactNode;
}

const GroupBox: React.FC<GroupBoxProps> = ({ title, children }) => {
  return (
    <View className="bg-white rounded-xl border border-gray-400 p-3 m-1 w-full">
      <View className="px-3 py-1 rounded-full self-start mb-2">
        <Text className="text-blue-800 text-xs font-semibold">{title}</Text>
      </View>
      {children}
    </View>
  );
};

export default GroupBox;
