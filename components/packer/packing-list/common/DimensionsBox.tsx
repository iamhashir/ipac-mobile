import React, { useEffect, useRef, useState } from 'react';
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

const DIM_FIELDS: (keyof DimensionsTriple)[] = ['length', 'width', 'height'];

const toNumberOrNull = (s: string) => {
  const t = s.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const TripleRowEditable: React.FC<{
  title: string;
  value: DimensionsTriple | null | undefined;
  onChange: (patch: Partial<DimensionsTriple>) => void;
  editable?: boolean;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}> = ({ title, value, onChange, editable = true, onInputFocus, onInputBlur }) => {
  // Local string drafts so typing isn't round-tripped through the parent on
  // every keystroke (which collapsed "1." to "1" and lost fast keystrokes).
  const fromProps = () => ({
    length: value?.length === null || value?.length === undefined ? '' : String(value.length),
    width: value?.width === null || value?.width === undefined ? '' : String(value.width),
    height: value?.height === null || value?.height === undefined ? '' : String(value.height),
  });
  const [draft, setDraft] = useState<Record<keyof DimensionsTriple, string>>(fromProps);
  const focusedFieldRef = useRef<keyof DimensionsTriple | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Partial<DimensionsTriple> | null>(null);

  // Sync drafts from props only while the user isn't typing in this row
  useEffect(() => {
    if (focusedFieldRef.current || pendingPatchRef.current) return;
    setDraft(fromProps());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.length, value?.width, value?.height]);

  const flushCommit = () => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    const pending = pendingPatchRef.current;
    pendingPatchRef.current = null;
    if (pending && Object.keys(pending).length > 0) onChange(pending);
  };

  const scheduleCommit = (field: keyof DimensionsTriple, text: string) => {
    pendingPatchRef.current = { ...pendingPatchRef.current, [field]: toNumberOrNull(text) };
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(flushCommit, 600);
  };

  // Commit anything still pending if the row unmounts mid-typing.
  // Read through a ref so the unmount cleanup uses the latest onChange closure.
  const flushCommitRef = useRef(flushCommit);
  useEffect(() => {
    flushCommitRef.current = flushCommit;
  });
  useEffect(() => {
    return () => flushCommitRef.current();
  }, []);

  // Refs for Length → Width → Height focus chaining
  const inputRefs = {
    length: useRef<TextInput>(null),
    width: useRef<TextInput>(null),
    height: useRef<TextInput>(null),
  };

  const inputClass = `border border-gray-300 rounded py-1 text-center ${!editable ? 'bg-gray-200 text-gray-500' : 'bg-white'}`;
  const titleClass =
    title === 'Final'
      ? 'text-[10px] text-green-900 mb-1 bg-green-100 text-center w-full'
      : 'text-[10px] text-amber-900 mb-1 bg-amber-100 text-center w-full';
  const fieldLabel: Record<keyof DimensionsTriple, string> = {
    length: 'Length',
    width: 'Width',
    height: 'Height',
  };

  return (
    <View className="bg-gray-50 border border-indigo-200 rounded-lg px-2 py-2 mb-2 items-center justify-center">
      <Text className={titleClass}>{title}</Text>
      <View className="flex-row items-center justify-between" style={{ width: '75%' }}>
        {DIM_FIELDS.map((field, idx) => {
          const nextField = DIM_FIELDS[idx + 1];
          return (
            <View className="items-center" key={field}>
              <Text className="text-[10px] text-gray-500">{fieldLabel[field]}</Text>
              <TextInput
                ref={inputRefs[field]}
                className={inputClass}
                value={draft[field]}
                onChangeText={(t) => {
                  setDraft((d) => ({ ...d, [field]: t }));
                  scheduleCommit(field, t);
                }}
                keyboardType="numeric"
                style={{ width: 70 }}
                editable={editable}
                returnKeyType={nextField ? 'next' : 'done'}
                blurOnSubmit={!nextField}
                onSubmitEditing={() => {
                  if (nextField) inputRefs[nextField].current?.focus();
                }}
                onFocus={() => {
                  focusedFieldRef.current = field;
                  onInputFocus?.();
                }}
                onBlur={() => {
                  if (focusedFieldRef.current === field) focusedFieldRef.current = null;
                  flushCommit();
                  onInputBlur?.();
                }}
              />
            </View>
          );
        })}
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

