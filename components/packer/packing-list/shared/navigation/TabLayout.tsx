import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useTextSize } from '../../../../../utils/TextSizeContext';

export interface TabDefinition {
  key: string;
  title: string;
  content: React.ReactNode;
  isPacked?: boolean; // Box completed (blue)
  isStarted?: boolean; // Box has tasks started (green)
}

interface TabLayoutProps {
  tabs: TabDefinition[];
  activeKey: string;
  onChange: (key: string) => void;
}

const TabLayout: React.FC<TabLayoutProps> = ({ tabs, activeKey, onChange }) => {
  const { size } = useTextSize();
  const tabFontSize = size === 'small' ? 13 : size === 'large' ? 16 : size === 'xl' ? 18 : size === 'xxl' ? 21 : 14;
  const tabPaddingH = size === 'xxl' ? 20 : size === 'xl' ? 18 : 16;
  const tabPaddingV = size === 'xxl' ? 12 : size === 'xl' ? 10 : 8;

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
              style={{ 
                paddingHorizontal: tabPaddingH, 
                paddingVertical: tabPaddingV,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                borderWidth: 1
              }}
              className={`${
                tab.isPacked
                  ? activeKey === tab.key
                    ? 'bg-blue-100 border-blue-500'
                    : 'bg-blue-50 border-blue-300'
                  : tab.isStarted
                  ? activeKey === tab.key
                    ? 'bg-green-100 border-green-500'
                    : 'bg-green-50 border-green-300'
                  : activeKey === tab.key
                  ? 'bg-white border-primary-500'
                  : 'bg-gray-100 border-gray-300'
              }`}
            >
              <Text
                style={{ fontSize: tabFontSize }}
                className={`${
                  tab.isPacked
                    ? activeKey === tab.key ? 'text-blue-800' : 'text-blue-700'
                    : tab.isStarted
                    ? activeKey === tab.key ? 'text-green-800' : 'text-green-700'
                    : activeKey === tab.key ? 'text-primary-700' : 'text-gray-700'
                } font-semibold`}
              >
                {tab.title}{tab.isPacked ? ' ✓' : ''}
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

