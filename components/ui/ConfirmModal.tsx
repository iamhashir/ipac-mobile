import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmModal({
  visible,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  const confirmBg = variant === 'danger' ? 'bg-red-600' : 'bg-blue-600';
  const confirmBgDisabled = variant === 'danger' ? 'bg-red-300' : 'bg-blue-300';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity className="flex-1 bg-black/50 justify-center items-center p-4" activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity className="bg-white rounded-xl w-full max-w-md" activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="p-5 border-b border-gray-200">
            <Text className="text-lg font-bold text-gray-900">{title}</Text>
            {description ? (
              <Text className="text-gray-600 mt-2">{description}</Text>
            ) : null}
          </View>

          {children ? (
            <View className="px-5 py-3 border-b border-gray-200 max-h-64">
              <ScrollView>{children}</ScrollView>
            </View>
          ) : null}

          <View className="flex-row p-4 space-x-3 justify-end">
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              className={`px-4 py-2 rounded-lg ${loading ? 'bg-gray-200' : 'bg-gray-100'}`}
            >
              <Text className="text-gray-700 font-medium">{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded-lg ${loading ? confirmBgDisabled : confirmBg}`}
            >
              <Text className="text-white font-medium">{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
