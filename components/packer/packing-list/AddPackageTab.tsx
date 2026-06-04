import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ChevronDown, ChevronUp, Package } from 'lucide-react-native';
import { db, supabase } from '../../../utils/api/supabase';
import OrderPackingInfo, { BoxInfoDetails } from './section_01_packing_info/order_packing_info';
import TwoTierEditableCard from './common/TwoTierEditableCard';
import ManufacturingSection from './section_05_manufacturing/ManufacturingSection';
import SecuringSection from './section_06_securing/SecuringSection';
import AccessoriesSection from './section_09_accessories/AccessoriesSection';
import GasPackingSection from './section_07_gas/GasPackingSection';
import VacuumPackingSection from './section_08_vacuum/VacuumPackingSection';
import CommentsSection from './section_03_comments/CommentsSection';
import CoverSection from './section_10_cover/CoverSection';
import CatalogItemPicker from './AddPackageTab/CatalogItemPicker';

interface AddPackageTabProps {
  orderId: string;
  nextPackageNumber: number;
  useSeiFlow?: boolean;
  isMaintenanceFlow?: boolean;
  clientId?: string | null;
  onSaved: (newPackageId: string) => void;
}

type DimensionKey = 'length' | 'width' | 'height';
type Scope = 'internal' | 'external';

type DimensionTriple = {
  length: number | null;
  width: number | null;
  height: number | null;
};

const emptyDims: DimensionTriple = { length: null, width: null, height: null };

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed * 100) / 100;
  }
  return null;
};

const normalizeOverviewStatus = (
  statusValue: unknown
): 'design' | 'approved' | 'in_production' | 'packed' => {
  const normalized = String(statusValue || '').trim().toLowerCase();
  if (normalized === 'design') return 'design';
  if (normalized === 'approved') return 'approved';
  if (normalized === 'in_production') return 'in_production';
  if (normalized === 'packed') return 'packed';
  if (normalized === 'delivered') return 'packed';
  return 'approved';
};

/** Returns true when the box type is NOT a standard box */
const checkIsCustomBox = (boxTypeName: string | null, boxTypeCode: string | null): boolean => {
  const name = String(boxTypeName || '').trim().toLowerCase();
  const code = String(boxTypeCode || '').trim().toLowerCase();
  if (name.startsWith('standard box')) return false;
  if (code.startsWith('standardbox')) return false;
  return true;
};

interface BoxTypeOption {
  id: string;
  name: string;
  code: string | null;
}

interface CategoryOption {
  id: string;
  label: string;
}

// ─── Simple inline picker ─────────────────────────────────────────────────────
function InlinePicker<T extends { id: string; label: string }>({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  options: T[];
  onChange: (id: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <View className="mb-3">
      <Text className="text-gray-700 text-sm mb-1">{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        className="border border-gray-300 rounded-lg px-3 py-3 bg-white flex-row items-center justify-between"
      >
        <Text className={selected ? 'text-gray-800 text-base' : 'text-gray-400 text-base'}>
          {selected ? selected.label : placeholder ?? `Select ${label}`}
        </Text>
        {open ? (
          <ChevronUp size={16} color="#6b7280" />
        ) : (
          <ChevronDown size={16} color="#6b7280" />
        )}
      </TouchableOpacity>

      {open && (
        <View className="border border-gray-200 rounded-lg bg-white mt-1 shadow-sm">
          {/* Clear option */}
          <TouchableOpacity
            onPress={() => { onChange(null); setOpen(false); }}
            className="px-3 py-2.5 border-b border-gray-100"
          >
            <Text className="text-gray-400 text-sm italic">— None —</Text>
          </TouchableOpacity>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => { onChange(opt.id); setOpen(false); }}
              className={`px-3 py-2.5 border-b border-gray-100 ${opt.id === value ? 'bg-blue-50' : ''}`}
            >
              <Text className={`text-sm ${opt.id === value ? 'text-blue-700 font-semibold' : 'text-gray-800'}`}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function AddPackageTab({
  orderId,
  nextPackageNumber,
  useSeiFlow = false,
  isMaintenanceFlow = false,
  clientId = null,
  onSaved,
}: AddPackageTabProps) {
  // Step state: 'pre-draft' → 'catalog' → (done via onSaved)
  const [step, setStep] = useState<'pre-draft' | 'catalog' | 'packing-sections'>('pre-draft');
  const [creating, setCreating] = useState(false);
  const [draftPackageId, setDraftPackageId] = useState<string | null>(null);
  const [draftInstanceId, setDraftInstanceId] = useState<string | null>(null);
  const [draftInstanceSeq, setDraftInstanceSeq] = useState<number>(1);
  const [originalInfoId, setOriginalInfoId] = useState<string | null>(null);
  const [finalInfoId, setFinalInfoId] = useState<string | null>(null);

  // Pre-draft form fields
  const [description, setDescription] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedBoxTypeId, setSelectedBoxTypeId] = useState<string | null>(null);

  // Picker data
  const [boxTypes, setBoxTypes] = useState<BoxTypeOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Packing sections state
  const [originalInfo, setOriginalInfo] = useState<BoxInfoDetails | null>(null);
  const [originalBoxTypeId, setOriginalBoxTypeId] = useState<string | null>(null);
  const [originalPackingTypeId, setOriginalPackingTypeId] = useState<string | null>(null);
  const [internalDimensions, setInternalDimensions] = useState<DimensionTriple>(emptyDims);
  const [externalDimensions, setExternalDimensions] = useState<DimensionTriple>(emptyDims);
  const [packingTypes, setPackingTypes] = useState<any[]>([]);

  // ── Load picker data ────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [boxTypesRes, catsRes, packingTypesRes] = await Promise.all([
        db.getAllBoxTypes(),
        db.getOrderCategories(orderId),
        db.getAllPackingTypes(),
      ]);

      if (boxTypesRes.data) {
        setBoxTypes(
          (boxTypesRes.data as any[]).map((bt) => ({
            id: bt.id,
            name: bt.name,
            code: bt.code ?? null,
          }))
        );
      }
      if (catsRes.data) {
        setCategories(
          (catsRes.data as any[]).map((cat: any) => ({
            id: cat.id,
            label: cat.label,
          }))
        );
      }
      if (packingTypesRes.data) setPackingTypes(packingTypesRes.data);
    };
    load();
  }, [orderId]);

  const selectedPackingType = useMemo(
    () => packingTypes.find((type: any) => type.id === originalPackingTypeId) || null,
    [packingTypes, originalPackingTypeId]
  );
  const showGasSection = !!selectedPackingType?.includes_gas_protection;
  const showVacuumSection = !!selectedPackingType?.includes_vacuum_protection;

  const selectedBoxType = boxTypes.find((bt) => bt.id === selectedBoxTypeId) ?? null;
  const isCustomBox = checkIsCustomBox(selectedBoxType?.name ?? null, selectedBoxType?.code ?? null);

  // ── Create draft ─────────────────────────────────────────────────────────────
  const handleCreateDraft = async () => {
    try {
      setCreating(true);

      const { data: latestPackageRow, error: latestPackageErr } = await supabase
        .from('order_packages')
        .select('package_number')
        .eq('order_id', orderId)
        .order('package_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestPackageErr) throw latestPackageErr;

      const latestPackageNumber = Number(latestPackageRow?.package_number || 0);
      const packageNumberToCreate = Math.max(
        1,
        Number.isFinite(nextPackageNumber) ? nextPackageNumber : 1,
        Number.isFinite(latestPackageNumber) ? latestPackageNumber + 1 : 1
      );

      const { data: origInfo, error: origErr } = await supabase
        .from('package_info')
        .insert({})
        .select('id')
        .single();
      if (origErr || !origInfo) throw origErr || new Error('Failed to create original package info');

      const { data: finInfo, error: finErr } = await supabase
        .from('package_info')
        .insert({})
        .select('id')
        .single();
      if (finErr || !finInfo) throw finErr || new Error('Failed to create final package info');

      const { data: orderPkg, error: pkgErr } = await supabase
        .from('order_packages')
        .insert({
          order_id: orderId,
          package_number: packageNumberToCreate,
          description: description.trim() || null,
          status: 'approved',
          original_pkg_info: origInfo.id,
          final_pkg_info: finInfo.id,
        })
        .select('id, status')
        .single();
      if (pkgErr || !orderPkg) throw pkgErr || new Error('Failed to create order package');

      const normalizedInstanceStatus = normalizeOverviewStatus(orderPkg.status);

      // Overview
      let overviewId: string | null = null;
      let overviewQuantity = 0;

      const { data: existingOverview, error: existingOverviewErr } = await supabase
        .from('order_pkg_overview')
        .select('id, quantity')
        .eq('order_id', orderId)
        .eq('pkg_number', packageNumberToCreate)
        .maybeSingle();
      if (existingOverviewErr) throw existingOverviewErr;

      if (existingOverview?.id) {
        overviewId = existingOverview.id;
        overviewQuantity = Number(existingOverview.quantity || 0);
      } else {
        const { data: createdOverview, error: createdOverviewErr } = await supabase
          .from('order_pkg_overview')
          .insert({
            order_id: orderId,
            pkg_number: packageNumberToCreate,
            status: normalizedInstanceStatus,
            quantity: 1,
            quantity_packed: normalizedInstanceStatus === 'packed' ? 1 : 0,
            description: description.trim() || null,
          })
          .select('id, quantity')
          .single();
        if (createdOverviewErr || !createdOverview?.id) {
          throw createdOverviewErr || new Error('Failed to create package overview');
        }
        overviewId = createdOverview.id;
        overviewQuantity = Number(createdOverview.quantity || 1);
      }
      if (!overviewId) throw new Error('Failed to resolve package overview');

      // Instance
      const { data: lastInstanceRow, error: lastInstanceErr } = await supabase
        .from('order_pkg_instance')
        .select('instance_number')
        .eq('order_pkg_overview_id', overviewId)
        .order('instance_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastInstanceErr) throw lastInstanceErr;

      const nextInstanceNumber = Math.max(1, Number(lastInstanceRow?.instance_number || 0) + 1);

      const { data: newInstance, error: createInstanceErr } = await supabase
        .from('order_pkg_instance')
        .insert({
          order_pkg_overview_id: overviewId,
          order_package_id: orderPkg.id,
          instance_number: nextInstanceNumber,
          status: normalizedInstanceStatus,
          packed_at: normalizedInstanceStatus === 'packed' ? new Date().toISOString() : null,
          destination: destination.trim() || null,
          category_id: selectedCategoryId || null,
        })
        .select('id, instance_number')
        .single();
      if (createInstanceErr || !newInstance?.id) throw createInstanceErr || new Error('Failed to create instance');

      if (!Number.isFinite(overviewQuantity) || overviewQuantity < nextInstanceNumber) {
        await supabase
          .from('order_pkg_overview')
          .update({ quantity: nextInstanceNumber })
          .eq('id', overviewId);
      }

      // If a box type was selected, save it to original package_info
      if (selectedBoxTypeId && origInfo?.id) {
        await supabase
          .from('package_info')
          .update({ box_type_id: selectedBoxTypeId })
          .eq('id', origInfo.id);
      }

      setOriginalInfoId(origInfo.id);
      setFinalInfoId(finInfo.id);
      setDraftPackageId(orderPkg.id);
      setDraftInstanceId(newInstance.id);
      setDraftInstanceSeq(newInstance.instance_number ?? nextInstanceNumber);

      if (isMaintenanceFlow) {
        onSaved(orderPkg.id);
        return;
      }

      // Move to catalog step (or packing sections if no clientId)
      setStep(clientId ? 'catalog' : 'packing-sections');
    } catch (e: any) {
      console.log('➡️ AddPackageTab: create draft failed', e);
      Alert.alert('Error', e?.message || 'Failed to create new box');
    } finally {
      setCreating(false);
    }
  };

  // ── After catalog confirms items ──────────────────────────────────────────────
  const handleCatalogConfirmed = async (primaryItem: { id: string; item_num: string | number | null } | null) => {
    if (draftInstanceId && isCustomBox && destination.trim() && selectedCategoryId) {
      // Generate IPAC reference for custom boxes
      const { error: refErr } = await db.generateAndSaveIpacReference({
        instanceId: draftInstanceId,
        destination: destination.trim(),
        categoryId: selectedCategoryId,
        itemNum: primaryItem?.item_num ?? null,
        instanceSeq: draftInstanceSeq,
        isCustomBox: true,
      });
      if (refErr) {
        console.warn('[AddPackageTab] IPAC ref generation failed:', refErr);
      }
    }
    setStep('packing-sections');
  };

  const handleInfoChange = (change: any) => {
    if (change?.isFinal) return;
    const fields = change?.fields || {};
    setOriginalInfo((prev) => ({
      quantity: fields.quantity ?? prev?.quantity ?? null,
      sei: prev?.sei ?? null,
      boxType: prev?.boxType ?? null,
      tare: fields.tare ?? prev?.tare ?? null,
      netWeight: fields.net_weight ?? prev?.netWeight ?? null,
      grossWeight: fields.gross_weight ?? prev?.grossWeight ?? null,
      centerOfGravity:
        typeof fields.center_of_gravity === 'boolean'
          ? fields.center_of_gravity
          : prev?.centerOfGravity ?? null,
    }));
    if (typeof fields.box_type_id !== 'undefined') setOriginalBoxTypeId(fields.box_type_id || null);
    if (typeof fields.packing_type_id !== 'undefined') setOriginalPackingTypeId(fields.packing_type_id || null);
  };

  const saveOriginalDimension = async (scope: Scope, key: DimensionKey, value: unknown) => {
    if (!originalInfoId) return;
    const numericValue = toNumberOrNull(value);
    const payloadField = `${scope}_${key}`;
    const patch = { [payloadField]: numericValue };
    const { error } = await db.updatePackageInfo(originalInfoId, patch);
    if (error) {
      Alert.alert('Error', error?.message || 'Failed to save dimensions');
      return;
    }
    if (scope === 'internal') {
      setInternalDimensions((prev) => ({ ...prev, [key]: numericValue }));
    } else {
      setExternalDimensions((prev) => ({ ...prev, [key]: numericValue }));
    }
  };

  const handleFinish = () => {
    if (!draftPackageId) return;
    onSaved(draftPackageId);
  };

  // Auto-run for maintenance flow
  useEffect(() => {
    if (!isMaintenanceFlow) return;
    if (draftPackageId || creating) return;
    handleCreateDraft();
  }, [isMaintenanceFlow, draftPackageId, creating]);

  // ── Box type picker options (adapted for InlinePicker) ─────────────────────
  const boxTypeOptions = boxTypes.map((bt) => ({
    id: bt.id,
    label: bt.name,
  }));
  const categoryOptions = categories.map((cat) => ({
    id: cat.id,
    label: cat.label,
  }));

  // ── Dimensions editor ─────────────────────────────────────────────────────
  const renderDimensionsEditor = () => (
    <View className="mt-4 mx-1 bg-white rounded-xl border border-gray-500 p-3">
      <Text className="text-blue-800 font-semibold mb-3">Packing Dimensions</Text>
      <View className="bg-blue-50 rounded-xl border border-indigo-200 p-2 mb-3">
        <View className="px-3 py-1 rounded-full self-center mb-2">
          <Text className="text-blue-800 text-xs font-semibold text-center">Internal Dimensions</Text>
        </View>
        <View className="flex-row" style={{ flexWrap: 'nowrap' }}>
          <TwoTierEditableCard editTarget="original" editable label="Length" original={internalDimensions.length} final={null} type="number" onChange={(v) => saveOriginalDimension('internal', 'length', v)} flex={1} />
          <TwoTierEditableCard editTarget="original" editable label="Width" original={internalDimensions.width} final={null} type="number" onChange={(v) => saveOriginalDimension('internal', 'width', v)} flex={1} />
          <TwoTierEditableCard editTarget="original" editable label="Height" original={internalDimensions.height} final={null} type="number" onChange={(v) => saveOriginalDimension('internal', 'height', v)} flex={1} />
        </View>
      </View>
      <View className="bg-blue-50 rounded-xl border border-indigo-200 p-2">
        <View className="px-3 py-1 rounded-full self-center mb-2">
          <Text className="text-blue-800 text-xs font-semibold text-center">External Dimensions</Text>
        </View>
        <View className="flex-row" style={{ flexWrap: 'nowrap' }}>
          <TwoTierEditableCard editTarget="original" editable label="Length" original={externalDimensions.length} final={null} type="number" onChange={(v) => saveOriginalDimension('external', 'length', v)} flex={1} />
          <TwoTierEditableCard editTarget="original" editable label="Width" original={externalDimensions.width} final={null} type="number" onChange={(v) => saveOriginalDimension('external', 'width', v)} flex={1} />
          <TwoTierEditableCard editTarget="original" editable label="Height" original={externalDimensions.height} final={null} type="number" onChange={(v) => saveOriginalDimension('external', 'height', v)} flex={1} />
        </View>
      </View>
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {/* ── STEP 1: Pre-draft form ────────────────────────────────────────── */}
      {step === 'pre-draft' && !isMaintenanceFlow && (
        <ScrollView className="p-4 bg-white rounded-b-lg mb-4">
          <Text className="text-xl font-semibold mb-4 text-gray-800">
            Add New Box (Box #{nextPackageNumber})
          </Text>

          <Text className="text-gray-700 text-sm mb-1">Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="E.g., Extra parts box"
            className="border border-gray-300 rounded-lg p-3 mb-4 bg-white text-base"
          />

          <Text className="text-gray-700 text-sm mb-1">
            Destination{' '}
            <Text className="text-gray-400 text-xs">(optional — uses order default if blank)</Text>
          </Text>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="E.g., ALD"
            autoCapitalize="characters"
            className="border border-gray-300 rounded-lg p-3 mb-4 bg-white text-base"
          />

          <InlinePicker
            label="Category"
            value={selectedCategoryId}
            options={categoryOptions}
            onChange={setSelectedCategoryId}
            placeholder="Use order default"
          />

          <InlinePicker
            label="Box Type"
            value={selectedBoxTypeId}
            options={boxTypeOptions}
            onChange={setSelectedBoxTypeId}
            placeholder="Select box type"
          />

          {/* Custom box indicator */}
          {selectedBoxTypeId && (
            <View className={`mb-4 px-3 py-2 rounded-lg ${isCustomBox ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <Text className={`text-xs font-semibold ${isCustomBox ? 'text-amber-800' : 'text-green-800'}`}>
                {isCustomBox
                  ? '⚠ Custom / Made-to-Measure — IPAC reference will be auto-generated'
                  : '✓ Standard Box — No IPAC reference generated'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleCreateDraft}
            disabled={creating}
            className={`mt-2 mb-8 p-4 rounded-xl items-center ${creating ? 'bg-blue-300' : 'bg-blue-600'}`}
          >
            {creating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Create Box</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── STEP 2: Catalog item picker ───────────────────────────────────── */}
      {step === 'catalog' && draftPackageId && draftInstanceId && (
        <View style={{ flex: 1 }}>
          <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200">
            <Text className="text-lg font-semibold text-gray-800">Add Items to Box</Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              {selectedCategoryId
                ? `Showing items for selected category`
                : 'Showing all items for this order'}
              {isCustomBox && destination.trim()
                ? ` • IPAC ref: ${destination.trim().toUpperCase()}-…`
                : ''}
            </Text>
          </View>
          <CatalogItemPicker
            orderId={orderId}
            clientId={clientId!}
            orderPackageId={draftPackageId}
            instanceId={draftInstanceId}
            overrideCategoryId={selectedCategoryId}
            onItemsConfirmed={handleCatalogConfirmed}
          />
        </View>
      )}

      {/* ── STEP 3: Packing sections ──────────────────────────────────────── */}
      {step === 'packing-sections' && draftPackageId && (
        <ScrollView className="p-4 bg-white rounded-b-lg mb-4">
          <View className="bg-green-50 p-4 rounded-lg mb-6 border border-green-200">
            <Text className="text-green-800 font-medium">Box draft created ✓</Text>
            <Text className="text-green-700 mt-1 text-sm">
              {isMaintenanceFlow
                ? 'Box created. Continue in the box tab to assign tasks and complete packing sections.'
                : 'Complete packing info, manufacturing, securing, accessories, cover, and gas/vacuum sections below.'}
            </Text>
          </View>

          <View className="mt-1">
            <OrderPackingInfo
              original={originalInfo}
              final={null}
              originalInfoId={originalInfoId}
              finalInfoId={finalInfoId}
              orderPackageId={draftPackageId}
              originalBoxTypeId={originalBoxTypeId ?? selectedBoxTypeId}
              finalBoxTypeId={null}
              originalPackingTypeId={originalPackingTypeId}
              finalPackingTypeId={null}
              useSeiFlow={useSeiFlow}
              editTarget="original"
              editable
              onChange={handleInfoChange}
            />
          </View>

          {renderDimensionsEditor()}

          {isMaintenanceFlow ? (
            <CommentsSection orderPackageId={draftPackageId} editable />
          ) : (
            <>
              <ManufacturingSection orderPackageId={draftPackageId} editTarget="original" editable autoSave hideUseButton hideRemoveButton />
              <SecuringSection orderPackageId={draftPackageId} editable hideUseButton hideRemoveButton />
              <AccessoriesSection orderPackageId={draftPackageId} editable hideUseButton hideRemoveButton />
              <CoverSection orderPackageId={draftPackageId} editable hideUseButton hideRemoveButton />
              {showGasSection && <GasPackingSection orderPackageId={draftPackageId} editable hideUseButton hideRemoveButton />}
              {showVacuumSection && <VacuumPackingSection orderPackageId={draftPackageId} editable hideUseButton hideRemoveButton />}

              <TouchableOpacity
                onPress={handleFinish}
                className="mt-6 mb-8 p-4 rounded-xl items-center bg-blue-600"
              >
                <Text className="text-white font-bold text-lg">Save Box</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
