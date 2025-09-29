import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export type TabItem = {
  key: string;
  label: string;
  count?: number;
};

export function TopTabs({
  tabs,
  activeKey,
  onChange,
  rightSlot,
}: {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <View className="bg-white rounded-lg border border-gray-200 px-2 py-2 flex-row items-center justify-between">
      <View className="flex-row items-center">
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            className={`px-4 py-2 mr-2 rounded-md ${
              activeKey === t.key ? 'bg-blue-600' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeKey === t.key ? 'text-white' : 'text-gray-700'
              }`}
            >
              {t.label}
              {typeof t.count === 'number' ? <Text className="inline text-xs"> ({t.count})</Text> : null}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {rightSlot ? <View className="ml-2">{rightSlot}</View> : null}
    </View>
  );
}
