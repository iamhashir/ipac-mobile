import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import CollapsibleCard from './common/CollapsibleCard';
import { db } from '../../utils/api/supabase';
import { Check, X, ChevronDown } from 'lucide-react-native';

interface SourceSpec {
  type: 'tag' | 'material';
  value: string; // for type 'material', this is treated as an exact name (case-insensitive)
}

interface FilteredMaterialsSectionProps {
  orderPackageId: string;
  title: string;
  sources: SourceSpec[]; // union of tags or material names
  quantityLabel?: string; // default: Quantity
  materialTypeLabel: string; // stored to DB in material_type column
}

const FilteredMaterialsSection: React.FC<FilteredMaterialsSectionProps> = ({ orderPackageId, title, sources, quantityLabel = 'Quantity', materialTypeLabel }) => {
  const [items, setItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<{ label: string; value: string; unit_id?: string | null; unit_name?: string | null }[]>([]);
  const [units, setUnits] = useState<{ label: string; value: string }[]>([]);
  const unitsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (units || []).forEach(u => { m[u.value] = u.label; });
    return m;
  }, [units]);

  // unioned set of allowed variant ids for this section
  const allowedVariantIds = useMemo(() => new Set((variants || []).map(v => v.value)), [variants]);

  // Add modal state
  const [open, setOpen] = useState(false);
  const [varOpen, setVarOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [error, setError] = useState<{ variant?: string; quantity?: string; unit?: string }>({});
  const [saving, setSaving] = useState(false);

  const [formVariant, setFormVariant] = useState<string | null>(null);
  const [formQuantity, setFormQuantity] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string | null>(null);
  const [formLength, setFormLength] = useState<string>('');
  const [formWidth, setFormWidth] = useState<string>('');
  const [formComment, setFormComment] = useState<string>('');

  const variantLabelById = (id: string | null | undefined) => variants.find(v => v.value === id)?.label || '—';

  const load = async () => {
    // Load variants by sources (union) and current items
    const variantSets: any[] = [];
    for (const s of sources) {
      if (s.type === 'tag') {
        const r = await db.getMaterialVariantsByTag(s.value);
        if (r.data) variantSets.push(r.data);
      } else if (s.type === 'material') {
        // Exact name match to avoid unrelated items (no partials)
        const r = await db.getMaterialVariantsByMaterialExactName(s.value);
        if (r.data) variantSets.push(r.data);
      }
    }
    const flat = (variantSets.flat() || []) as any[];
    // de-duplicate by id (local set for immediate filtering)
    const uniqMap = new Map<string, any>();
    flat.forEach(v => { if (v && v.id) uniqMap.set(v.id, v); });
    const nextVariants = Array.from(uniqMap.values()).map((v: any) => ({ label: v.label, value: v.id, unit_id: v.unit_id || null, unit_name: v.unit_name || null }));
    setVariants(nextVariants);
    const nextAllowed = new Set(nextVariants.map(v => v.value));

    const [{ data: u }, { data: rows }] = await Promise.all([
      db.getAllUnits(),
      db.getOrderPackageMaterials(orderPackageId),
    ] as any);
    setUnits((u || []).map((x: any) => ({ label: x.name || x.label, value: x.id || x.value })));
    setItems((rows || []).filter((r: any) => r.material_type === materialTypeLabel && nextAllowed.has(r.material_variant_id)));
  };

  useEffect(() => { setItems([]); setVariants([]); load(); }, [orderPackageId]);
  useEffect(() => { // reload items to apply filtering when variants change
    (async () => {
      const { data: rows } = await db.getOrderPackageMaterials(orderPackageId);
      setItems((rows || []).filter((r: any) => r.material_type === materialTypeLabel && allowedVariantIds.has(r.material_variant_id)));
    })();
  }, [allowedVariantIds.size, orderPackageId, materialTypeLabel]);

  const resetForm = () => {
    setFormVariant(null);
    setFormQuantity('');
    setFormUnit(null);
    setFormLength('');
    setFormWidth('');
    setFormComment('');
    setVarOpen(false);
    setUnitOpen(false);
    setError({});
    setSaving(false);
  };

  const validate = () => {
    const qtyNum = formQuantity ? Number(formQuantity) : NaN;
    const unitId = formUnit || (formVariant ? (variants.find(v => v.value === formVariant)?.unit_id || null) : null);
    const errs: any = {};
    if (!formVariant) errs.variant = 'Item is required';
    if (!formQuantity || !Number.isFinite(qtyNum) || qtyNum <= 0) errs.quantity = 'Enter a valid quantity (> 0)';
    if (!unitId) errs.unit = 'Unit is required';
    setError(errs);
    return Object.keys(errs).length === 0;
  };

  const saveNew = async () => {
    if (!validate()) return;
    const qtyNum = Number(formQuantity);
    const unitIdToUse: string = formUnit || (variants.find(v => v.value === formVariant)?.unit_id as any);
    const payload: any = {
      order_package_id: orderPackageId,
      material_variant_id: formVariant,
      material_type: materialTypeLabel,
      is_final: true,
      quantity: qtyNum,
      unit_id: unitIdToUse,
      length: formLength ? Number(formLength) : null,
      width: formWidth ? Number(formWidth) : null,
      comment: formComment || null,
      item_used: false,
      quantity_calculated: qtyNum,
      cost_at_calculation: 0,
      usage_details: null,
      notes: formComment || null,
    };

    try {
      setSaving(true);
      const { error } = await db.addOrderPackageMaterial(payload);
      if (error) { Alert.alert('Error', error?.message || 'Failed to add item'); return; }
      setOpen(false);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const markUsed = async (id: string) => { const { error } = await db.updateOrderPackageMaterial(id, { item_used: true }); if (!error) await load(); };
  const removeRow = async (id: string) => {
    Alert.alert('Remove item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { const { error } = await db.deleteOrderPackageMaterial(id); if (!error) await load(); } },
    ]);
  };

  // Layout proportions similar to Accessories
  const FLEX = { item: 30, small: 5, comment: 30, actions: 20 };

  const HeaderRow = () => (
    <View className="flex-row items-center bg-white/70 border border-gray-300 rounded px-2 py-2">
      <View style={{ flex: FLEX.item }}><Text className="text-xs font-semibold text-gray-700">Item</Text></View>
      <View style={{ flex: FLEX.small }}><Text className="text-xs font-semibold text-gray-700">{quantityLabel}</Text></View>
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
          <TouchableOpacity onPress={() => markUsed(row.id)} className="px-2 py-1 rounded bg-green-50 border border-green-600"><View className="flex-row items-center"><Check size={18} color="#15803d" /><Text className="text-green-700 text-xs ml-1">Use</Text></View></TouchableOpacity>
          <TouchableOpacity onPress={() => removeRow(row.id)} className="px-2 py-1 rounded bg-red-50 border border-red-600"><View className="flex-row items-center"><X size={18} color="#ff0000" /><Text className="text-red-800 text-xs ml-1">Remove</Text></View></TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View className="mt-4">
      <CollapsibleCard title={title} containerClassName="border-gray-500 bg-white" defaultOpen>
        <View className="w-full rounded p-3 bg-gray-50 border border-gray-200">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-800 font-semibold">{title}</Text>
            <TouchableOpacity onPress={() => setOpen(true)} className="bg-blue-50 border border-blue-600 px-3 py-1.5 rounded"><Text className="text-blue-700 text-sm">Add item</Text></TouchableOpacity>
          </View>
          <HeaderRow />
          {(items || []).map((row) => (<DataRow key={row.id} row={row} />))}
        </View>
      </CollapsibleCard>

      {/* Add Item Modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} className="flex-1 bg-black/40 justify-center items-center" onPress={() => { setOpen(false); resetForm(); }}>
          <TouchableOpacity activeOpacity={1} className="w-11/12 bg-white rounded-lg p-4" onPress={(e) => e.stopPropagation()}>
            <Text className="text-lg font-semibold text-gray-800 mb-3">Add item</Text>

            {/* Variant picker */}
            <Text className="text-sm text-gray-700 mb-1">Item<Text className="text-red-600">*</Text></Text>
            <TouchableOpacity onPress={() => setVarOpen(v => !v)} className="border border-gray-300 rounded p-2 mb-1 bg-white">
              <View className="flex-row items-center justify-between"><Text className="text-gray-800">{formVariant ? variantLabelById(formVariant) : 'Select item'}</Text><ChevronDown size={16} color="#374151" /></View>
            </TouchableOpacity>
            {error.variant ? (<Text className="text-red-600 text-xs mb-2">{error.variant}</Text>) : <View className="mb-1" />}
            {varOpen && (
              <View className="max-h-40 border border-gray-200 rounded mb-2 bg-white"><ScrollView>{variants.map((opt) => (
                <TouchableOpacity key={opt.value} onPress={() => { setFormVariant(opt.value); setError(e => ({ ...e, variant: undefined })); setFormUnit(opt.unit_id || null); setVarOpen(false); }} className="px-3 py-2"><View className="flex-row justify-between items-center"><Text className="text-gray-800">{opt.label}</Text>{opt.unit_name ? (<View className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200"><Text className="text-[10px] text-slate-700">{opt.unit_name}</Text></View>) : null}</View></TouchableOpacity>
              ))}</ScrollView></View>
            )}

            {/* Quantity */}
            <Text className="text-sm text-gray-700 mb-1">{quantityLabel}<Text className="text-red-600">*</Text></Text>
            <TextInput value={formQuantity} onChangeText={(t) => { setFormQuantity(t); setError((e) => ({ ...e, quantity: undefined })); }} keyboardType="numeric" className="border border-gray-300 rounded p-2 mb-1 bg-white" placeholder="e.g. 1" />
            {error.quantity ? (<Text className="text-red-600 text-xs mb-2">{error.quantity}</Text>) : <View className="mb-1" />}

            {/* Unit */}
            <Text className="text-sm text-gray-700 mb-1">Unit<Text className="text-red-600">*</Text></Text>
            {formVariant && variants.find(v => v.value === formVariant)?.unit_id ? (
              <View className="flex-row items-center mb-2"><View className="px-2 py-1 rounded bg-slate-100 border border-slate-200"><Text className="text-slate-700 text-xs">{unitsMap[variants.find(v => v.value === formVariant)?.unit_id as string] || '—'}</Text></View><Text className="text-[10px] text-gray-500 ml-2">Auto-selected from material</Text></View>
            ) : (
              <>
                <TouchableOpacity onPress={() => setUnitOpen(v => !v)} className="border border-gray-300 rounded p-2 mb-1 bg-white"><View className="flex-row items-center justify-between"><Text className="text-gray-800">{formUnit ? (unitsMap[formUnit] || '—') : 'Select unit'}</Text><ChevronDown size={16} color="#374151" /></View></TouchableOpacity>
                {error.unit ? (<Text className="text-red-600 text-xs mb-2">{error.unit}</Text>) : <View className="mb-1" />}
                {unitOpen && (
                  <View className="max-h-40 border border-gray-200 rounded mb-2 bg-white"><ScrollView>{units.map((u) => (
                    <TouchableOpacity key={u.value} onPress={() => { setFormUnit(u.value); setError((e)=>({ ...e, unit: undefined })); setUnitOpen(false); }} className="px-3 py-2"><Text className="text-gray-800">{u.label}</Text></TouchableOpacity>
                  ))}</ScrollView></View>
                )}
              </>
            )}

            {/* Length / Width */}
            <View className="flex-row gap-2"><View className="flex-1"><Text className="text-sm text-gray-700 mb-1">Length</Text><TextInput value={formLength} onChangeText={setFormLength} keyboardType="numeric" className="border border-gray-300 rounded p-2 mb-2" placeholder="cm" /></View><View className="flex-1"><Text className="text-sm text-gray-700 mb-1">Width</Text><TextInput value={formWidth} onChangeText={setFormWidth} keyboardType="numeric" className="border border-gray-300 rounded p-2 mb-2" placeholder="cm" /></View></View>

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

export default FilteredMaterialsSection;
