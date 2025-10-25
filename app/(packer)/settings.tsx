import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationButtons } from '../../components/NavigationButtons';
import { useTextSize, TextSizeOption } from '../../utils/TextSizeContext';

export default function PackerSettings() {
  const { size, setSize } = useTextSize();
  const [saved, setSaved] = useState(false);

  const save = (newSize: TextSizeOption) => {
    setSize(newSize);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const sizeLabel = (s: TextSizeOption) => {
    switch (s) {
      case 'small': return 'Small';
      case 'medium': return 'Medium';
      case 'large': return 'Large';
      case 'xl': return 'XL';
      case 'xxl': return 'XXL';
    }
  };

  const previewTextCls = size === 'small' ? 'text-sm' : size === 'large' ? 'text-lg' : size === 'xl' ? 'text-xl' : size === 'xxl' ? 'text-2xl' : 'text-base';

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top','bottom','left','right']}>
      {/* Header */}
      <View className="bg-primary-500 px-4 py-3">
        <Text className="text-white text-xl font-bold">Settings</Text>
        <Text className="text-primary-100 text-xs mt-1">Personalize your workspace</Text>
      </View>

      {/* Navigation Buttons */}
      <NavigationButtons currentScreen="settings" />

      {/* Content */}
      <View className="flex-1 p-4">
        <View className="bg-white border border-gray-200 rounded-lg p-4">
          <Text className="text-gray-800 text-base font-semibold">Text size</Text>
          <Text className="text-gray-500 text-xs mt-1">Choose how large text should appear in the app</Text>

          <View className="flex-row flex-wrap mt-4 gap-2">
            {(['small','medium','large','xl','xxl'] as TextSizeOption[]).map((opt) => {
              const active = size === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Set text size to ${sizeLabel(opt)}`}
                  onPress={() => save(opt)}
                  className={`px-4 py-2 rounded-lg border ${active ? 'bg-primary-50 border-primary-500' : 'bg-white border-gray-300'}`}
                >
                  <Text className={`${active ? 'text-primary-700' : 'text-gray-800'} font-medium`}>
                    {sizeLabel(opt)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {saved && (
            <Text className="text-green-600 text-xs mt-2">Saved</Text>
          )}

          <View className="mt-6">
            <Text className="text-gray-600 text-xs mb-2">Preview</Text>
            <View className="border border-gray-200 rounded-lg p-3">
              <Text className={`text-gray-800 ${previewTextCls}`}>The quick brown fox jumps over the lazy dog.</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
