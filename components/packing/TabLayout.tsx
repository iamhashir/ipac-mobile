import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';

export interface TabDefinition {
  key: string;
  title: string;
  content: React.ReactNode;
}

interface TabLayoutProps {
  tabs: TabDefinition[];
  activeKey: string;
  onChange: (key: string) => void;
}

const TabLayout: React.FC<TabLayoutProps> = ({ tabs, activeKey, onChange }) => {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mx-4"
      >
        <View className="flex-row">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChange(tab.key)}
              className={`px-4 py-2 rounded-t-lg border ${
                activeKey === tab.key
                  ? 'bg-white border-primary-500'
                  : 'bg-gray-100 border-gray-300'
              }`}
            >
              <Text
                className={`${
                  activeKey === tab.key ? 'text-primary-700' : 'text-gray-700'
                } font-semibold`}
              >
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Active content */}
      <View className="mx-4 mb-4 bg-white rounded-b-lg border border-gray-200">
        {tabs.find((t) => t.key === activeKey)?.content || null}
      </View>
    </View>
  );
};

export default TabLayout;

