import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import CollapsibleCard from './common/CollapsibleCard';
import { db } from '../../utils/api/supabase';
import { Check, X, ChevronDown } from 'lucide-react-native';

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
  // Map of unit_id -> unit_name for quick lookup
  const unitsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (units || []).forEach(u => { m[u.value] = u.label; });
    return m;
  }, [units]);
  // Map of variant_id -> unit_id (default from material)
  const [variantUnitIdMap, setVariantUnitIdMap] = useState<Record<string, string | null>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [errors, setErrors] = useState<{ variant?: string; quantity?: string; unit?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [variantSearchQuery, setVariantSearchQuery] = useState('');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');

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

    console.log('📦 Accessories: loaded variants', v?.length || 0, 'units', u?.length || 0);
    if (!v || v.length === 0) {
      console.warn('⚠️ No variants found with tag "accessories". Please add the "accessories" tag to materials in inventory.');
    }

    setVariants((v || []).map((x: any) => ({ label: x.label, value: x.id || x.value })));
    setUnits((u || []).map((x: any) => ({ label: x.name || x.label, value: x.id || x.value })));
    // Build variant -> unit map (from material's default unit)
    const vMap: Record<string, string | null> = {};
    (v || []).forEach((x: any) => {
      vMap[x.id || x.value] = x.unit_id || null;
    });
    setVariantUnitIdMap(vMap);
    // Only show accessories added in this section
    setItems((rows || []).filter((r: any) => r.material_type === 'Accessories'));
  };

  useEffect(() => {
    // Clear old items immediately to prevent cross-box bleed while loading
    setItems([]);
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
    setVariantSearchQuery('');
    setUnitSearchQuery('');
    setTriedSubmit(false);
    setErrors({});
    setIsSaving(false);
  };

  const validate = () => {
    const qtyNum = formQuantity ? Number(formQuantity) : NaN;
    const unitId = formUnit || (formVariant ? variantUnitIdMap[formVariant] : null);
    const nextErrs: { variant?: string; quantity?: string; unit?: string } = {};
    if (!formVariant) nextErrs.variant = 'Item is required';
    if (!formQuantity || !Number.isFinite(qtyNum) || qtyNum <= 0) nextErrs.quantity = 'Enter a valid quantity (> 0)';
    if (!unitId) nextErrs.unit = 'Unit is required';
    setErrors(nextErrs);
    return Object.keys(nextErrs).length === 0;
  };


  const saveNew = async () => {
    setTriedSubmit(true);
    if (!validate()) {
      console.log('⚠️ Accessories: validation failed', errors);
      return;
    }

    // Resolve values
    const qtyNum = Number(formQuantity);
    const unitIdToUse: string = formUnit || (variantUnitIdMap[formVariant as string] as string);

    // Build payload matching live schema; include legacy and canonical-friendly fields
    const payload: any = {
      order_package_id: orderPackageId,
      material_variant_id: formVariant,
      material_type: 'Accessories',
      is_final: true,
      quantity: qtyNum,
      unit_id: unitIdToUse,
      length: formLength ? Number(formLength) : null,
      width: formWidth ? Number(formWidth) : null,
      comment: formComment || null,
      item_used: false,
      // also include canonical fields as no-ops to maximize compatibility
      quantity_calculated: qtyNum,
      cost_at_calculation: 0,
      usage_details: null,
      notes: formComment || null,
    };

    try {
      setIsSaving(true);
      console.log('➡️ Accessories: adding material', payload);
      const { error } = await db.addOrderPackageMaterial(payload);
      if (error) {
        const msg = (error?.message || error?.details || error?.hint || 'Failed to add item');
        Alert.alert('Error', String(msg));
        return;
      }
      setAddOpen(false);
      resetForm();
      await load();
    } finally {
      setIsSaving(false);
    }
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
            className={`px-2 py-1 rounded bg-green-50 border border-green-600`}
          >
            <View className="flex-row items-center">
              <Check size={18} color="#15803d" />
              <Text className="text-green-700 text-xs ml-1">Use</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => removeRow(row.id)}
            className="px-2 py-1 rounded bg-red-50 border border-red-600"
          >
            <View className="flex-row items-center">
              <X size={18} color="#ff0000" />
              <Text className="text-red-800 text-xs ml-1">Remove</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View className="mx-4 mt-4 mb-4">
      <CollapsibleCard title="Accessories" containerClassName="border-gray-500 bg-white" defaultOpen>
        {/* Inner container */}
        <View className="w-full rounded p-3 bg-gray-50 border border-gray-200">
          {/* Top bar: title + Add item button */}
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-800 font-semibold">Accessory items</Text>
            <TouchableOpacity onPress={() => setAddOpen(true)} className="bg-blue-50 border border-blue-600 px-3 py-1.5 rounded">
              <Text className="text-blue-700 text-sm">Add item</Text>
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
        <TouchableOpacity 
          activeOpacity={1}
          className="flex-1 bg-black/40 justify-center items-center"
          onPress={() => { setAddOpen(false); resetForm(); }}
        >
          <TouchableOpacity 
            activeOpacity={1}
            className="w-11/12 bg-white rounded-lg p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-gray-800 mb-3">Add accessory item</Text>

            {/* Variant Picker */}
            <Text className="text-sm text-gray-700 mb-1">Item<Text className="text-red-600">*</Text></Text>
            <TouchableOpacity
              onPress={() => setVariantPickerOpen(v => !v)}
              className="border border-gray-300 rounded p-2 mb-1 bg-white"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-800">{variantLabelById(formVariant)}</Text>
                <ChevronDown size={16} color="#374151" />
              </View>
            </TouchableOpacity>
            {triedSubmit && errors.variant ? (
              <Text className="text-red-600 text-xs mb-2">{errors.variant}</Text>
            ) : <View className="mb-1" />}
            {variantPickerOpen && (
              <View className="max-h-60 border border-gray-200 rounded mb-2 bg-white">
                {/* Search input */}
                <View className="p-2 border-b border-gray-200">
                  <TextInput
                    value={variantSearchQuery}
                    onChangeText={setVariantSearchQuery}
                    placeholder="Type to search items..."
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    autoFocus
                  />
                </View>
                <ScrollView>
                  {variants.length === 0 ? (
                    <View className="px-3 py-4">
                      <Text className="text-gray-500 text-sm text-center">No items found.</Text>
                      <Text className="text-gray-400 text-xs text-center mt-1">
                        Make sure materials are tagged with "accessories" in inventory.
                      </Text>
                    </View>
                  ) : (
                    variants
                      .filter((opt) => {
                        if (!variantSearchQuery.trim()) return true;
                        return opt.label.toLowerCase().includes(variantSearchQuery.toLowerCase());
                      })
                      .map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => {
                            setFormVariant(opt.value);
                            setErrors((e) => ({ ...e, variant: undefined }));
                            // Auto-assign unit from variant's material default
                            const autoUnit = variantUnitIdMap[opt.value] || null;
                            setFormUnit(autoUnit);
                            setErrors((e) => ({ ...e, unit: undefined }));
                            setVariantPickerOpen(false);
                            setVariantSearchQuery('');
                          }}
                          className="px-3 py-2 border-b border-gray-100"
                        >
                          <View className="flex-row justify-between items-center">
                            <Text className="text-gray-800">{opt.label}</Text>
                            {variantUnitIdMap[opt.value] ? (
                              <View className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                <Text className="text-[10px] text-slate-700">{unitsMap[variantUnitIdMap[opt.value] as string] || '—'}</Text>
                              </View>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      ))
                  )}
                </ScrollView>
              </View>
            )}

            {/* Quantity */}
            <Text className="text-sm text-gray-700 mb-1">Quantity<Text className="text-red-600">*</Text></Text>
            <TextInput
              value={formQuantity}
              onChangeText={(t) => { setFormQuantity(t); setErrors((e) => ({ ...e, quantity: undefined })); }}
              keyboardType="numeric"
              className="border border-gray-300 rounded p-2 mb-1 bg-white"
              placeholder="e.g. 1"
            />
            {triedSubmit && errors.quantity ? (
              <Text className="text-red-600 text-xs mb-2">{errors.quantity}</Text>
            ) : <View className="mb-1" />}

            {/* Unit display (auto from material). If no default, allow manual pick as fallback */}
            <Text className="text-sm text-gray-700 mb-1">Unit<Text className="text-red-600">*</Text></Text>
            {formVariant && variantUnitIdMap[formVariant] ? (
              <View className="flex-row items-center mb-2">
                <View className="px-2 py-1 rounded bg-slate-100 border border-slate-200">
                  <Text className="text-slate-700 text-xs">{unitsMap[variantUnitIdMap[formVariant] as string] || '—'}</Text>
                </View>
                <Text className="text-[10px] text-gray-500 ml-2">Auto-selected from material</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity onPress={() => setUnitPickerOpen(v => !v)} className="border border-gray-300 rounded p-2 mb-1 bg-white">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-800">{formUnit ? (unitsMap[formUnit] || '—') : 'Select unit'}</Text>
                    <ChevronDown size={16} color="#374151" />
                  </View>
                </TouchableOpacity>
                {triedSubmit && errors.unit ? (
                  <Text className="text-red-600 text-xs mb-2">{errors.unit}</Text>
                ) : <View className="mb-1" />}
                {unitPickerOpen && (
                  <View className="max-h-60 border border-gray-200 rounded mb-2 bg-white">
                    {/* Search input */}
                    <View className="p-2 border-b border-gray-200">
                      <TextInput
                        value={unitSearchQuery}
                        onChangeText={setUnitSearchQuery}
                        placeholder="Type to search units..."
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                        autoFocus
                      />
                    </View>
                    <ScrollView>
                      {units
                        .filter((opt) => {
                          if (!unitSearchQuery.trim()) return true;
                          return opt.label.toLowerCase().includes(unitSearchQuery.toLowerCase());
                        })
                        .map((opt) => (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => {
                              setFormUnit(opt.value);
                              setErrors((e) => ({ ...e, unit: undefined }));
                              setUnitPickerOpen(false);
                              setUnitSearchQuery('');
                            }}
                            className="px-3 py-2 border-b border-gray-100"
                          >
                            <Text className="text-gray-800">{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                )}
              </>
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
              <TouchableOpacity onPress={() => { setAddOpen(false); resetForm(); }} className="px-3 py-2 rounded bg-red-50 border border-red-600">
                <Text className="text-red-800">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNew} className="px-3 py-2 rounded bg-blue-50 border border-blue-600">
                <Text className="text-blue-700">{isSaving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default AccessoriesSection;

