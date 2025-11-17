import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import CollapsibleCard from '../common/CollapsibleCard';
import { db } from '../../../../utils/api/supabase';
import { Check, X, ChevronDown, Camera } from 'lucide-react-native';

interface GasMaterialsSectionProps {
  orderPackageId: string;
}

interface Option { label: string; value: string; unit_id?: string | null; unit_name?: string | null }

// Specialized section for Gas variants
const GasMaterialsSection: React.FC<GasMaterialsSectionProps> = ({ orderPackageId }) => {
  const [items, setItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<Option[]>([]);
  const [units, setUnits] = useState<{ label: string; value: string }[]>([]);

  const unitsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (units || []).forEach(u => { m[u.value] = u.label; });
    return m;
  }, [units]);

  // Add modal state
  const [open, setOpen] = useState(false);
  const [varOpen, setVarOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [errors, setErrors] = useState<{ variant?: string; quantity?: string; quantity_used?: string; unit?: string }>({});
  const [saving, setSaving] = useState(false);

  // Form state
  const [formVariant, setFormVariant] = useState<string | null>(null);
  const [formQuantity, setFormQuantity] = useState<string>(''); // cylinders
  const [formQuantityUsed, setFormQuantityUsed] = useState<string>(''); // gas used
  const [formUnit, setFormUnit] = useState<string | null>(null);
  const [formComment, setFormComment] = useState<string>('');

  const variantLabelById = (id: string | null | undefined) => variants.find(v => v.value === id)?.label || '—';

  const load = async () => {
    // Load variants for material "Gas" (exact name, case-insensitive)
    const [{ data: v }, { data: u }, { data: rows }] = await Promise.all([
      db.getMaterialVariantsByMaterialExactName('Gas'),
      db.getAllUnits(),
      db.getOrderPackageMaterials(orderPackageId),
    ] as any);

    const vOpts = (v || []).map((x: any) => ({ label: x.label, value: x.id, unit_id: x.unit_id || null, unit_name: x.unit_name || null }));
    setVariants(vOpts);
    setUnits((u || []).map((x: any) => ({ label: x.name || x.label, value: x.id || x.value })));

  const allowed = new Set(vOpts.map((o: any) => o.value));
    setItems((rows || []).filter((r: any) => r.material_type === 'Gas Packing' && allowed.has(r.material_variant_id)));
  };

  useEffect(() => { setItems([]); setVariants([]); load(); }, [orderPackageId]);

  const resetForm = () => {
    setFormVariant(null);
    setFormQuantity('');
    setFormQuantityUsed('');
    setFormUnit(null);
    setFormComment('');
    setVarOpen(false);
    setUnitOpen(false);
    setErrors({});
    setSaving(false);
  };

  const validate = () => {
    const qtyCyl = formQuantity ? Number(formQuantity) : NaN;
    const qtyUsed = formQuantityUsed ? Number(formQuantityUsed) : NaN;
    const unitId = formUnit || (formVariant ? (variants.find(v => v.value === formVariant)?.unit_id || null) : null);
    const e: any = {};
    if (!formVariant) e.variant = 'Item is required';
    if (!formQuantity || !Number.isFinite(qtyCyl) || qtyCyl <= 0) e.quantity = 'Enter cylinders (> 0)';
    if (!formQuantityUsed || !Number.isFinite(qtyUsed) || qtyUsed <= 0) e.quantity_used = 'Enter gas used (> 0)';
    if (!unitId) e.unit = 'Unit is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveNew = async () => {
    if (!validate()) return;
    const qtyCyl = Number(formQuantity);
    const qtyUsed = Number(formQuantityUsed);
    const unitIdToUse: string = formUnit || (variants.find(v => v.value === formVariant)?.unit_id as any);

    const payload: any = {
      order_package_id: orderPackageId,
      material_variant_id: formVariant,
      material_type: 'Gas Packing',
      is_final: true,
      quantity: qtyCyl,
      quantity_used: qtyUsed,
      unit_id: unitIdToUse,
      comment: formComment || null,
      item_used: false,
    };

    try {
      setSaving(true);
      const { error } = await db.addOrderPackageMaterial(payload);
      if (error) { Alert.alert('Error', error?.message || 'Failed to add gas'); return; }
      setOpen(false);
      resetForm();
      await load();
    } finally { setSaving(false); }
  };

  const markUsed = async (id: string) => { const { error } = await db.updateOrderPackageMaterial(id, { item_used: true }); if (!error) await load(); };
  const removeRow = async (id: string) => {
    Alert.alert('Remove item', 'Delete this row?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { const { error } = await db.deleteOrderPackageMaterial(id); if (!error) await load(); } },
    ]);
  };

  const handleCameraPress = async (row: any) => {
    Alert.alert('Attach image', 'Choose source', [
      { text: 'Gallery', onPress: () => pickFromGallery(row) },
      { text: 'Camera', onPress: () => takePhoto(row) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromGallery = async (row: any) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Media library access is needed.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.8 
    });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri, row);
    }
  };

  const takePhoto = async (row: any) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri, row);
    }
  };

  const uploadAsset = async (uri: string, row: any) => {
    try {
      const gasName = variantLabelById(row.material_variant_id);
      const notes = `Gas Packing - Gas: ${gasName} (Cylinders: ${row.quantity || 0}, Used: ${row.quantity_used || 0})`;
      const { data, error } = await db.uploadMediaToStorage(orderPackageId, uri, 'gas_packing', notes);
      if (error) {
        Alert.alert('Upload failed', 'Could not upload image to storage.');
      } else {
        Alert.alert('Uploaded', 'Image uploaded successfully.');
      }
    } catch (e) {
      Alert.alert('Upload error', 'Unexpected error while uploading.');
    }
  };

  // Layout proportions
  const FLEX = { item: 30, qty: 10, qtyUsed: 15, unit: 10, comment: 25, actions: 20, camera: 4 };

  const HeaderRow = () => (
    <View className="flex-row items-center bg-white/70 border border-gray-300 rounded px-2 py-2">
      <View style={{ flex: FLEX.item }}><Text className="text-xs font-semibold text-gray-700">Item</Text></View>
      <View style={{ flex: FLEX.qty }}><Text className="text-xs font-semibold text-gray-700">Quantity of cylinder</Text></View>
      <View style={{ flex: FLEX.qtyUsed }}><Text className="text-xs font-semibold text-gray-700">Quantity of Gas Used</Text></View>
      <View style={{ flex: FLEX.unit }}><Text className="text-xs font-semibold text-gray-700">Unit</Text></View>
      <View style={{ flex: FLEX.comment }}><Text className="text-xs font-semibold text-gray-700">Comment</Text></View>
      <View style={{ flex: FLEX.actions }}><Text className="text-xs font-semibold text-gray-700">Item Used</Text></View>
      <View style={{ flex: FLEX.camera }}><Text className="text-xs font-semibold text-gray-700"></Text></View>
    </View>
  );

  const DataRow = ({ row }: { row: any }) => (
    <View className="flex-row items-center bg-white border border-gray-200 rounded px-2 py-2 mt-1">
      <View style={{ flex: FLEX.item }}>
        <Text className="text-sm text-gray-800" numberOfLines={1}>{variantLabelById(row.material_variant_id)}</Text>
      </View>
      <View style={{ flex: FLEX.qty }}>
        <Text className="text-sm text-gray-800">{row.quantity ?? ''}</Text>
      </View>
      <View style={{ flex: FLEX.qtyUsed }}>
        <Text className="text-sm text-gray-800">{row.quantity_used ?? ''}</Text>
      </View>
      <View style={{ flex: FLEX.unit }}>
        <Text className="text-sm text-gray-800">{unitsMap[row.unit_id] || '—'}</Text>
      </View>
      <View style={{ flex: FLEX.comment }}>
        <Text className="text-sm text-gray-800" numberOfLines={1}>{row.comment || ''}</Text>
      </View>
      <View style={{ flex: FLEX.actions }}>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => markUsed(row.id)} className="px-2 py-1 rounded bg-green-50 border border-green-600"><View className="flex-row items-center"><Check size={18} color="#15803d" /><Text className="text-green-700 text-xs ml-1">Use</Text></View></TouchableOpacity>
          <TouchableOpacity onPress={() => removeRow(row.id)} className="px-2 py-1 rounded bg-red-50 border border-red-600"><View className="flex-row items-center"><X size={18} color="#ff0000" /><Text className="text-red-800 text-xs ml-1">Remove</Text></View></TouchableOpacity>
        </View>
      </View>
      <View style={{ flex: FLEX.camera }} className="items-center justify-center">
        <TouchableOpacity
          onPress={() => handleCameraPress(row)}
          className="p-1"
          activeOpacity={0.7}
        >
          <Camera size={16} color="#2563eb" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View className="mt-4">
      <CollapsibleCard title="Gas" containerClassName="border-gray-500 bg-white" defaultOpen>
        <View className="w-full rounded p-3 bg-gray-50 border border-gray-200">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-800 font-semibold">Gas</Text>
            <TouchableOpacity onPress={() => setOpen(true)} className="bg-blue-50 border border-blue-600 px-3 py-1.5 rounded"><Text className="text-blue-700 text-sm">Add Gas</Text></TouchableOpacity>
          </View>
          <HeaderRow />
          {(items || []).map((row) => (<DataRow key={row.id} row={row} />))}
        </View>
      </CollapsibleCard>

      {/* Add Gas Modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} className="flex-1 bg-black/40 justify-center items-center" onPress={() => { setOpen(false); resetForm(); }}>
          <TouchableOpacity activeOpacity={1} className="w-11/12 bg-white rounded-lg p-4" onPress={(e) => e.stopPropagation()}>
            <Text className="text-lg font-semibold text-gray-800 mb-3">Add gas</Text>

            {/* Variant picker */}
            <Text className="text-sm text-gray-700 mb-1">Item<Text className="text-red-600">*</Text></Text>
            <TouchableOpacity onPress={() => setVarOpen(v => !v)} className="border border-gray-300 rounded p-2 mb-1 bg-white">
              <View className="flex-row items-center justify-between"><Text className="text-gray-800">{formVariant ? variantLabelById(formVariant) : 'Select item'}</Text><ChevronDown size={16} color="#374151" /></View>
            </TouchableOpacity>
            {errors.variant ? (<Text className="text-red-600 text-xs mb-2">{errors.variant}</Text>) : <View className="mb-1" />}
            {varOpen && (
              <View className="max-h-40 border border-gray-200 rounded mb-2 bg-white"><ScrollView>{variants.map((opt) => (
                <TouchableOpacity key={opt.value} onPress={() => { setFormVariant(opt.value); setErrors(e => ({ ...e, variant: undefined })); setFormUnit(opt.unit_id || null); setVarOpen(false); }} className="px-3 py-2"><View className="flex-row justify-between items-center"><Text className="text-gray-800">{opt.label}</Text>{opt.unit_name ? (<View className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200"><Text className="text-[10px] text-slate-700">{opt.unit_name}</Text></View>) : null}</View></TouchableOpacity>
              ))}</ScrollView></View>
            )}

            {/* Quantity of cylinders */}
            <Text className="text-sm text-gray-700 mb-1">Quantity of cylinder<Text className="text-red-600">*</Text></Text>
            <TextInput value={formQuantity} onChangeText={(t) => { setFormQuantity(t); setErrors((e) => ({ ...e, quantity: undefined })); }} keyboardType="numeric" className="border border-gray-300 rounded p-2 mb-1 bg-white" placeholder="e.g. 1" />
            {errors.quantity ? (<Text className="text-red-600 text-xs mb-2">{errors.quantity}</Text>) : <View className="mb-1" />}

            {/* Quantity of gas used */}
            <Text className="text-sm text-gray-700 mb-1">Quantity of Gas Used<Text className="text-red-600">*</Text></Text>
            <TextInput value={formQuantityUsed} onChangeText={(t) => { setFormQuantityUsed(t); setErrors((e) => ({ ...e, quantity_used: undefined })); }} keyboardType="numeric" className="border border-gray-300 rounded p-2 mb-1 bg-white" placeholder="e.g. 10" />
            {errors.quantity_used ? (<Text className="text-red-600 text-xs mb-2">{errors.quantity_used}</Text>) : <View className="mb-1" />}

            {/* Unit */}
            <Text className="text-sm text-gray-700 mb-1">Unit<Text className="text-red-600">*</Text></Text>
            {formVariant && variants.find(v => v.value === formVariant)?.unit_id ? (
              <View className="flex-row items-center mb-2"><View className="px-2 py-1 rounded bg-slate-100 border border-slate-200"><Text className="text-slate-700 text-xs">{unitsMap[variants.find(v => v.value === formVariant)?.unit_id as string] || '—'}</Text></View><Text className="text-[10px] text-gray-500 ml-2">Auto-selected from material</Text></View>
            ) : (
              <>
                <TouchableOpacity onPress={() => setUnitOpen(v => !v)} className="border border-gray-300 rounded p-2 mb-1 bg-white"><View className="flex-row items-center justify-between"><Text className="text-gray-800">{formUnit ? (unitsMap[formUnit] || '—') : 'Select unit'}</Text><ChevronDown size={16} color="#374151" /></View></TouchableOpacity>
                {errors.unit ? (<Text className="text-red-600 text-xs mb-2">{errors.unit}</Text>) : <View className="mb-1" />}
                {unitOpen && (
                  <View className="max-h-40 border border-gray-200 rounded mb-2 bg-white"><ScrollView>{units.map((u) => (
                    <TouchableOpacity key={u.value} onPress={() => { setFormUnit(u.value); setErrors((e)=>({ ...e, unit: undefined })); setUnitOpen(false); }} className="px-3 py-2"><Text className="text-gray-800">{u.label}</Text></TouchableOpacity>
                  ))}</ScrollView></View>
                )}
              </>
            )}

            {/* Comment */}
            <Text className="text-sm text-gray-700 mb-1">Comment</Text>
            <TextInput value={formComment} onChangeText={setFormComment} className="border border-gray-300 rounded p-2 mb-3" placeholder="Optional notes" />

            <View className="flex-row justify-end gap-2"><TouchableOpacity onPress={() => { setOpen(false); resetForm(); }} className="px-3 py-2 rounded bg-red-50 border border-red-600"><Text className="text-red-800">Cancel</Text></TouchableOpacity><TouchableOpacity onPress={saveNew} className="px-3 py-2 rounded bg-blue-50 border border-blue-600"><Text className="text-blue-700">{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity></View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default GasMaterialsSection;