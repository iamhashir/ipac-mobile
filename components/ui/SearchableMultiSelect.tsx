import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { ChevronDown, X, Check } from 'lucide-react-native';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableMultiSelectProps {
  options: SelectOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
  maxHeight?: number;
}

export function SearchableMultiSelect({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = 'Select items...',
  label,
  maxHeight = 300,
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter((v) => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectedLabels = useMemo(() => {
    return options
      .filter((opt) => selectedValues.includes(opt.value))
      .map((opt) => opt.label);
  }, [options, selectedValues]);

  const displayText = useMemo(() => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) return selectedLabels[0];
    return `${selectedValues.length} selected`;
  }, [selectedValues, selectedLabels, placeholder]);

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-2">{label}</Text>
      )}

      {/* Trigger Button */}
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        className="flex-row items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg"
        activeOpacity={0.7}
      >
        <Text
          className={`flex-1 ${
            selectedValues.length === 0 ? 'text-gray-500' : 'text-gray-900'
          }`}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <View className="flex-row items-center">
          {selectedValues.length > 0 && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="mr-2 p-1"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color="#6b7280" />
            </TouchableOpacity>
          )}
          <ChevronDown size={20} color="#6b7280" />
        </View>
      </TouchableOpacity>

      {/* Selected Items Display */}
      {selectedValues.length > 0 && (
        <View className="flex-row flex-wrap mt-2">
          {selectedLabels.map((label, index) => (
            <View
              key={index}
              className="bg-blue-100 px-3 py-1 rounded-full mr-2 mb-2 flex-row items-center"
            >
              <Text className="text-xs text-blue-800 mr-1">{label}</Text>
              <TouchableOpacity
                onPress={() => toggleOption(selectedValues[index])}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <X size={12} color="#1e40af" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black bg-opacity-50 justify-center items-center"
          onPress={() => setIsOpen(false)}
        >
          <Pressable
            className="bg-white rounded-lg w-11/12 max-w-md"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="px-4 py-3 border-b border-gray-200 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-gray-900">
                {label || 'Select Items'}
              </Text>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="px-4 py-3 border-b border-gray-200">
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search..."
                className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Options List */}
            <ScrollView style={{ maxHeight: maxHeight }} className="px-2 py-2">
              {filteredOptions.length === 0 ? (
                <View className="p-4">
                  <Text className="text-center text-gray-500">No options found</Text>
                </View>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => toggleOption(option.value)}
                      className={`flex-row items-center px-3 py-3 rounded-lg mb-1 ${
                        isSelected ? 'bg-blue-50' : 'bg-white'
                      }`}
                      activeOpacity={0.7}
                    >
                      <View
                        className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        {isSelected && <Check size={14} color="#ffffff" />}
                      </View>
                      <Text
                        className={`flex-1 ${
                          isSelected ? 'text-blue-900 font-medium' : 'text-gray-900'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Footer */}
            <View className="px-4 py-3 border-t border-gray-200 flex-row items-center justify-between">
              <Text className="text-sm text-gray-600">
                {selectedValues.length} selected
              </Text>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={clearAll}
                  className="bg-gray-100 px-4 py-2 rounded-lg mr-2"
                >
                  <Text className="text-gray-700 font-medium">Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsOpen(false)}
                  className="bg-blue-600 px-4 py-2 rounded-lg"
                >
                  <Text className="text-white font-medium">Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
