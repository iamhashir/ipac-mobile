import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { X } from 'lucide-react-native';
import { db } from '../../../utils/api/supabase';

interface DeletePackageModalProps {
  visible: boolean;
  packageNumber: number | null;
  packageId: string;
  onClose: () => void;
  onDeleted: () => void;
}

const DeletePackageModal: React.FC<DeletePackageModalProps> = ({ visible, packageNumber, packageId, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const { error } = await db.deleteOrderPackage(packageId);
      if (error) throw error;
      Alert.alert('Success', `Box #${packageNumber} deleted`);
      onDeleted();
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete box');
      console.error('Delete error:', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/50 justify-center items-center p-4" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity className="bg-white rounded-xl w-full max-w-md" activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
            <Text className="text-lg font-bold text-gray-900">Delete Box?</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View className="p-6">
            <Text className="text-sm text-gray-700 mb-4">
              Are you sure you want to delete <Text className="font-semibold">Box #{packageNumber}</Text>? This action cannot be undone.
            </Text>
            <Text className="text-xs text-gray-600 font-medium mb-1">The following will be permanently deleted:</Text>
            <Text className="text-xs text-gray-500 leading-5">
              • Package items{"\n"}
              • Package materials (accessories, securing, gas, vacuum){"\n"}
              • Securing templates and beams{"\n"}
              • Task assignments linked to this package{"\n"}
              • Package services{"\n"}
              • Media (images/videos){"\n"}
              • Package info records (original & final)
            </Text>
            <Text className="text-xs text-red-600 mt-2 font-medium">
              Note: audit_log entries will remain for record-keeping.
            </Text>
          </View>

          <View className="flex-row gap-3 p-4 border-t border-gray-200">
            <TouchableOpacity onPress={onClose} className="flex-1 bg-gray-100 py-2.5 rounded-lg" disabled={deleting}>
              <Text className="text-center text-gray-800 font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} className={`flex-1 py-2.5 rounded-lg ${deleting ? 'bg-red-300' : 'bg-red-600'}`} disabled={deleting}>
              <Text className="text-center text-white font-medium">{deleting ? 'Deleting...' : 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default DeletePackageModal;
