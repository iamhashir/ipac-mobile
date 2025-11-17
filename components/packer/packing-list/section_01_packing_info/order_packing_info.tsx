import React, { useEffect, useMemo, useState } from 'react';
import { View, Alert } from 'react-native';
import TwoTierEditableCard from '../common/TwoTierEditableCard';
import { db } from '../../../../utils/api/supabase';
import { PackageInfoChangeEvent } from './types';

export interface BoxInfoDetails {
  quantity: number | null;
  sei: string | null; // packing type code
  boxType: string | null; // material name/type name
  tare: number | null;
  netWeight: number | null;
  grossWeight: number | null;
  centerOfGravity: boolean | null;
}

export interface OrderPackingInfoProps {
  original: BoxInfoDetails | null | undefined;
  final: BoxInfoDetails | null | undefined;
  originalInfoId?: string | null;
  finalInfoId?: string | null;
  orderPackageId?: string;
  originalBoxTypeId?: string | null;
  finalBoxTypeId?: string | null;
  originalPackingTypeId?: string | null;
  finalPackingTypeId?: string | null;
  editTarget?: 'original' | 'final';
  editable?: boolean;
  onChange?: (change: PackageInfoChangeEvent) => void; // Callback when data changes
}

const OrderPackingInfo: React.FC<OrderPackingInfoProps> = ({ original, final, originalInfoId, finalInfoId, orderPackageId, originalBoxTypeId, finalBoxTypeId, originalPackingTypeId, finalPackingTypeId, editTarget = 'final', editable = true, onChange }) => {
  const [boxTypes, setBoxTypes] = useState<{ label: string; value: string }[]>([]);
  const [packTypes, setPackTypes] = useState<{ label: string; value: string; labelShort?: string; tooltip?: string }[]>([]);
  const [finalId, setFinalId] = useState<string | null>(finalInfoId || null);

  useEffect(() => {
    const load = async () => {
      const { data: boxes } = await db.getAllBoxTypes();
      setBoxTypes((boxes || []).map((m: any) => ({ label: m.name, value: m.id })));
      const { data: pts } = await db.getAllPackingTypes();
      setPackTypes((pts || []).map((t: any) => ({ label: `${t.code} - ${t.name}`, labelShort: t.code, tooltip: t.name, value: t.id })));
    };
    load();
  }, []);

  const ensureFinal = async (): Promise<string | null> => {
    if (finalId) return finalId;
    const { data, error } = await db.ensureFinalPackageInfo({ orderPackageId, finalInfoId, originalInfoId });
    if (error) {
      console.error('Error creating final package info:', error);
      const errorMsg = error?.message || error?.details || 'Failed to create final package info';
      Alert.alert('Error', `Failed to save: ${errorMsg}`);
      return null;
    }
    setFinalId(data?.id || null);
    return data?.id || null;
  };

  const save = async (fields: any) => {
    let targetId: string | null | undefined = null;
    if (editTarget === 'final') {
      targetId = await ensureFinal();
    } else {
      targetId = originalInfoId || null;
    }
    if (!targetId) {
      console.error('Cannot save: no target package info ID');
      return;
    }
    
    const { error } = await db.updatePackageInfo(targetId, fields);
    if (error) {
      console.error('Error updating package info:', error);
      const errorMsg = error?.message || error?.details || 'Failed to save changes';
      Alert.alert('Error', `Failed to save: ${errorMsg}`);
      return;
    }
    onChange?.({
      infoId: targetId,
      fields,
      orderPackageId,
      isFinal: editTarget === 'final',
      updatedFinalInfoId: editTarget === 'final' ? targetId : undefined,
      source: 'info'
    });
  };

  return (
    <View className="flex-row" style={{ flexWrap: 'nowrap' }}>
      {/* Use flex to ensure all 7 cards stay on one line and fill parent width */}
      <TwoTierEditableCard editTarget={editTarget} editable={editable} label="Quantity" original={original?.quantity ?? null} final={final?.quantity ?? null} type="number" onChange={(v) => save({ quantity: v })} flex={1} />
  <TwoTierEditableCard highlightChanges={false} editTarget={editTarget} editable={editable} label="S.E.I" original={original?.sei ?? null} final={final?.sei ?? null} type="select" selectItems={packTypes} onChange={(v) => save({ packing_type_id: v })} flex={1} finalSelectValue={finalPackingTypeId || null} defaultSelectValue={originalPackingTypeId || null} />
  <TwoTierEditableCard highlightChanges={false} editTarget={editTarget} editable={editable} label="Box Type" original={original?.boxType ?? null} final={final?.boxType ?? null} type="select" selectItems={boxTypes} onChange={(v) => save({ box_type_id: v })} flex={1.3} finalSelectValue={finalBoxTypeId || null} defaultSelectValue={originalBoxTypeId || null} />
      <TwoTierEditableCard editTarget={editTarget} editable={editable} label="Tare" original={original?.tare ?? null} final={final?.tare ?? null} type="number" onChange={(v) => save({ tare: v })} flex={1.2} />
      <TwoTierEditableCard editTarget={editTarget} editable={editable} label="Net Weight" original={original?.netWeight ?? null} final={final?.netWeight ?? null} type="number" onChange={(v) => save({ net_weight: v })} flex={1.3} />
      <TwoTierEditableCard editTarget={editTarget} editable={editable} label="Gross Weight" original={original?.grossWeight ?? null} final={final?.grossWeight ?? null} type="number" onChange={(v) => save({ gross_weight: v })} flex={1.3} />
      <TwoTierEditableCard editTarget={editTarget} editable={editable} label="Center of Gravity" original={original?.centerOfGravity ?? null} final={final?.centerOfGravity ?? null} type="switch" onChange={(v) => save({ center_of_gravity: !!v })} flex={1} />
    </View>
  );
};

export default OrderPackingInfo;
