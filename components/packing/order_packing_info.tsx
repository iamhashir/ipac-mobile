import React, { useEffect, useMemo, useState } from 'react';
import { View, Alert } from 'react-native';
import TwoTierEditableCard from './common/TwoTierEditableCard';
import { db } from '../../utils/api/supabase';

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
}

const OrderPackingInfo: React.FC<OrderPackingInfoProps> = ({ original, final, originalInfoId, finalInfoId, orderPackageId, originalBoxTypeId, finalBoxTypeId, originalPackingTypeId, finalPackingTypeId }) => {
  const [materials, setMaterials] = useState<{ label: string; value: string }[]>([]);
  const [packTypes, setPackTypes] = useState<{ label: string; value: string; labelShort?: string; tooltip?: string }[]>([]);
  const [finalId, setFinalId] = useState<string | null>(finalInfoId || null);

  useEffect(() => {
    const load = async () => {
      const { data: mats } = await db.getAllMaterials();
      setMaterials((mats || []).map((m: any) => ({ label: m.name, value: m.id })));
      const { data: pts } = await db.getAllPackingTypes();
      setPackTypes((pts || []).map((t: any) => ({ label: `${t.code} - ${t.name}`, labelShort: t.code, tooltip: t.name, value: t.id })));
    };
    load();
  }, []);

  const ensureFinal = async (): Promise<string | null> => {
    if (finalId) return finalId;
    const { data, error } = await db.ensureFinalPackageInfo({ orderPackageId, finalInfoId, originalInfoId });
    if (error) { Alert.alert('Error', 'Failed to create final package info'); return null; }
    setFinalId(data?.id || null);
    return data?.id || null;
  };

  const save = async (fields: any) => {
    const id = await ensureFinal();
    if (!id) return;
    await db.updatePackageInfo(id, fields);
  };

  return (
    <View className="flex-row flex-wrap">
      <TwoTierEditableCard label="Quantity" original={original?.quantity ?? null} final={final?.quantity ?? null} type="number" onChange={(v) => save({ quantity: v })} width={160} />
      <TwoTierEditableCard label="S.E.I" original={original?.sei ?? null} final={final?.sei ?? null} type="select" selectItems={packTypes} onChange={(v) => save({ packing_type_id: v })} width={200} finalSelectValue={finalPackingTypeId || null} defaultSelectValue={originalPackingTypeId || null} />
      <TwoTierEditableCard label="Box Type" original={original?.boxType ?? null} final={final?.boxType ?? null} type="select" selectItems={materials} onChange={(v) => save({ box_type_id: v })} width={200} finalSelectValue={finalBoxTypeId || null} defaultSelectValue={originalBoxTypeId || null} />
      <TwoTierEditableCard label="Tare" original={original?.tare ?? null} final={final?.tare ?? null} type="number" onChange={(v) => save({ tare: v })} width={160} />
      <TwoTierEditableCard label="Net Weight" original={original?.netWeight ?? null} final={final?.netWeight ?? null} type="number" onChange={(v) => save({ net_weight: v })} width={160} />
      <TwoTierEditableCard label="Gross Weight" original={original?.grossWeight ?? null} final={final?.grossWeight ?? null} type="number" onChange={(v) => save({ gross_weight: v })} width={160} />
      <TwoTierEditableCard label="Center of Gravity" original={original?.centerOfGravity ?? null} final={final?.centerOfGravity ?? null} type="switch" onChange={(v) => save({ center_of_gravity: !!v })} width={200} />
    </View>
  );
};

export default OrderPackingInfo;
