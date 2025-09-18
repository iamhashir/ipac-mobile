import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import SimpleSelect from '../tasks/SimpleSelect';

export type EditableType = 'text' | 'number' | 'switch' | 'select';

interface TwoTierEditableCardProps {
  label: string;
  original: any;
  final: any;
  type: EditableType;
  onChange: (val: any) => Promise<void> | void;
  selectItems?: { label: string; value: string; labelShort?: string; tooltip?: string }[];
  width?: number | string;
  flex?: number;
  finalSelectValue?: string | null;
  defaultSelectValue?: string | null;
  compact?: boolean;
}

const formatValue = (v: any) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

const TwoTierEditableCard: React.FC<TwoTierEditableCardProps> = ({ label, original, final, type, onChange, selectItems, width, flex, finalSelectValue, defaultSelectValue, compact = false }) => {
  // Final field should start empty; do not prefill from the original/default
  const initialSelect = finalSelectValue ?? null;
  const [val, setVal] = useState<any>(type === 'select' ? initialSelect : (final ?? null));

  useEffect(() => {
    if (type === 'select') {
      const next = finalSelectValue ?? null;
      setVal(next);
    }
  }, [finalSelectValue, type]);

  const commit = async () => {
    if (type === 'number') {
      const n = val === null || val === '' ? null : Number(val);
      await onChange(Number.isFinite(n as number) ? n : null);
    } else {
      await onChange(val);
    }
  };

  return (
    <View className={`${compact ? 'bg-blue-50 rounded-lg' : 'bg-blue-50 rounded-xl'} border border-gray-200 ${compact ? 'p-1 m-0.5' : 'p-1 m-1'}`} style={{ width: width as any, flex: flex }}>
      <View className={`${compact ? 'mb-0.5' : 'mb-1'} px-2 rounded-full self-center`}>
        <Text className={`text-blue-800 ${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-center`}>{label}</Text>
      </View>
      <View className={`bg-white border border-gray-200 rounded-lg ${compact ? 'px-1 py-0.5 mb-0.5' : 'px-1 py-1 mb-1'} items-center justify-center`}>
        <Text className="text-[10px] text-amber-900 bg-amber-100 text-center w-full"> Original</Text>
        <Text className={`text-gray-900 ${compact ? 'text-xs' : 'text-sm'} font-semibold text-center w-full`} numberOfLines={2}>{formatValue(original)}</Text>
      </View>
      {/* Final row: backgrounds are semantic; switch uses full-width pressable area */}
      <View className={`${type === 'switch' ? (val ? 'bg-green-50' : 'bg-amber-50') : 'bg-gray-50'} border border-gray-200 rounded-lg ${compact ? 'px-1 pt-0.5 pb-0.5' : 'px-1 pt-1 pb-1'} items-center justify-center`}>
        <Text className="text-[10px] text-green-900 mb-1 bg-green-100 text-center w-full"> Final</Text>
        {type === 'select' ? (
          <View style={{ width: compact ? '90%' : '85%' }}>
            <SimpleSelect label={''} items={selectItems || []} value={val} onChange={async (v) => { setVal(v); await onChange(v); }} placeholder="Select" widthPercent={1} centerText={true} />
          </View>
        ) : type === 'switch' ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={async () => { const next = !val; setVal(next); await onChange(next); }}
            className={`rounded ${compact ? 'w-[90%]' : 'w-[85%]'} py-2`}
          >
            <Text className={`text-gray-700 ${compact ? 'text-xs' : 'text-sm'} text-center`}>{val ? 'Yes' : 'No'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: compact ? '90%' : '85%' }}>
            <TextInput
              className="border border-gray-200 bg-white rounded px-1 py-1 text-center"
              defaultValue={final !== null && final !== undefined ? String(final) : ''}
              onChangeText={(t) => setVal(t)}
              onEndEditing={commit}
              keyboardType={type === 'number' ? 'numeric' : 'default'}
              style={{ width: '100%', textAlign: 'center' }}
            />
          </View>
        )}
      </View>
    </View>
  );
};

export default TwoTierEditableCard;
