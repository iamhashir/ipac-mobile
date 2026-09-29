import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTextSize } from '../../../../../utils/TextSizeContext';

interface Item { label: string; value: string; labelShort?: string; tooltip?: string; }

interface SimpleSelectProps {
  label?: string;
  items: Item[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  widthPercent?: number; // 0..1
  disabled?: boolean;
  centerText?: boolean;
}

const SimpleSelect: React.FC<SimpleSelectProps> = ({ label, items, value, onChange, placeholder = 'Select...', widthPercent = 0.75, disabled = false, centerText = false }) => {
  const { size } = useTextSize();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  
  const textFontSize = size === 'small' ? 13 : size === 'large' ? 16 : size === 'xl' ? 18 : size === 'xxl' ? 21 : 14;
  const labelFontSize = size === 'small' ? 13 : size === 'large' ? 15 : size === 'xl' ? 17 : size === 'xxl' ? 19 : 14;

  const selected = items.find(i => i.value === value);
  const selectedText = selected ? (selected.labelShort || selected.label) : placeholder;
  const tooltip = selected?.tooltip || (selected ? selected.label : undefined);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...items].sort((a, b) => a.label.localeCompare(b.label));
    const withScore = items.map(it => {
      const labelLc = it.label.toLowerCase();
      const idx = labelLc.indexOf(q);
      const starts = labelLc.startsWith(q);
      const score = idx < 0 ? 9999 : idx;
      return { it, score, starts };
    });
    withScore.sort((a, b) => {
      if (a.starts !== b.starts) return a.starts ? -1 : 1;
      if (a.score !== b.score) return a.score - b.score;
      return a.it.label.localeCompare(b.it.label);
    });
    return withScore.filter(x => x.score !== 9999).map(x => x.it);
  }, [items, query]);

  return (
    <View style={{ width: `${Math.round(widthPercent * 100)}%` }}>
      {label ? <Text style={{ fontSize: labelFontSize }} className="text-gray-600 mb-1">{label}</Text> : null}
      <TouchableOpacity
        className={`border border-gray-300 rounded-md px-3 py-2 ${disabled ? 'bg-gray-100 opacity-70' : 'bg-white'}`}
        onPress={() => { if (!disabled) setOpen(true); }}
        activeOpacity={disabled ? 1 : 0.8}
        {...({ title: tooltip } as any)}
        accessibilityLabel={tooltip}
        disabled={disabled}
      >
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: textFontSize }} className={`text-gray-800 ${centerText ? 'text-center' : ''}`}>{selectedText}</Text>
          <ChevronDown size={16} color="#374151" />
        </View>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity className="flex-1 justify-end bg-black/30" activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity className="bg-white rounded-t-2xl p-4 max-h-[70%]" activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <Text style={{ fontSize: textFontSize }} className="text-gray-800 font-semibold mb-2">{label || 'Select'}</Text>
            <View className="mb-2">
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Type to filter..."
                style={{ fontSize: textFontSize }}
                className="border border-gray-300 bg-white rounded px-3 py-2"
                autoFocus
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(it) => it.value}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={15}
              maxToRenderPerBatch={20}
              windowSize={7}
              removeClippedSubviews
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="px-3 py-3 border-b border-gray-100"
                  onPress={() => { onChange(item.value); setOpen(false); setQuery(''); }}
                >
                  <Text style={{ fontSize: textFontSize }} className="text-gray-800">{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => { setOpen(false); setQuery(''); }} className="mt-3 self-end">
              <Text style={{ fontSize: textFontSize }} className="text-primary-700 font-semibold">Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default SimpleSelect;
