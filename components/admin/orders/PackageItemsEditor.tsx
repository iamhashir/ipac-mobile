import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { db, supabase } from '../../../utils/api/supabase';

interface PackageItemsEditorProps {
  orderPackageId: string;
  packageNumber: number;
  onClose: () => void;
}

interface ItemRow { id?: string; designation: string | null; quantity: number | null; }

const PackageItemsEditor: React.FC<PackageItemsEditorProps> = ({ orderPackageId, packageNumber, onClose }) => {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [designation, setDesignation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await db.getPackageItemsByOrderPackageIds([orderPackageId]);
      if (error) throw error;
      const rows = (data || []).filter((r: any) => r.order_package_id === orderPackageId).map((r: any) => ({ designation: r.designation, quantity: r.quantity }));
      setItems(rows);
    } catch (e) {
      console.error('Failed to load items', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [orderPackageId]);

  const addItem = async () => {
    const des = designation.trim();
    const qty = quantity.trim() === '' ? null : Number(quantity);
    if (!des || !qty || qty <= 0) { Alert.alert('Please enter designation and quantity'); return; }
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('package_items')
        .insert({ order_package_id: orderPackageId, designation: des, quantity: qty })
        .select('order_package_id')
        .single();
      if (error) throw error;
      setDesignation('');
      setQuantity('');
      await load();
    } catch (e) {
      console.error('Failed to add item', e);
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const close = () => { setVisible(false); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableOpacity className="flex-1 bg-black/50 justify-center items-center p-4" activeOpacity={1} onPress={close}>
        <TouchableOpacity className="bg-white rounded-xl w-full max-w-2xl max-h-[80%]" activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-gray-200">
            <Text className="text-lg font-bold text-gray-900">Items for Box #{packageNumber}</Text>
            <TouchableOpacity onPress={close} className="p-2">
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView className="p-5">
            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-700 mb-1">Item designation</Text>
              <TextInput value={designation} onChangeText={setDesignation} placeholder="e.g., Motor assembly" className="border border-gray-300 rounded-lg px-3 py-2" />
            </View>
            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-700 mb-1">Quantity</Text>
              <TextInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="0" className="border border-gray-300 rounded-lg px-3 py-2" />
            </View>
            <TouchableOpacity disabled={saving} onPress={addItem} className={`px-3 py-2 rounded-lg ${saving ? 'bg-gray-300' : 'bg-green-600'}`}>
              <View className="flex-row items-center justify-center">
                <Plus size={16} color="#fff" />
                <Text className="text-white font-medium ml-2">{saving ? 'Adding...' : 'Add Item'}</Text>
              </View>
            </TouchableOpacity>

            <View className="mt-5">
              <Text className="text-sm font-semibold text-gray-800 mb-2">Current items</Text>
              {loading ? (
                <Text className="text-gray-600">Loading...</Text>
              ) : items.length === 0 ? (
                <Text className="text-gray-600">No items yet</Text>
              ) : (
                <View className="space-y-2">
                  {items.map((it, idx) => (
                    <View key={`${it.designation || 'it'}-${idx}`} className="flex-row items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                      <Text className="text-gray-800">{it.quantity ?? '—'} × {it.designation || '—'}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="p-5 border-t border-gray-200">
            <TouchableOpacity onPress={close} className="w-full bg-gray-100 py-3 rounded-lg">
              <Text className="text-center text-gray-800 font-medium">Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default PackageItemsEditor;
