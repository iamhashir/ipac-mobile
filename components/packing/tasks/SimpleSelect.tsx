import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';

interface Item { label: string; value: string; labelShort?: string; tooltip?: string; }

interface SimpleSelectProps {
  label?: string;
  items: Item[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  widthPercent?: number; // 0..1
  disabled?: boolean;
}

const SimpleSelect: React.FC<SimpleSelectProps> = ({ label, items, value, onChange, placeholder = 'Select...', widthPercent = 0.75, disabled = false }) => {
  const [open, setOpen] = useState(false);

  const selected = items.find(i => i.value === value);
  const selectedText = selected ? (selected.labelShort || selected.label) : placeholder;
  const tooltip = selected?.tooltip || (selected ? selected.label : undefined);

  return (
    <View style={{ width: `${Math.round(widthPercent * 100)}%` }}>
      {label ? <Text className="text-gray-600 mb-1">{label}</Text> : null}
      <TouchableOpacity
        className={`border border-gray-300 rounded-md px-3 py-2 ${disabled ? 'bg-gray-100 opacity-70' : 'bg-white'}`}
        onPress={() => { if (!disabled) setOpen(true); }}
        activeOpacity={disabled ? 1 : 0.8}
        {...({ title: tooltip } as any)}
        accessibilityLabel={tooltip}
        disabled={disabled}
      >
        <Text className="text-gray-800">{selectedText}</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/30">
          <View className="bg-white rounded-t-2xl p-4 max-h-[60%]">
            <Text className="text-gray-800 font-semibold mb-2">{label || 'Select'}</Text>
            <FlatList
              data={items}
              keyExtractor={(it) => it.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="px-3 py-3 border-b border-gray-100"
                  onPress={() => { onChange(item.value); setOpen(false); }}
                >
                  <Text className="text-gray-800">{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setOpen(false)} className="mt-3 self-end">
              <Text className="text-primary-700 font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SimpleSelect;
