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
  editTarget?: 'original' | 'final';
  editable?: boolean;
}

const formatValue = (v: any) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

const TwoTierEditableCard: React.FC<TwoTierEditableCardProps> = ({ label, original, final, type, onChange, selectItems, width, flex, finalSelectValue, defaultSelectValue, compact = false, editTarget = 'final', editable = true }) => {
  const isEditingOriginal = editTarget === 'original';
  // Determine initial value/select based on which tier is editable
  const initialSelect = (isEditingOriginal ? (defaultSelectValue ?? null) : (finalSelectValue ?? null));
  const initialVal = isEditingOriginal ? (original ?? null) : (final ?? null);
  const [val, setVal] = useState<any>(type === 'select' ? initialSelect : initialVal);

  // Keep internal state in sync when props change or when switching tabs
  useEffect(() => {
    if (type === 'select') {
      const next = (editTarget === 'original') ? (defaultSelectValue ?? null) : (finalSelectValue ?? null);
      setVal(next);
    } else {
      const next = (editTarget === 'original') ? (original ?? null) : (final ?? null);
      setVal(next);
    }
  }, [original, final, finalSelectValue, defaultSelectValue, type, editTarget]);

  const commit = async () => {
    if (!editable) return;
    if (type === 'number') {
      const n = val === null || val === '' ? null : Number(val);
      await onChange(Number.isFinite(n as number) ? n : null);
    } else {
      await onChange(val);
    }
  };

  // Debounce commit for text/number to support auto-save without explicit blur
  useEffect(() => {
    if (!editable) return;
    if (type === 'number' || type === 'text') {
      const t = setTimeout(() => { void commit(); }, 600);
      return () => clearTimeout(t);
    }
  }, [val, type, editable]);

  return (
    <View className={`${compact ? 'bg-blue-50 rounded-lg' : 'bg-blue-50 rounded-xl'} border border-indigo-200 ${compact ? 'p-1 m-0.5' : 'p-1 m-1'}`} style={{ width: width as any, flex: flex }}>
      <View className={`${compact ? 'mb-0.5' : 'mb-1'} px-2 rounded-full self-center`}>
        <Text className={`text-blue-800 ${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-center`}>{label}</Text>
      </View>

      {/* Original row */}
      <View className={`border border-indigo-200 rounded-lg ${compact ? 'px-1 py-0.5 mb-0.5' : 'px-1 py-1 mb-1'} items-center justify-center ${isEditingOriginal ? (type === 'switch' ? (val ? 'bg-green-50' : 'bg-amber-50') : 'bg-gray-50') : 'bg-white'}`}>
        <Text className="text-[10px] text-amber-900 bg-amber-100 text-center w-full"> Original</Text>
        {isEditingOriginal && editable ? (
          type === 'select' ? (
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
                value={val === null || val === undefined ? '' : String(val)}
                onChangeText={(t) => setVal(t)}
                onEndEditing={commit}
                onBlur={commit}
                onSubmitEditing={commit}
                keyboardType={type === 'number' ? 'numeric' : 'default'}
                style={{ width: '100%', textAlign: 'center' }}
              />
            </View>
          )
        ) : (
          <Text className={`text-gray-900 ${compact ? 'text-xs' : 'text-sm'} font-semibold text-center w-full`} numberOfLines={2}>{formatValue(original)}</Text>
        )}
      </View>

      {/* Final row */}
      <View className={`border border-indigo-200 rounded-lg ${compact ? 'px-1 pt-0.5 pb-0.5' : 'px-1 pt-1 pb-1'} items-center justify-center ${!isEditingOriginal ? (type === 'switch' ? (val ? 'bg-green-50' : 'bg-amber-50') : 'bg-gray-50') : 'bg-white'}`}>
        <Text className="text-[10px] text-green-900 mb-1 bg-green-100 text-center w-full"> Final</Text>
        {!isEditingOriginal && editable ? (
          type === 'select' ? (
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
                value={val === null || val === undefined ? '' : String(val)}
                onChangeText={(t) => setVal(t)}
                onEndEditing={commit}
                onBlur={commit}
                onSubmitEditing={commit}
                keyboardType={type === 'number' ? 'numeric' : 'default'}
                style={{ width: '100%', textAlign: 'center' }}
              />
            </View>
          )
        ) : (
          <Text className={`text-gray-900 ${compact ? 'text-xs' : 'text-sm'} font-semibold text-center w-full`} numberOfLines={2}>{formatValue(final)}</Text>
        )}
      </View>
    </View>
  );
};

export default TwoTierEditableCard;
