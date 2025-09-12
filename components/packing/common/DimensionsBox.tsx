import React, { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';

export interface DimensionsTriple {
  length: number | null;
  width: number | null;
  height: number | null;
}

const fmt = (v: number | null | undefined) => (v === 0 || v ? String(v) : '—');

const TripleRowReadOnly: React.FC<{ title: string; dims: DimensionsTriple | null | undefined }>
  = ({ title, dims }) => (
  <View className="bg-white border border-gray-200 rounded-lg px-2 py-2 mb-2 items-center justify-center">
    <Text className="text-[10px] text-amber-900 mb-1 bg-amber-100 text-center w-full">{title}</Text>
    <View className="flex-row items-center justify-between" style={{ width: '75%' }}>
      <View className="items-center">
        <Text className="text-[10px] text-gray-500">Length</Text>
        <Text className="text-gray-900 text-sm font-semibold text-center">{fmt(dims?.length)}</Text>
      </View>
      <View className="items-center">
        <Text className="text-[10px] text-gray-500">Width</Text>
        <Text className="text-gray-900 text-sm font-semibold text-center">{fmt(dims?.width)}</Text>
      </View>
      <View className="items-center">
        <Text className="text-[10px] text-gray-500">Height</Text>
        <Text className="text-gray-900 text-sm font-semibold text-center">{fmt(dims?.height)}</Text>
      </View>
    </View>
  </View>
);

const TripleRowEditable: React.FC<{
  title: string;
  initial: DimensionsTriple | null | undefined;
  onSave: (dims: DimensionsTriple) => Promise<void>;
}> = ({ title, initial, onSave }) => {
  const [vals, setVals] = useState<DimensionsTriple>({
    length: initial?.length ?? null,
    width: initial?.width ?? null,
    height: initial?.height ?? null,
  });

  const toNumberOrNull = (s: string) => {
    const t = s.trim();
    if (t.length === 0) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const saveAll = async () => {
    try {
      await onSave(vals);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save dimensions');
    }
  };

  return (
    <View className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 mb-2 items-center justify-center">
      <Text className="text-[10px] text-green-900 mb-1 bg-green-100 text-center w-full"> {title}</Text>
      <View className="flex-row items-end justify-center" style={{ width: '75%' }}>
        <View className="items-center">
          <Text className="text-[10px] text-gray-500">Length</Text>
          <TextInput
            className="border border-gray-300 bg-white rounded px-2 py-1 text-center"
            defaultValue={vals.length !== null ? String(vals.length) : ''}
            onChangeText={(t) => setVals(v => ({ ...v, length: toNumberOrNull(t) }))}
            onEndEditing={saveAll}
            keyboardType="numeric"
            style={{ width: 70 }}
          />
        </View>
        <View className="items-center">
          <Text className="text-[10px] text-gray-500">Width</Text>
          <TextInput
            className="border border-gray-300 bg-white rounded px-2 py-1 text-center"
            defaultValue={vals.width !== null ? String(vals.width) : ''}
            onChangeText={(t) => setVals(v => ({ ...v, width: toNumberOrNull(t) }))}
            onEndEditing={saveAll}
            keyboardType="numeric"
            style={{ width: 70 }}
          />
        </View>
        <View className="items-center">
          <Text className="text-[10px] text-gray-500">Height</Text>
          <TextInput
            className="border border-gray-300 bg-white rounded px-2 py-1 text-center"
            defaultValue={vals.height !== null ? String(vals.height) : ''}
            onChangeText={(t) => setVals(v => ({ ...v, height: toNumberOrNull(t) }))}
            onEndEditing={saveAll}
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
  onSaveFinal: (dims: DimensionsTriple) => Promise<void>;
}

const DimensionsBox: React.FC<DimensionsBoxProps> = ({ heading, original, final, onSaveFinal }) => {
  return (
    <View className="bg-blue-50 rounded-xl border border-gray-200 p-3 m-1" style={{ minHeight: 120, minWidth: 260 }}>
      <View className="px-3 py-1 rounded-full self-center mb-2">
        <Text className="text-blue-800 text-xs font-semibold text-center">{heading}</Text>
      </View>
      <TripleRowReadOnly title="Original" dims={original || null} />
      <TripleRowEditable title="Final" initial={final || null} onSave={onSaveFinal} />
    </View>
  );
};

export default DimensionsBox;

