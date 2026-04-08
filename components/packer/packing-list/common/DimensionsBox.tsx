import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';

export interface DimensionsTriple {
  length: number | null;
  width: number | null;
  height: number | null;
}

const formatNumberMaxTwoDecimals = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded
        .toFixed(2)
        .replace(/\.0+$/, '')
        .replace(/(\.\d*[1-9])0+$/, '$1');
};

const fmt = (v: number | null | undefined) => (v === 0 || v ? formatNumberMaxTwoDecimals(v) : '—');

const TripleRowReadOnly: React.FC<{ title: string; dims: DimensionsTriple | null | undefined }>
  = ({ title, dims }) => (
  <View className="bg-white border border-indigo-200 rounded-lg px-2 py-2 mb-2 items-center justify-center">
    <Text className={`text-[10px] mb-1 text-center w-full ${title === 'Final' ? 'text-green-900 bg-green-100' : 'text-amber-900 bg-amber-100'}`}>{title}</Text>
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
  editable?: boolean;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}> = ({ title, value, onChange, editable = true, onInputFocus, onInputBlur }) => {
  const pick = (field: keyof DimensionsTriple): string => {
    const v = value?.[field];
    return v === null || v === undefined ? '' : String(v);
  };
  const toNumberOrNull = (s: string) => {
    const t = s.trim();
    if (t.length === 0) return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  };
  
  const inputClass = `border border-gray-300 rounded py-1 text-center ${!editable ? 'bg-gray-200 text-gray-500' : 'bg-white'}`;
  const titleClass =
    title === 'Final'
      ? 'text-[10px] text-green-900 mb-1 bg-green-100 text-center w-full'
      : 'text-[10px] text-amber-900 mb-1 bg-amber-100 text-center w-full';

  return (
    <View className="bg-gray-50 border border-indigo-200 rounded-lg px-2 py-2 mb-2 items-center justify-center">
      <Text className={titleClass}>{title}</Text>
      <View className="flex-row items-center justify-between" style={{ width: '75%' }}>
        <View className="items-center">
          <Text className="text-[10px] text-gray-500">Length</Text>
          <TextInput
            className={inputClass}
            value={pick('length')}
            onChangeText={(t) => onChange({ length: toNumberOrNull(t) })}
            keyboardType="numeric"
            style={{ width: 70 }}
            editable={editable}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
          />
        </View>
        <View className="items-center">
          <Text className="text-[10px] text-gray-500">Width</Text>
          <TextInput
            className={inputClass}
            value={pick('width')}
            onChangeText={(t) => onChange({ width: toNumberOrNull(t) })}
            keyboardType="numeric"
            style={{ width: 70 }}
            editable={editable}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
          />
        </View>
        <View className="items-center">
          <Text className="text-[10px] text-gray-500">Height</Text>
          <TextInput
            className={inputClass}
            value={pick('height')}
            onChangeText={(t) => onChange({ height: toNumberOrNull(t) })}
            keyboardType="numeric"
            style={{ width: 70 }}
            editable={editable}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
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
  onChangeOriginal?: (patch: Partial<DimensionsTriple>) => void;
  onChangeFinal?: (patch: Partial<DimensionsTriple>) => void;
  editTarget?: 'original' | 'final';
  enableFinalEdit?: boolean;
  editable?: boolean;
}

const DimensionsBox: React.FC<DimensionsBoxProps> = ({
  heading,
  original,
  final,
  onChangeOriginal,
  onChangeFinal,
  editTarget = 'final',
  enableFinalEdit = true,
  editable = true,
}) => {
  const [activeEditTarget, setActiveEditTarget] = useState<'original' | 'final'>(editTarget);
  const [focusedInputCount, setFocusedInputCount] = useState(0);

  useEffect(() => {
    if (focusedInputCount === 0) {
      setActiveEditTarget(editTarget);
    }
  }, [editTarget, focusedInputCount]);

  const handleInputFocus = () => {
    setFocusedInputCount((count) => count + 1);
  };

  const handleInputBlur = () => {
    setFocusedInputCount((count) => Math.max(0, count - 1));
  };

  const canEditOriginal = editable && activeEditTarget === 'original' && !!onChangeOriginal;
  const canEditFinal = editable && activeEditTarget === 'final' && enableFinalEdit && !!onChangeFinal;

  return (
    <View className="bg-blue-50 rounded-xl border border-indigo-200 p-2 m-1 flex-1">
      <View className="px-3 py-1 rounded-full self-center mb-2">
        <Text className="text-blue-800 text-xs font-semibold text-center">{heading}</Text>
      </View>

      {canEditOriginal ? (
        <TripleRowEditable
          title="Original"
          value={original || null}
          onChange={(patch) => onChangeOriginal?.(patch)}
          editable
          onInputFocus={handleInputFocus}
          onInputBlur={handleInputBlur}
        />
      ) : (
        <TripleRowReadOnly title="Original" dims={original || null} />
      )}

      {canEditFinal ? (
        <TripleRowEditable
          title="Final"
          value={final || null}
          onChange={(patch) => onChangeFinal?.(patch)}
          editable
          onInputFocus={handleInputFocus}
          onInputBlur={handleInputBlur}
        />
      ) : (
        <TripleRowReadOnly title="Final" dims={final || null} />
      )}

      {editable && editTarget === 'final' && !enableFinalEdit && (
        <Text className="text-[10px] text-amber-700 px-1 pb-1 text-center">
          Fill original dimensions first to enable final values.
        </Text>
      )}
    </View>
  );
};

export default DimensionsBox;

