import React from 'react';
import { View, Text } from 'react-native';

const formatValue = (v: any) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

export interface TwoTierInfoCardProps {
  label: string;
  original: any;
  final: any;
  width?: number | string;
  flex?: number;
  minHeight?: number;
}

const TwoTierInfoCard: React.FC<TwoTierInfoCardProps> = ({ label, original, final, width, flex, minHeight = 100 }) => {
  return (
    <View
      className="bg-blue-50 rounded-xl border border-gray-200 p-1 m-1 pb-2"
      style={{ minHeight, width: width as any, flex }}
    >
      <View className="px-3 rounded-full self-start mb-2">
        <Text className="text-blue-800 text-xs font-semibold">{label}</Text>
      </View>
      <View className="bg-white border border-gray-200 rounded-lg px-2 py-1 mb-2">
        <Text className="text-[10px] text-gray-500">Original</Text>
        <Text className="text-gray-900 text-sm font-semibold" numberOfLines={2}>{formatValue(original)}</Text>
      </View>
      <View className="bg-white border border-gray-200 rounded-lg px-2 py-1">
        <Text className="text-[10px] text-gray-500">Final</Text>
        <Text className="text-gray-900 text-sm font-semibold" numberOfLines={2}>{formatValue(final)}</Text>
      </View>
    </View>
  );
};

export default TwoTierInfoCard;
