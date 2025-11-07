import React from "react";
import { View, Text } from "react-native";

interface ProjectHeaderProps {
  projectName: string;
  projectLeads: string[];
  packers: string[];
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ 
  projectName, 
  projectLeads, 
  packers 
}) => {
  return (
    <View className="p-4 bg-white border-b border-gray-200 rounded-md">
      <View className="flex-row flex-wrap justify-between mb-4">
        <View className="w-full md:w-1/2 mb-4 md:mb-0">
          <Text className="text-gray-500 font-medium text-sm mb-1">Project:</Text>
          <Text className="text-lg font-semibold text-gray-900">{projectName}</Text>
        </View>
        <View className="w-full md:w-1/2">
          <Text className="text-gray-500 font-medium text-sm mb-1">Team Leads:</Text>
          <Text className="text-lg font-semibold text-gray-900">{projectLeads.length > 0 ? projectLeads.join(', ') : '-'}</Text>
        </View>
      </View>
      
      {packers.length > 0 && (
        <View className="w-full">
          <Text className="text-gray-500 font-medium text-sm mb-1">Team Members:</Text>
          <Text className="text-lg text-gray-800">{packers.join(", ")}</Text>
        </View>
      )}
    </View>
  );
};
