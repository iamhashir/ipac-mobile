import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import CollapsibleCard from './common/CollapsibleCard';
import { db } from '../../utils/api/supabase';
import { Check, X } from 'lucide-react-native';

interface AccessoriesSectionProps {
  orderPackageId: string;
}

interface DropdownOption {
  label: string;
  value: string;
}

const AccessoriesSection: React.FC<AccessoriesSectionProps> = ({ orderPackageId }) => {
  const [items, setItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<DropdownOption[]>([]);
  const [units, setUnits] = useState<DropdownOption[]>([]);
  const unitsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (units || []).forEach(u => { m[u.value] = u.label; });
    return m;
  }, [units]);

  const [addOpen, setAddOpen] = useState(false);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  // Form state
  const [formVariant, setFormVariant] = useState<string | null>(null);
  const [formQuantity, setFormQuantity] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string | null>(null);
  const [formLength, setFormLength] = useState<string>('');
  const [formWidth, setFormWidth] = useState<string>('');
  const [formComment, setFormComment] = useState<string>('');

  const variantLabelById = (id: string | null | undefined) => {
    if (!id) return '—';
    return variants.find(v => v.value === id)?.label || '—';
  };

  const load = async () => {
    const [{ data: v }, { data: u }, { data: rows }] = await Promise.all([
      db.getMaterialVariantsByTag('accessories'),
      db.getAllUnits(),
      db.getOrderPackageMaterials(orderPackageId),
    ] as any);

    setVariants((v || []).map((x: any) => ({ label: x.label, value: x.id || x.value })));
    setUnits((u || []).map((x: any) => ({ label: x.name || x.label, value: x.id || x.value })));
    setItems(rows || []);
  };

  useEffect(() => {
    load();
  }, [orderPackageId]);

  const resetForm = () => {
    setFormVariant(null);
    setFormQuantity('');
    setFormUnit(null);
    setFormLength('');
    setFormWidth('');
    setFormComment('');
    setVariantPickerOpen(false);
    setUnitPickerOpen(false);
  };

  const saveNew = async () => {
    if (!formVariant) {
      Alert.alert('Missing item', 'Please select an accessory item');
      return;
    }
    if (!formUnit) {
      Alert.alert('Missing unit', 'Please select a unit');
      return;
    }
    const payload: any = {
      order_package_id: orderPackageId,
      material_variant_id: formVariant,
      quantity: formQuantity ? Number(formQuantity) : null,
      unit_id: formUnit,
      length: formLength ? Number(formLength) : null,
      width: formWidth ? Number(formWidth) : null,
      comment: formComment || null,
      item_used: false,
    };
    const { error } = await db.addOrderPackageMaterial(payload);
    if (error) {
      Alert.alert('Error', 'Failed to add item');
      return;
    }
    setAddOpen(false);
    resetForm();
    await load();
  };

  const markUsed = async (id: string) => {
    const { error } = await db.updateOrderPackageMaterial(id, { item_used: true });
    if (error) Alert.alert('Error', 'Failed to update item used');
    else await load();
  };

  const removeRow = async (id: string) => {
    Alert.alert('Remove item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await db.deleteOrderPackageMaterial(id);
        if (error) Alert.alert('Error', 'Failed to delete');
        else await load();
      }},
    ]);
  };

  // Layout helpers: assign relative flex weights per spec
  const FLEX = {
    item: 30,
    small: 5, // quantity, unit, length, width
    comment: 30,
    actions: 20,
  };

  const HeaderRow = () => (
    <View className="flex-row items-center bg-white/70 border border-gray-300 rounded px-2 py-2">
      <View style={{ flex: FLEX.item }}><Text className="text-xs font-semibold text-gray-700">Item</Text></View>
      <View style={{ flex: FLEX.small }}><Text className="text-xs font-semibold text-gray-700">Qty</Text></View>
      <View style={{ flex: FLEX.small }}><Text className="text-xs font-semibold text-gray-700">Unit</Text></View>
      <View style={{ flex: FLEX.small }}><Text className="text-xs font-semibold text-gray-700">Len</Text></View>
      <View style={{ flex: FLEX.small }}><Text className="text-xs font-semibold text-gray-700">Wid</Text></View>
      <View style={{ flex: FLEX.comment }}><Text className="text-xs font-semibold text-gray-700">Comment</Text></View>
      <View style={{ flex: FLEX.actions }}><Text className="text-xs font-semibold text-gray-700">Item Used</Text></View>
    </View>
  );

  const DataRow = ({ row }: { row: any }) => (
    <View className="flex-row items-center bg-white border border-gray-200 rounded px-2 py-2 mt-1">
      <View style={{ flex: FLEX.item }}>
        <Text className="text-sm text-gray-800" numberOfLines={1}>{variantLabelById(row.material_variant_id)}</Text>
      </View>
      <View style={{ flex: FLEX.small }}>
        <Text className="text-sm text-gray-800">{row.quantity ?? ''}</Text>
      </View>
      <View style={{ flex: FLEX.small }}>
        <Text className="text-sm text-gray-800">{unitsMap[row.unit_id] || '—'}</Text>
      </View>
      <View style={{ flex: FLEX.small }}>
        <Text className="text-sm text-gray-800">{row.length ?? ''}</Text>
      </View>
      <View style={{ flex: FLEX.small }}>
        <Text className="text-sm text-gray-800">{row.width ?? ''}</Text>
      </View>
      <View style={{ flex: FLEX.comment }}>
        <Text className="text-sm text-gray-800" numberOfLines={1}>{row.comment || ''}</Text>
      </View>
      <View style={{ flex: FLEX.actions }}>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => markUsed(row.id)}
            className={`px-2 py-1 rounded ${row.item_used ? 'bg-green-600' : 'bg-green-500'}`}
          >
            <View className="flex-row items-center">
              <Check size={18} color="#fff" />
              <Text className="text-white text-xs ml-1">Use</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => removeRow(row.id)}
            className="px-2 py-1 rounded bg-red-500"
          >
            <View className="flex-row items-center">
              <X size={18} color="#fff" />
              <Text className="text-white text-xs ml-1">Remove</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View className="mx-4 mt-4 mb-4">
      <CollapsibleCard title="Accessories" containerClassName="border-gray-500" defaultOpen>
        {/* Inner rectangle */}
        <View className="w-full rounded p-3 bg-gray-100 border border-gray-400">
          {/* Top bar: Select item label + Add item button */}
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-800 font-semibold">Select item</Text>
            <TouchableOpacity onPress={() => setAddOpen(true)} className="bg-primary-600 px-3 py-1 rounded">
              <Text className="text-white text-sm">Add item</Text>
            </TouchableOpacity>
          </View>

          {/* Table */}
          <HeaderRow />
          {(items || []).map((row) => (
            <DataRow key={row.id} row={row} />
          ))}
        </View>
      </CollapsibleCard>

      {/* Add Item Modal */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View className="flex-1 bg-black/40 justify-center items-center">
          <View className="w-11/12 bg-white rounded-lg p-4">
            <Text className="text-lg font-semibold text-gray-800 mb-3">Add accessory item</Text>

            {/* Variant Picker */}
            <Text className="text-sm text-gray-700 mb-1">Item</Text>
            <TouchableOpacity onPress={() => setVariantPickerOpen(v => !v)} className="border border-gray-300 rounded p-2 mb-2">
              <Text className="text-gray-800">{variantLabelById(formVariant)}</Text>
            </TouchableOpacity>
            {variantPickerOpen && (
              <View className="max-h-40 border border-gray-200 rounded mb-2">
                <ScrollView>
                  {variants.map((opt) => (
                    <TouchableOpacity key={opt.value} onPress={() => { setFormVariant(opt.value); setVariantPickerOpen(false); }} className="px-3 py-2">
                      <Text className="text-gray-800">{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Quantity */}
            <Text className="text-sm text-gray-700 mb-1">Quantity</Text>
            <TextInput value={formQuantity} onChangeText={setFormQuantity} keyboardType="numeric" className="border border-gray-300 rounded p-2 mb-2" placeholder="e.g. 1" />

            {/* Unit Picker */}
            <Text className="text-sm text-gray-700 mb-1">Unit</Text>
            <TouchableOpacity onPress={() => setUnitPickerOpen(v => !v)} className="border border-gray-300 rounded p-2 mb-2">
              <Text className="text-gray-800">{formUnit ? (unitsMap[formUnit] || '—') : 'Select unit'}</Text>
            </TouchableOpacity>
            {unitPickerOpen && (
              <View className="max-h-40 border border-gray-200 rounded mb-2">
                <ScrollView>
                  {units.map((opt) => (
                    <TouchableOpacity key={opt.value} onPress={() => { setFormUnit(opt.value); setUnitPickerOpen(false); }} className="px-3 py-2">
                      <Text className="text-gray-800">{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Length / Width */}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-sm text-gray-700 mb-1">Length</Text>
                <TextInput value={formLength} onChangeText={setFormLength} keyboardType="numeric" className="border border-gray-300 rounded p-2 mb-2" placeholder="cm" />
              </View>
              <View className="flex-1">
                <Text className="text-sm text-gray-700 mb-1">Width</Text>
                <TextInput value={formWidth} onChangeText={setFormWidth} keyboardType="numeric" className="border border-gray-300 rounded p-2 mb-2" placeholder="cm" />
              </View>
            </View>

            {/* Comment */}
            <Text className="text-sm text-gray-700 mb-1">Comment</Text>
            <TextInput value={formComment} onChangeText={setFormComment} className="border border-gray-300 rounded p-2 mb-3" placeholder="Optional notes" />

            <View className="flex-row justify-end gap-2">
              <TouchableOpacity onPress={() => { setAddOpen(false); resetForm(); }} className="px-3 py-2 rounded bg-gray-200">
                <Text className="text-gray-800">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNew} className="px-3 py-2 rounded bg-primary-600">
                <Text className="text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AccessoriesSection;

