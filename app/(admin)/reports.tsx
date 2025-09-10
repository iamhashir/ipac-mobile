import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReportsPage() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-6 py-4">
        <Text className="text-2xl font-bold text-gray-900 mb-4">Reports & Analytics</Text>
        <View className="bg-white rounded-lg shadow-sm p-4">
          <Text className="text-lg font-semibold text-gray-900 mb-2">Sales Overview</Text>
          <Text className="text-gray-500 mb-4">Charts placeholder. Integrate analytics later.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
