import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Keyboard } from 'react-native';
import SimpleSelect from '../section_04_tasks/subcomponents/SimpleSelect';

export type EditableType = 'text' | 'number' | 'switch' | 'select';

interface TwoTierEditableCardProps {
  label: string;
  original: any;
  final: any;
  type: EditableType;
  onChange: (val: any, tier?: 'original' | 'final') => Promise<void> | void;
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
  /** Ref attached to the editable TextInput, for cross-card focus chaining */
  inputRef?: React.RefObject<TextInput | null>;
  /** When set, the keyboard shows "next" and submit focuses this input */
  nextInputRef?: React.RefObject<TextInput | null>;
}

const formatValue = (v: any) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number' && Number.isFinite(v)) {
    const rounded = Math.round(v * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }
  return String(v);
};

const TwoTierEditableCard: React.FC<TwoTierEditableCardProps> = ({ label, original, final, type, onChange, selectItems, width, flex, finalSelectValue, defaultSelectValue, compact = false, editTarget = 'final', editable = true, draftValue, commitDebounceMs = 600, highlightChanges = false, inputRef, nextInputRef }) => {
  const [activeEditTarget, setActiveEditTarget] = useState<'original' | 'final'>(editTarget);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isEditingOriginal = activeEditTarget === 'original';
  // Determine initial value based on which tier is editable, overridden by draftValue if provided
  const initialSelect = isEditingOriginal ? (defaultSelectValue ?? null) : (finalSelectValue ?? null);
  const baseVal = isEditingOriginal ? (original ?? null) : (final ?? null);
  const initial = draftValue !== undefined ? draftValue : (type === 'select' ? initialSelect : baseVal);
  const [val, setVal] = useState<any>(initial);
  const [touched, setTouched] = useState(false); // only true after user input within this component

  // Keep prop-driven tier updates, but avoid switching the active tier while user is typing.
  useEffect(() => {
    if (!isInputFocused) {
      setActiveEditTarget(editTarget);
    }
  }, [editTarget, isInputFocused]);

  // Pending debounced commit for text/number typing
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommitRef = useRef<{ val: any; tier: 'original' | 'final' } | null>(null);

  // Keep internal state in sync when props or draft change, but don't commit on programmatic sync.
  // Never clobber the value while the user is typing or a commit is still pending —
  // the save→refetch echo arriving mid-typing is what turned "100" into "10".
  useEffect(() => {
    if (isInputFocused || pendingCommitRef.current) return;
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
  }, [original, final, finalSelectValue, defaultSelectValue, type, editTarget, draftValue, isEditingOriginal, isInputFocused]);

  // Propagate a value to the parent. For numbers, parse into number|null.
  const stageImmediate = async (nextVal: any, tier: 'original' | 'final') => {
    if (!editable) return;
    if (type === 'number') {
      const n = nextVal === null || nextVal === '' ? null : Number(nextVal);
      const rounded = Number.isFinite(n as number) ? Math.round((n as number) * 100) / 100 : null;
      await onChange(rounded, tier);
    } else {
      await onChange(nextVal, tier);
    }
  };

  // Debounced commit while typing: one save per pause instead of one per keystroke
  const scheduleCommit = (nextVal: any, tier: 'original' | 'final') => {
    pendingCommitRef.current = { val: nextVal, tier };
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      const pending = pendingCommitRef.current;
      pendingCommitRef.current = null;
      if (pending) stageImmediate(pending.val, pending.tier);
    }, commitDebounceMs);
  };

  const flushCommit = () => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    const pending = pendingCommitRef.current;
    pendingCommitRef.current = null;
    if (pending) stageImmediate(pending.val, pending.tier);
  };

  // Commit any in-flight value if the component unmounts mid-typing.
  // The flush is read through a ref so the unmount cleanup calls the LATEST
  // closure (latest onChange/state), not the one captured on first render.
  const flushCommitRef = useRef(flushCommit);
  useEffect(() => {
    flushCommitRef.current = flushCommit;
  });
  useEffect(() => {
    return () => flushCommitRef.current();
  }, []);

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
              <SimpleSelect label={''} items={selectItems || []} value={val} onChange={async (v) => { setVal(v); setTouched(true); await onChange(v, 'original'); }} placeholder="Select" widthPercent={1} centerText={true} />
            </View>
          ) : type === 'switch' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={async () => { const next = !val; setVal(next); setTouched(true); await onChange(next, 'original'); }}
              className={`rounded ${compact ? 'w-[90%]' : 'w-[85%]'} py-2`}
            >
              <Text className={`text-gray-700 ${compact ? 'text-xs' : 'text-sm'} text-center`}>{val ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: compact ? '90%' : '85%' }}>
              <TextInput
                className="border border-gray-200 bg-white rounded px-1 py-1 text-center"
                ref={inputRef}
                value={val === null || val === undefined ? '' : String(val)}
                onChangeText={(t) => { setVal(t); setTouched(true); scheduleCommit(t, 'original'); }}
                keyboardType={type === 'number' ? 'numeric' : 'default'}
                style={{ width: '100%', textAlign: 'center' }}
                returnKeyType={nextInputRef ? 'next' : 'done'}
                blurOnSubmit={!nextInputRef}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => { setIsInputFocused(false); flushCommit(); }}
                onSubmitEditing={() => { if (nextInputRef) nextInputRef.current?.focus(); else Keyboard.dismiss(); }}
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
              <SimpleSelect label={''} items={selectItems || []} value={val} onChange={async (v) => { setVal(v); setTouched(true); await onChange(v, 'final'); }} placeholder="Select" widthPercent={1} centerText={true} />
            </View>
          ) : type === 'switch' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={async () => { const next = !val; setVal(next); setTouched(true); await onChange(next, 'final'); }}
              className={`rounded ${compact ? 'w-[90%]' : 'w-[85%]'} py-2`}
            >
              <Text className={`text-gray-700 ${compact ? 'text-xs' : 'text-sm'} text-center`}>{val ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: compact ? '90%' : '85%' }}>
              <TextInput
                className="border border-gray-200 bg-white rounded px-1 py-1 text-center"
                ref={inputRef}
                value={val === null || val === undefined ? '' : String(val)}
                onChangeText={(t) => { setVal(t); setTouched(true); scheduleCommit(t, 'final'); }}
                keyboardType={type === 'number' ? 'numeric' : 'default'}
                style={{ width: '100%', textAlign: 'center' }}
                returnKeyType={nextInputRef ? 'next' : 'done'}
                blurOnSubmit={!nextInputRef}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => { setIsInputFocused(false); flushCommit(); }}
                onSubmitEditing={() => { if (nextInputRef) nextInputRef.current?.focus(); else Keyboard.dismiss(); }}
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
