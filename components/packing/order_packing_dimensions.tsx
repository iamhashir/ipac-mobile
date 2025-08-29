import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { db } from '../../utils/api/supabase';

export interface DimensionsTriple {
  length: number | null;
  width: number | null;
  height: number | null;
}

export interface OrderPackingDimensionsProps {
  orderPackageId: string;
  originalInfoId: string | null;
  finalInfoId: string | null;
  internal: {
    original: DimensionsTriple | null | undefined;
    final: DimensionsTriple | null | undefined;
  };
  external: {
    original: DimensionsTriple | null | undefined;
    final: DimensionsTriple | null | undefined;
  };
}

const fmt = (v: number | null | undefined) => (v === 0 || v ? String(v) : '—');

const TripleRowReadOnly: React.FC<{ title: string; dims: DimensionsTriple | null | undefined }>
  = ({ title, dims }) => (
  <View className="bg-white border border-gray-200 rounded-lg px-2 py-2 mb-2">
    <Text className="text-[10px] text-green-900 mb-1 bg-green-100">{title}</Text>
    <View className="flex-row justify-between">
      <View className="mr-2">
        <Text className="text-[10px] text-gray-500">Length</Text>
        <Text className="text-gray-900 text-sm font-semibold">{fmt(dims?.length)}</Text>
      </View>
      <View className="mr-2">
        <Text className="text-[10px] text-gray-500">Width</Text>
        <Text className="text-gray-900 text-sm font-semibold">{fmt(dims?.width)}</Text>
      </View>
      <View>
        <Text className="text-[10px] text-gray-500">Height</Text>
        <Text className="text-gray-900 text-sm font-semibold">{fmt(dims?.height)}</Text>
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
    <View className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 mb-2">
      <Text className="text-[10px] text-amber-900 mb-1 bg-amber-100"> {title}</Text>
      <View className="flex-row justify-between items-end">
        <View className="mr-2">
          <Text className="text-[10px] text-gray-500">Length</Text>
          <TextInput
            className="border border-gray-300 bg-white rounded px-2 py-1 min-w-[70px]"
            defaultValue={vals.length !== null ? String(vals.length) : ''}
            onChangeText={(t) => setVals(v => ({ ...v, length: toNumberOrNull(t) }))}
            onEndEditing={saveAll}
            keyboardType="numeric"
          />
        </View>
        <View className="mr-2">
          <Text className="text-[10px] text-gray-500">Width</Text>
          <TextInput
            className="border border-gray-300 bg-white rounded px-2 py-1 min-w-[70px]"
            defaultValue={vals.width !== null ? String(vals.width) : ''}
            onChangeText={(t) => setVals(v => ({ ...v, width: toNumberOrNull(t) }))}
            onEndEditing={saveAll}
            keyboardType="numeric"
          />
        </View>
        <View>
          <Text className="text-[10px] text-gray-500">Height</Text>
          <TextInput
            className="border border-gray-300 bg-white rounded px-2 py-1 min-w-[70px]"
            defaultValue={vals.height !== null ? String(vals.height) : ''}
            onChangeText={(t) => setVals(v => ({ ...v, height: toNumberOrNull(t) }))}
            onEndEditing={saveAll}
            keyboardType="numeric"
          />
        </View>
      </View>
    </View>
  );
};

const DimBox: React.FC<{
  heading: string;
  original: DimensionsTriple | null | undefined;
  final: DimensionsTriple | null | undefined;
  saveScope: 'internal' | 'external';
  orderPackageId: string;
  originalInfoId: string | null;
  finalInfoId: string | null;
}>
  = ({ heading, original, final, saveScope, orderPackageId, originalInfoId, finalInfoId }) => {
  const handleSave = async (d: DimensionsTriple) => {
    await db.upsertFinalDimensions({
      orderPackageId,
      finalInfoId,
      originalInfoId,
      scope: saveScope,
      length: d.length,
      width: d.width,
      height: d.height,
    });
  };

  return (
    <View className="bg-blue-50 rounded-xl border border-gray-200 p-3 m-1" style={{ minHeight: 120, minWidth: 260 }}>
      <View className="px-3 py-1 rounded-full self-start mb-2">
        <Text className="text-blue-800 text-xs font-semibold">{heading}</Text>
      </View>
      <TripleRowReadOnly title="Original" dims={original || null} />
      <TripleRowEditable title="Final" initial={final || null} onSave={handleSave} />
    </View>
  );
};

const OrderPackingDimensions: React.FC<OrderPackingDimensionsProps> = ({ orderPackageId, originalInfoId, finalInfoId, internal, external }) => {
  return (
    <View className="flex-row flex-wrap">
      <DimBox heading="Internal Dimensions" original={internal?.original} final={internal?.final} saveScope="internal" orderPackageId={orderPackageId} originalInfoId={originalInfoId} finalInfoId={finalInfoId} />
      <DimBox heading="External Dimensions" original={external?.original} final={external?.final} saveScope="external" orderPackageId={orderPackageId} originalInfoId={originalInfoId} finalInfoId={finalInfoId} />
    </View>
  );
};

export default OrderPackingDimensions;
