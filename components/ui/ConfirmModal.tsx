import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';

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
}: ConfirmModalProps) {
  const confirmBg = variant === 'danger' ? 'bg-red-600' : 'bg-blue-600';
  const confirmBgDisabled = variant === 'danger' ? 'bg-red-300' : 'bg-blue-300';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <View className="bg-white rounded-xl w-full max-w-md">
          <View className="p-5 border-b border-gray-200">
            <Text className="text-lg font-bold text-gray-900">{title}</Text>
            {description ? (
              <Text className="text-gray-600 mt-2">{description}</Text>
            ) : null}
          </View>

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
        </View>
      </View>
    </Modal>
  );
}
