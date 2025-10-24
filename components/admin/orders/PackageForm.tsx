import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { X, Save } from 'lucide-react-native';
import { supabase, db } from '../../../utils/api/supabase';
import PackageInfoFields, { PackageInfoValue } from './PackageInfoFields';

interface PackageFormProps {
  orderId: string;
  nextPackageNumber: number;
  onCancel: () => void;
  onCreated: () => void;
}

const PackageForm: React.FC<PackageFormProps> = ({ orderId, nextPackageNumber, onCancel, onCreated }) => {
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [info, setInfo] = useState<PackageInfoValue>({
    quantity: null,
    center_of_gravity: false,
    tare: null,
    net_weight: null,
    gross_weight: null,
    internal_length: null,
    internal_width: null,
    internal_height: null,
    external_length: null,
    external_width: null,
    external_height: null,
    box_type_id: null,
    packing_type_id: null,
  });

  const close = () => { setVisible(false); onCancel(); };

  const handleCreate = async () => {
    // Basic validation: require at least quantity and some dimensions
    if (!info.quantity || info.quantity <= 0) {
      Alert.alert('Validation', 'Please provide quantity of boxes');
      return;
    }

    setSaving(true);
    try {
      // 1) Insert original package_info
      const pkgPayload: any = {
        center_of_gravity: !!info.center_of_gravity,
        quantity: info.quantity ?? null,
        box_type_id: info.box_type_id || null,
        packing_type_id: info.packing_type_id || null,
        tare: info.tare ?? null,
        net_weight: info.net_weight ?? null,
        gross_weight: info.gross_weight ?? ((info.tare || 0) + (info.net_weight || 0)),
        internal_length: info.internal_length ?? null,
        internal_width: info.internal_width ?? null,
        internal_height: info.internal_height ?? null,
        external_length: info.external_length ?? null,
        external_width: info.external_width ?? null,
        external_height: info.external_height ?? null,
      };

      const { data: pkgInfo, error: pkgErr } = await supabase
        .from('package_info')
        .insert(pkgPayload)
        .select('id')
        .single();
      if (pkgErr || !pkgInfo) throw pkgErr || new Error('Failed to create package info');

      // 2) Insert order_packages
      const orderPkgPayload: any = {
        order_id: orderId,
        package_number: nextPackageNumber,
        description: description.trim() || null,
        status: 'approved',
        original_pkg_info: pkgInfo.id,
      };
      const { data: orderPkg, error: orderPkgErr } = await supabase
        .from('order_packages')
        .insert(orderPkgPayload)
        .select('id')
        .single();
      if (orderPkgErr || !orderPkg) throw orderPkgErr || new Error('Failed to create order package');

      // 3) Ensure empty final package info exists and is linked
      await db.ensureFinalPackageInfo({ orderPackageId: orderPkg.id, finalInfoId: null, originalInfoId: pkgInfo.id });

      Alert.alert('Success', `Box #${nextPackageNumber} created`);
      setVisible(false);
      onCreated();
    } catch (e) {
      console.error('Failed to create box', e);
      Alert.alert('Error', 'Failed to create box');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableOpacity className="flex-1 bg-black/50 justify-center items-center p-4" activeOpacity={1} onPress={close}>
        <TouchableOpacity className="bg-white rounded-xl w-full max-w-3xl max-h-[85%]" activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-gray-200">
            <Text className="text-lg font-bold text-gray-900">Add Box (#{nextPackageNumber})</Text>
            <TouchableOpacity onPress={close} className="p-2">
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView className="p-5">
            <View className="mb-4">
              <Text className="text-xs font-medium text-gray-700 mb-1">Description (optional)</Text>
              <TextInput value={description} onChangeText={setDescription} placeholder="Short note for this box" className="border border-gray-300 rounded-lg px-3 py-2" />
            </View>

            <PackageInfoFields value={info} onChange={setInfo} />
          </ScrollView>

          {/* Footer */}
          <View className="flex-row gap-3 p-5 border-t border-gray-200">
            <TouchableOpacity onPress={close} className="flex-1 bg-gray-100 py-3 rounded-lg">
              <Text className="text-gray-800 text-center font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} disabled={saving} className={`flex-1 py-3 rounded-lg ${saving ? 'bg-gray-300' : 'bg-blue-600'}`}>
              <View className="flex-row items-center justify-center">
                <Save size={16} color="#fff" />
                <Text className="text-white text-center font-medium ml-2">{saving ? 'Saving...' : 'Save Box'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default PackageForm;
