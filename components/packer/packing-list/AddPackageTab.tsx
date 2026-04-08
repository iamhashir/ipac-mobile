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

interface AddPackageTabProps {
  orderId: string;
  nextPackageNumber: number;
  useSeiFlow?: boolean;
  isMaintenanceFlow?: boolean;
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

export default function AddPackageTab({
  orderId,
  nextPackageNumber,
  useSeiFlow = false,
  isMaintenanceFlow = false,
  onSaved,
}: AddPackageTabProps) {
  const [creating, setCreating] = useState(false);
  const [draftPackageId, setDraftPackageId] = useState<string | null>(null);
  const [originalInfoId, setOriginalInfoId] = useState<string | null>(null);
  const [finalInfoId, setFinalInfoId] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [originalInfo, setOriginalInfo] = useState<BoxInfoDetails | null>(null);
  const [originalBoxTypeId, setOriginalBoxTypeId] = useState<string | null>(null);
  const [originalPackingTypeId, setOriginalPackingTypeId] = useState<string | null>(null);
  const [internalDimensions, setInternalDimensions] = useState<DimensionTriple>(emptyDims);
  const [externalDimensions, setExternalDimensions] = useState<DimensionTriple>(emptyDims);

  const [packingTypes, setPackingTypes] = useState<any[]>([]);

  useEffect(() => {
    const loadPackingTypes = async () => {
      const { data, error } = await db.getAllPackingTypes();
      if (error) {
        console.log('➡️ AddPackageTab: failed loading packing types', error);
        return;
      }
      setPackingTypes(data || []);
    };
    loadPackingTypes();
  }, []);

  const selectedPackingType = useMemo(
    () => packingTypes.find((type: any) => type.id === originalPackingTypeId) || null,
    [packingTypes, originalPackingTypeId]
  );

  const showGasSection = !!selectedPackingType?.includes_gas_protection;
  const showVacuumSection = !!selectedPackingType?.includes_vacuum_protection;

  const handleCreateDraft = async () => {
    try {
      setCreating(true);

      const { data: origInfo, error: origErr } = await supabase
        .from('package_info')
        .insert({})
        .select('id')
        .single();

      if (origErr || !origInfo) {
        throw origErr || new Error('Failed to create original package info');
      }

      const { data: finInfo, error: finErr } = await supabase
        .from('package_info')
        .insert({})
        .select('id')
        .single();

      if (finErr || !finInfo) {
        throw finErr || new Error('Failed to create final package info');
      }

      const { data: orderPkg, error: pkgErr } = await supabase
        .from('order_packages')
        .insert({
          order_id: orderId,
          package_number: nextPackageNumber,
          description: description.trim() || null,
          status: 'approved',
          original_pkg_info: origInfo.id,
          final_pkg_info: finInfo.id,
        })
        .select('id')
        .single();

      if (pkgErr || !orderPkg) {
        throw pkgErr || new Error('Failed to create order package');
      }

      setOriginalInfoId(origInfo.id);
      setFinalInfoId(finInfo.id);
      setDraftPackageId(orderPkg.id);

      if (isMaintenanceFlow) {
        onSaved(orderPkg.id);
      }
    } catch (e: any) {
      console.log('➡️ AddPackageTab: create draft failed', e);
      Alert.alert('Error', e?.message || 'Failed to create new box');
    } finally {
      setCreating(false);
    }
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

    if (typeof fields.box_type_id !== 'undefined') {
      setOriginalBoxTypeId(fields.box_type_id || null);
    }
    if (typeof fields.packing_type_id !== 'undefined') {
      setOriginalPackingTypeId(fields.packing_type_id || null);
    }
  };

  const saveOriginalDimension = async (scope: Scope, key: DimensionKey, value: unknown) => {
    if (!originalInfoId) return;

    const numericValue = toNumberOrNull(value);
    const payloadField = `${scope}_${key}`;

    const patch = { [payloadField]: numericValue };
    const { error } = await db.updatePackageInfo(originalInfoId, patch);
    if (error) {
      console.log('➡️ AddPackageTab: save original dimensions failed', error);
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

  useEffect(() => {
    if (!isMaintenanceFlow) return;
    if (draftPackageId || creating) return;
    handleCreateDraft();
  }, [isMaintenanceFlow, draftPackageId, creating]);

  const renderDimensionsEditor = () => (
    <View className="mt-4 mx-1 bg-white rounded-xl border border-gray-500 p-3">
      <Text className="text-blue-800 font-semibold mb-3">Packing Dimensions</Text>
      <View className="bg-blue-50 rounded-xl border border-indigo-200 p-2 mb-3">
        <View className="px-3 py-1 rounded-full self-center mb-2">
          <Text className="text-blue-800 text-xs font-semibold text-center">Internal Dimensions</Text>
        </View>
        <View className="flex-row" style={{ flexWrap: 'nowrap' }}>
          <TwoTierEditableCard
            editTarget="original"
            editable
            label="Length"
            original={internalDimensions.length}
            final={null}
            type="number"
            onChange={(v) => saveOriginalDimension('internal', 'length', v)}
            flex={1}
          />
          <TwoTierEditableCard
            editTarget="original"
            editable
            label="Width"
            original={internalDimensions.width}
            final={null}
            type="number"
            onChange={(v) => saveOriginalDimension('internal', 'width', v)}
            flex={1}
          />
          <TwoTierEditableCard
            editTarget="original"
            editable
            label="Height"
            original={internalDimensions.height}
            final={null}
            type="number"
            onChange={(v) => saveOriginalDimension('internal', 'height', v)}
            flex={1}
          />
        </View>
      </View>

      <View className="bg-blue-50 rounded-xl border border-indigo-200 p-2">
        <View className="px-3 py-1 rounded-full self-center mb-2">
          <Text className="text-blue-800 text-xs font-semibold text-center">External Dimensions</Text>
        </View>
        <View className="flex-row" style={{ flexWrap: 'nowrap' }}>
          <TwoTierEditableCard
            editTarget="original"
            editable
            label="Length"
            original={externalDimensions.length}
            final={null}
            type="number"
            onChange={(v) => saveOriginalDimension('external', 'length', v)}
            flex={1}
          />
          <TwoTierEditableCard
            editTarget="original"
            editable
            label="Width"
            original={externalDimensions.width}
            final={null}
            type="number"
            onChange={(v) => saveOriginalDimension('external', 'width', v)}
            flex={1}
          />
          <TwoTierEditableCard
            editTarget="original"
            editable
            label="Height"
            original={externalDimensions.height}
            final={null}
            type="number"
            onChange={(v) => saveOriginalDimension('external', 'height', v)}
            flex={1}
          />
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView className="p-4 bg-white rounded-b-lg mb-4">
      <Text className="text-xl font-semibold mb-4 text-gray-800">Add New Box (Box #{nextPackageNumber})</Text>

      {!draftPackageId ? (
        <View className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
          <Text className="text-blue-800 font-medium">Create box first</Text>
          <Text className="text-blue-700 mt-1 text-sm">
            {isMaintenanceFlow
              ? 'Creating a fresh maintenance box...'
              : 'This will open the full package sections with original-only entry fields.'}
          </Text>
        </View>
      ) : (
        <View className="bg-green-50 p-4 rounded-lg mb-6 border border-green-200">
          <Text className="text-green-800 font-medium">Box draft created</Text>
          <Text className="text-green-700 mt-1 text-sm">
            {isMaintenanceFlow
              ? 'Box created. Continue in the box tab to assign tasks and complete packing sections.'
              : 'Complete packing info, manufacturing, securing, accessories, cover, and gas/vacuum sections below.'}
          </Text>
        </View>
      )}

      {!draftPackageId && !isMaintenanceFlow && (
        <>
          <Text className="text-gray-700 text-sm mb-1">Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="E.g., Extra parts box"
            className="border border-gray-300 rounded-lg p-3 mb-4 bg-white text-base"
          />

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
        </>
      )}

      {draftPackageId && (
        <>
          <View className="mt-1">
            <OrderPackingInfo
              original={originalInfo}
              final={null}
              originalInfoId={originalInfoId}
              finalInfoId={finalInfoId}
              orderPackageId={draftPackageId}
              originalBoxTypeId={originalBoxTypeId}
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
              <ManufacturingSection
                orderPackageId={draftPackageId}
                editTarget="original"
                editable
                autoSave
                hideUseButton
                hideRemoveButton
              />

              <SecuringSection
                orderPackageId={draftPackageId}
                editable
                hideUseButton
                hideRemoveButton
              />

              <AccessoriesSection
                orderPackageId={draftPackageId}
                editable
                hideUseButton
                hideRemoveButton
              />

              <CoverSection
                orderPackageId={draftPackageId}
                editable
                hideUseButton
                hideRemoveButton
              />

              {showGasSection && (
                <GasPackingSection
                  orderPackageId={draftPackageId}
                  editable
                  hideUseButton
                  hideRemoveButton
                />
              )}

              {showVacuumSection && (
                <VacuumPackingSection
                  orderPackageId={draftPackageId}
                  editable
                  hideUseButton
                  hideRemoveButton
                />
              )}

              <TouchableOpacity
                onPress={handleFinish}
                className="mt-6 mb-8 p-4 rounded-xl items-center bg-blue-600"
              >
                <Text className="text-white font-bold text-lg">Save Box</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
