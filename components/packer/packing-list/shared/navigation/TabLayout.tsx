import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useTextSize } from '../../../../../utils/TextSizeContext';

export interface TabDefinition {
  key: string;
  title: string;
  content: React.ReactNode;
  isPacked?: boolean; // Box completed (sky)
  isStarted?: boolean; // Box has tasks started (lime)
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
                    ? 'bg-sky-300 border-sky-700'
                    : 'bg-sky-200 border-sky-600'
                  : tab.isStarted
                  ? activeKey === tab.key
                    ? 'bg-lime-300 border-lime-700'
                    : 'bg-lime-200 border-lime-600'
                  : activeKey === tab.key
                  ? 'bg-white border-sky-500'
                  : 'bg-sky-50 border-sky-300'
              }`}
            >
              <Text
                style={{ fontSize: tabFontSize }}
                className={`${
                  tab.isPacked
                    ? activeKey === tab.key ? 'text-sky-900' : 'text-sky-900'
                    : tab.isStarted
                    ? activeKey === tab.key ? 'text-green-900' : 'text-green-900'
                    : activeKey === tab.key ? 'text-sky-900' : 'text-sky-900'
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

