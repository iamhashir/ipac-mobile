import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import SimpleSelect from '../section_04_tasks/subcomponents/SimpleSelect';

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
  draftValue?: any; // optional externally-provided draft value to display (from parent pending state)
  commitDebounceMs?: number; // optional debounce for text/number commit
  highlightChanges?: boolean;
}

const formatValue = (v: any) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

const TwoTierEditableCard: React.FC<TwoTierEditableCardProps> = ({ label, original, final, type, onChange, selectItems, width, flex, finalSelectValue, defaultSelectValue, compact = false, editTarget = 'final', editable = true, draftValue, commitDebounceMs = 600, highlightChanges = false }) => {
  const isEditingOriginal = editTarget === 'original';
  // Determine initial value based on which tier is editable, overridden by draftValue if provided
  const initialSelect = isEditingOriginal ? (defaultSelectValue ?? null) : (finalSelectValue ?? null);
  const baseVal = isEditingOriginal ? (original ?? null) : (final ?? null);
  const initial = draftValue !== undefined ? draftValue : (type === 'select' ? initialSelect : baseVal);
  const [val, setVal] = useState<any>(initial);
  const [touched, setTouched] = useState(false); // only true after user input within this component

  // Keep internal state in sync when props or draft change, but don't commit on programmatic sync
  useEffect(() => {
    let next: any;
    if (draftValue !== undefined) {
      next = draftValue;
    } else if (type === 'select') {
      next = isEditingOriginal ? (defaultSelectValue ?? null) : (finalSelectValue ?? null);
    } else {
      next = isEditingOriginal ? (original ?? null) : (final ?? null);
    }
    setVal(next);
    setTouched(false); // reset touched so programmatic changes don't trigger commits
  }, [original, final, finalSelectValue, defaultSelectValue, type, editTarget, draftValue, isEditingOriginal]);

  // Immediate stage: propagate on each user change so Save always sees latest drafts
  // For numbers, parse into number|null; for text, pass string|null on empty
  const stageImmediate = async (nextVal: any) => {
    if (!editable) return;
    if (type === 'number') {
      const n = nextVal === null || nextVal === '' ? null : Number(nextVal);
      await onChange(Number.isFinite(n as number) ? n : null);
    } else {
      await onChange(nextVal);
    }
  };

  // Check if final value was modified from original
  const hasChanged = !isEditingOriginal && final !== null && final !== undefined && original !== final;
  const showChangeHighlight = highlightChanges && hasChanged;
  const borderColor = showChangeHighlight ? 'border-orange-400' : 'border-indigo-200';
  const headerBgColor = showChangeHighlight ? 'bg-orange-50' : 'bg-blue-50';
  const headerTextColor = showChangeHighlight ? 'text-orange-900' : 'text-blue-800';

  return (
    <View className={`${compact ? headerBgColor + ' rounded-lg' : headerBgColor + ' rounded-xl'} border ${borderColor} ${compact ? 'p-1 m-0.5' : 'p-1 m-1'}`} style={{ width: width as any, flex: flex }}>
      <View className={`${compact ? 'mb-0.5' : 'mb-1'} px-2 rounded-full self-center`}>
  <Text className={`${headerTextColor} ${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-center`}>{label}{showChangeHighlight ? ' *' : ''}</Text>
      </View>

      {/* Original row */}
      <View className={`border border-indigo-200 rounded-lg ${compact ? 'px-1 py-0.5 mb-0.5' : 'px-1 py-1 mb-1'} items-center justify-center ${isEditingOriginal ? (type === 'switch' ? (val ? 'bg-green-50' : 'bg-amber-50') : 'bg-gray-50') : 'bg-white'}`}>
        <Text className="text-[10px] text-amber-900 bg-amber-100 text-center w-full"> Original</Text>
        {isEditingOriginal && editable ? (
          type === 'select' ? (
            <View style={{ width: compact ? '90%' : '85%' }}>
              <SimpleSelect label={''} items={selectItems || []} value={val} onChange={async (v) => { setVal(v); setTouched(true); await onChange(v); }} placeholder="Select" widthPercent={1} centerText={true} />
            </View>
          ) : type === 'switch' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={async () => { const next = !val; setVal(next); setTouched(true); await onChange(next); }}
              className={`rounded ${compact ? 'w-[90%]' : 'w-[85%]'} py-2`}
            >
              <Text className={`text-gray-700 ${compact ? 'text-xs' : 'text-sm'} text-center`}>{val ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: compact ? '90%' : '85%' }}>
              <TextInput
                className="border border-gray-200 bg-white rounded px-1 py-1 text-center"
                value={val === null || val === undefined ? '' : String(val)}
                onChangeText={async (t) => { setVal(t); setTouched(true); await stageImmediate(t); }}
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
      <View className={`border ${showChangeHighlight ? 'border-orange-400' : 'border-indigo-200'} rounded-lg ${compact ? 'px-1 pt-0.5 pb-0.5' : 'px-1 pt-1 pb-1'} items-center justify-center ${!isEditingOriginal ? (type === 'switch' ? (val ? 'bg-green-50' : 'bg-amber-50') : showChangeHighlight ? 'bg-orange-50' : 'bg-gray-50') : 'bg-white'}`}>
        <Text className={`text-[10px] ${showChangeHighlight ? 'text-orange-900 bg-orange-100' : 'text-green-900 bg-green-100'} mb-1 text-center w-full`}> Final{showChangeHighlight ? ' ✓' : ''}</Text>
        {!isEditingOriginal && editable ? (
          type === 'select' ? (
            <View style={{ width: compact ? '90%' : '85%' }}>
              <SimpleSelect label={''} items={selectItems || []} value={val} onChange={async (v) => { setVal(v); setTouched(true); await onChange(v); }} placeholder="Select" widthPercent={1} centerText={true} />
            </View>
          ) : type === 'switch' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={async () => { const next = !val; setVal(next); setTouched(true); await onChange(next); }}
              className={`rounded ${compact ? 'w-[90%]' : 'w-[85%]'} py-2`}
            >
              <Text className={`text-gray-700 ${compact ? 'text-xs' : 'text-sm'} text-center`}>{val ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: compact ? '90%' : '85%' }}>
              <TextInput
                className="border border-gray-200 bg-white rounded px-1 py-1 text-center"
                value={val === null || val === undefined ? '' : String(val)}
                onChangeText={async (t) => { setVal(t); setTouched(true); await stageImmediate(t); }}
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
