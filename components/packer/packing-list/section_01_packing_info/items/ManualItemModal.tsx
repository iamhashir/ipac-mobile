import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { db } from '../../../../../utils/api/supabase';

interface ManualItemModalProps {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  orderPackageId: string;
  orderPkgInstanceId?: string | null;
  /** Called after the item is created + assigned so the parent can refresh its list. */
  onAdded: () => void | Promise<void>;
}

/**
 * Manual ("ad-hoc") item entry — create an item that isn't in the catalog and assign
 * it to this box. Extracted from OrderItemsSection to keep that file maintainable.
 * Owns its own form state; the parent only controls visibility + handles onAdded.
 */
const ManualItemModal: React.FC<ManualItemModalProps> = ({
  visible,
  onClose,
  clientId,
  orderPackageId,
  orderPkgInstanceId,
  onAdded,
}) => {
  const [designation, setDesignation] = useState('');
  const [qty, setQty] = useState('1');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [saving, setSaving] = useState(false);
  // Focus chaining for the dimensions row
  const widthRef = useRef<TextInput>(null);
  const heightRef = useRef<TextInput>(null);

  const handleSave = async () => {
    if (!designation.trim()) {
      Alert.alert('Missing Name', 'Please enter an item name/designation.');
      return;
    }

    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Validation', 'Please enter a quantity greater than 0.');
      return;
    }

    try {
      setSaving(true);
      // 1. Create ad-hoc item in items_db
      const { data: catalogItem, error: catalogError } = await db.createAdHocItem({
        clientId,
        description: designation.trim(),
        quantity,
        length: Number(length) || undefined,
        width: Number(width) || undefined,
        height: Number(height) || undefined,
      });

      if (catalogError || !catalogItem?.id) throw catalogError || new Error('Failed to create item');

      // 2. Assign to package
      const { error: assignError } = await db.assignItemToPackage(
        catalogItem.id,
        orderPackageId,
        Number(qty) || 1,
        orderPkgInstanceId || undefined,
      );

      if (assignError) throw assignError;

      onClose();
      // Reset form
      setDesignation('');
      setQty('1');
      setLength('');
      setWidth('');
      setHeight('');

      await onAdded();
      Alert.alert('Success', 'Item added to box.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add manual item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 20 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}
          style={{ width: '100%' }}
        >
          <View className="bg-white rounded-2xl p-5 shadow-xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-slate-900">Add Manual Item</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="space-y-4">
                <View>
                  <Text className="text-sm font-semibold text-slate-700 mb-1">Item Name / Designation</Text>
                  <TextInput
                    disableFullscreenUI
                    className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-slate-50"
                    placeholder="e.g. Spare Parts Box"
                    value={designation}
                    onChangeText={setDesignation}
                  />
                </View>

                <View className="flex-row space-x-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-slate-700 mb-1">Quantity</Text>
                    <TextInput
                      disableFullscreenUI
                      className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-slate-50"
                      keyboardType="numeric"
                      value={qty}
                      onChangeText={setQty}
                    />
                  </View>
                </View>

                <Text className="text-sm font-bold text-slate-800 mt-2">Dimensions (cm) - Optional</Text>
                <View className="flex-row space-x-2">
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Length</Text>
                    <TextInput
                      disableFullscreenUI
                      className="border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 bg-slate-50"
                      keyboardType="numeric"
                      placeholder="L"
                      value={length}
                      onChangeText={setLength}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => widthRef.current?.focus()}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Width</Text>
                    <TextInput
                      ref={widthRef}
                      disableFullscreenUI
                      className="border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 bg-slate-50"
                      keyboardType="numeric"
                      placeholder="W"
                      value={width}
                      onChangeText={setWidth}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => heightRef.current?.focus()}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Height</Text>
                    <TextInput
                      ref={heightRef}
                      disableFullscreenUI
                      className="border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 bg-slate-50"
                      keyboardType="numeric"
                      placeholder="H"
                      value={height}
                      onChangeText={setHeight}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View className="mt-6 flex-row space-x-3">
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 py-3.5 rounded-xl bg-slate-100 items-center mr-2"
                disabled={saving}
              >
                <Text className="text-slate-600 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                className="flex-1 py-3.5 rounded-xl bg-blue-600 items-center shadow-md shadow-blue-200"
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold">Save Item</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default ManualItemModal;
