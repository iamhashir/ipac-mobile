import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch } from 'react-native';
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
  finalSelectValue?: string | null;
  defaultSelectValue?: string | null;
}

const formatValue = (v: any) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

const TwoTierEditableCard: React.FC<TwoTierEditableCardProps> = ({ label, original, final, type, onChange, selectItems, width, finalSelectValue, defaultSelectValue }) => {
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
    <View className="bg-blue-50 rounded-xl border border-gray-200 p-2 m-1" style={{ width: width as any }}>
      <View className="px-3 rounded-full self-center mb-2">
        <Text className="text-blue-800 text-xs font-semibold text-center">{label}</Text>
      </View>
      <View className="bg-white border border-gray-200 rounded-lg px-2 py-1 mb-2 items-center justify-center">
        <Text className="text-[10px] text-amber-900 bg-amber-100 text-center w-full"> Original</Text>
        <Text className="text-gray-900 text-sm font-semibold text-center w-full" numberOfLines={2}>{formatValue(original)}</Text>
      </View>
      <View className="bg-gray-50 border border-gray-200 rounded-lg px-2 pt-1 pb-1 items-center justify-center">
        <Text className="text-[10px] text-green-900 mb-1 bg-green-100 text-center w-full"> Final</Text>
        {type === 'select' ? (
          <View style={{ width: '75%' }}>
            <SimpleSelect label={''} items={selectItems || []} value={val} onChange={async (v) => { setVal(v); await onChange(v); }} placeholder="Select" widthPercent={1} />
          </View>
        ) : type === 'switch' ? (
          <View className="flex-row items-center justify-between" style={{ width: '75%' }}>
            <Text className="text-gray-700 text-sm">{val ? 'Yes' : 'No'}</Text>
            <Switch value={!!val} onValueChange={async (v) => { setVal(v); await onChange(v); }} />
          </View>
        ) : (
          <View style={{ width: '75%' }}>
            <TextInput
              className="border border-gray-200 bg-white rounded px-2 py-1 text-center"
              defaultValue={final !== null && final !== undefined ? String(final) : ''}
              onChangeText={(t) => setVal(t)}
              onEndEditing={commit}
              keyboardType={type === 'number' ? 'numeric' : 'default'}
              style={{ width: '100%' }}
            />
          </View>
        )}
      </View>
    </View>
  );
};

export default TwoTierEditableCard;
