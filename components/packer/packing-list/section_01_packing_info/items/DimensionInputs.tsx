import React, { useRef, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { toFiniteNumberOrNull } from '../../../../../utils/catalogItemHelpers';

interface DimensionInputsProps {
  itemId: string;
  initialLength: number | null;
  initialWidth: number | null;
  initialHeight: number | null;
  onUpdate: (dims: { length: number | null; width: number | null; height: number | null }) => Promise<void>;
}

/**
 * Inline L/W/H editor for an item's master dimensions — focus-chains L→W→H and
 * auto-saves on blur. Extracted from OrderItemsSection to keep that file smaller.
 */
const DimensionInputs: React.FC<DimensionInputsProps> = ({
  initialLength,
  initialWidth,
  initialHeight,
  onUpdate,
}) => {
  const [l, setL] = useState(initialLength ? String(initialLength) : '');
  const [w, setW] = useState(initialWidth ? String(initialWidth) : '');
  const [h, setH] = useState(initialHeight ? String(initialHeight) : '');
  const [saving, setSaving] = useState(false);

  // Focus chaining: L → W → H
  const wInputRef = useRef<TextInput>(null);
  const hInputRef = useRef<TextInput>(null);

  const handleBlur = async () => {
    const nextL = toFiniteNumberOrNull(l);
    const nextW = toFiniteNumberOrNull(w);
    const nextH = toFiniteNumberOrNull(h);

    if (nextL === initialLength && nextW === initialWidth && nextH === initialHeight) return;

    setSaving(true);
    try {
      await onUpdate({ length: nextL, width: nextW, height: nextH });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-row items-center mt-1">
      <View className="flex-row items-center mr-4">
        <Text className="text-[10px] font-bold text-gray-400 mr-1">L</Text>
        <TextInput
          disableFullscreenUI
          className="w-12 text-xs text-slate-800 p-0 border-b border-gray-300 font-medium"
          value={l}
          onChangeText={setL}
          onBlur={handleBlur}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor="#cbd5e1"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => wInputRef.current?.focus()}
        />
      </View>
      <View className="flex-row items-center mr-4">
        <Text className="text-[10px] font-bold text-gray-400 mr-1">W</Text>
        <TextInput
          ref={wInputRef}
          disableFullscreenUI
          className="w-12 text-xs text-slate-800 p-0 border-b border-gray-300 font-medium"
          value={w}
          onChangeText={setW}
          onBlur={handleBlur}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor="#cbd5e1"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => hInputRef.current?.focus()}
        />
      </View>
      <View className="flex-row items-center mr-4">
        <Text className="text-[10px] font-bold text-gray-400 mr-1">H</Text>
        <TextInput
          ref={hInputRef}
          disableFullscreenUI
          className="w-12 text-xs text-slate-800 p-0 border-b border-gray-300 font-medium"
          value={h}
          onChangeText={setH}
          onBlur={handleBlur}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor="#cbd5e1"
          returnKeyType="done"
        />
      </View>
      {saving && <ActivityIndicator size="small" color="#0ea5e9" className="ml-auto" />}
    </View>
  );
};

export default DimensionInputs;
