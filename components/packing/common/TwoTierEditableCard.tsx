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
  const initialSelect = finalSelectValue ?? defaultSelectValue ?? null;
  const [val, setVal] = useState<any>(type === 'select' ? initialSelect : (final ?? null));

  useEffect(() => {
    if (type === 'select') {
      const next = finalSelectValue ?? defaultSelectValue ?? null;
      setVal(next);
    }
  }, [finalSelectValue, defaultSelectValue, type]);

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
      <View className="px-3 rounded-full self-start mb-2">
        <Text className="text-blue-800 text-xs font-semibold">{label}</Text>
      </View>
      <View className="bg-white border border-gray-200 rounded-lg px-2 py-1 mb-2">
        <Text className="text-[10px] text-amber-900 bg-amber-100"> Original</Text>
        <Text className="text-gray-900 text-sm font-semibold" numberOfLines={2}>{formatValue(original)}</Text>
      </View>
      <View className="bg-gray-50 border border-gray-200 rounded-lg px-2 pt-1 pb-1">
        <Text className="text-[10px] text-green-900 mb-1 bg-green-100"> Final</Text>
        {type === 'select' ? (
          <SimpleSelect label={''} items={selectItems || []} value={val} onChange={async (v) => { setVal(v); await onChange(v); }} placeholder="Select" />
        ) : type === 'switch' ? (
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-700 text-sm">{val ? 'Yes' : 'No'}</Text>
            <Switch value={!!val} onValueChange={async (v) => { setVal(v); await onChange(v); }} />
          </View>
        ) : (
          <TextInput
            className="border border-gray-200 bg-white rounded px-2 py-1"
            defaultValue={final !== null && final !== undefined ? String(final) : ''}
            onChangeText={(t) => setVal(t)}
            onEndEditing={commit}
            keyboardType={type === 'number' ? 'numeric' : 'default'}
          />
        )}
      </View>
    </View>
  );
};

export default TwoTierEditableCard;
