import React from 'react';
import { View, Text, TextInput } from 'react-native';

export interface DimensionsTriple {
  length: number | null;
  width: number | null;
  height: number | null;
}

const fmt = (v: number | null | undefined) => (v === 0 || v ? String(v) : '—');

const TripleRowReadOnly: React.FC<{ title: string; dims: DimensionsTriple | null | undefined }>
  = ({ title, dims }) => (
  <View className="bg-white border border-indigo-200 rounded-lg px-2 py-2 mb-2 items-center justify-center">
    <Text className="text-[10px] text-amber-900 mb-1 bg-amber-100 text-center w-full">{title}</Text>
    <View className="flex-row items-center justify-between" style={{ width: '75%' }}>
      <View className="items-center" style={{ width: 70 }}>
        <Text className="text-[10px] text-gray-500">Length</Text>
        <Text className="text-gray-900 text-sm font-semibold text-center">{fmt(dims?.length)}</Text>
      </View>
      <View className="items-center" style={{ width: 70 }}>
        <Text className="text-[10px] text-gray-500">Width</Text>
        <Text className="text-gray-900 text-sm font-semibold text-center">{fmt(dims?.width)}</Text>
      </View>
      <View className="items-center" style={{ width: 70 }}>
        <Text className="text-[10px] text-gray-500">Height</Text>
        <Text className="text-gray-900 text-sm font-semibold text-center">{fmt(dims?.height)}</Text>
      </View>
    </View>
  </View>
);

const TripleRowEditable: React.FC<{
  title: string;
  value: DimensionsTriple | null | undefined;
  onChange: (patch: Partial<DimensionsTriple>) => void;
}> = ({ title, value, onChange }) => {
  const pick = (field: keyof DimensionsTriple): string => {
    const v = value?.[field];
    return v === null || v === undefined ? '' : String(v);
  };
  const toNumberOrNull = (s: string) => {
    const t = s.trim();
    if (t.length === 0) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  return (
    <View className="bg-gray-50 border border-indigo-200 rounded-lg px-2 py-2 mb-2 items-center justify-center">
      <Text className="text-[10px] text-green-900 mb-1 bg-green-100 text-center w-full"> {title}</Text>
      <View className="flex-row items-center justify-between" style={{ width: '75%' }}>
        <View className="items-center">
          <Text className="text-[10px] text-gray-500">Length</Text>
          <TextInput
            className="border border-gray-300 bg-white rounded py-1 text-center"
            value={pick('length')}
            onChangeText={(t) => onChange({ length: toNumberOrNull(t) })}
            keyboardType="numeric"
            style={{ width: 70 }}
          />
        </View>
        <View className="items-center">
          <Text className="text-[10px] text-gray-500">Width</Text>
          <TextInput
            className="border border-gray-300 bg-white rounded py-1 text-center"
            value={pick('width')}
            onChangeText={(t) => onChange({ width: toNumberOrNull(t) })}
            keyboardType="numeric"
            style={{ width: 70 }}
          />
        </View>
        <View className="items-center">
          <Text className="text-[10px] text-gray-500">Height</Text>
          <TextInput
            className="border border-gray-300 bg-white rounded py-1 text-center"
            value={pick('height')}
            onChangeText={(t) => onChange({ height: toNumberOrNull(t) })}
            keyboardType="numeric"
            style={{ width: 70 }}
          />
        </View>
      </View>
    </View>
  );
};

export interface DimensionsBoxProps {
  heading: string;
  original: DimensionsTriple | null | undefined;
  final: DimensionsTriple | null | undefined;
  onChangeFinal: (patch: Partial<DimensionsTriple>) => void;
}

const DimensionsBox: React.FC<DimensionsBoxProps> = ({ heading, original, final, onChangeFinal }) => {
  return (
    <View className="bg-blue-50 rounded-xl border border-indigo-200 p-2 m-1 flex-1">
      <View className="px-3 py-1 rounded-full self-center mb-2">
        <Text className="text-blue-800 text-xs font-semibold text-center">{heading}</Text>
      </View>
      <TripleRowReadOnly title="Original" dims={original || null} />
      <TripleRowEditable title="Final" value={final || null} onChange={onChangeFinal} />
    </View>
  );
};

export default DimensionsBox;

