import React, { useEffect, useMemo, useState } from 'react';
import { View, Alert, useWindowDimensions, DimensionValue } from 'react-native';
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
  useSeiFlow?: boolean;
  requiresOriginalFirst?: boolean;
  onChange?: (change: PackageInfoChangeEvent) => void; // Callback when data changes
}

const OrderPackingInfo: React.FC<OrderPackingInfoProps> = ({ original, final, originalInfoId, finalInfoId, orderPackageId, originalBoxTypeId, finalBoxTypeId, originalPackingTypeId, finalPackingTypeId, editTarget = 'final', editable = true, useSeiFlow = false, requiresOriginalFirst = false, onChange }) => {
  const [boxTypes, setBoxTypes] = useState<{ label: string; value: string }[]>([]);
  const [packTypes, setPackTypes] = useState<{ label: string; value: string; labelShort?: string; tooltip?: string }[]>([]);
  const [finalId, setFinalId] = useState<string | null>(finalInfoId || null);
  const [seiCategoryOptions, setSeiCategoryOptions] = useState<{ label: string; value: string; tooltip?: string }[]>([]);
  const [seiProtectionOptions, setSeiProtectionOptions] = useState<{ label: string; value: string; tooltip?: string }[]>([]);
  const [originalSeiCategoryId, setOriginalSeiCategoryId] = useState<string | null>(null);
  const [finalSeiCategoryId, setFinalSeiCategoryId] = useState<string | null>(null);
  const [originalSeiProtectionId, setOriginalSeiProtectionId] = useState<string | null>(null);
  const [finalSeiProtectionId, setFinalSeiProtectionId] = useState<string | null>(null);

  useEffect(() => {
    setFinalId(finalInfoId || null);
  }, [finalInfoId, orderPackageId]);

  useEffect(() => {
    const load = async () => {
      const { data: boxes } = await db.getAllBoxTypes();
      setBoxTypes((boxes || []).map((m: any) => ({ label: m.name, value: m.id })));
      const { data: pts } = await db.getAllPackingTypes();
      setPackTypes((pts || []).map((t: any) => ({ label: `${t.code} - ${t.name}`, labelShort: t.code, tooltip: t.name, value: t.id })));

      if (useSeiFlow) {
        const [{ data: categories }, { data: protections }] = await Promise.all([
          db.getSeiCategories(),
          db.getSeiProtections(),
        ]);

        setSeiCategoryOptions(
          (categories || []).map((row: any) => ({
            value: String(row.id),
            label: row.code === null || row.code === undefined ? row.name : `${row.code} - ${row.name}`,
            tooltip: row.description || undefined,
          }))
        );

        setSeiProtectionOptions(
          (protections || []).map((row: any) => ({
            value: String(row.id),
            label: `${row.code} - ${row.name}`,
            tooltip: row.description || undefined,
          }))
        );
      }
    };
    load();
  }, [useSeiFlow]);

  useEffect(() => {
    if (!useSeiFlow) return;

    const infoIds = [originalInfoId, finalInfoId].filter(Boolean) as string[];
    if (infoIds.length === 0) return;

    const loadSei = async () => {
      const { data, error } = await db.getPackageInfosByIds(infoIds as any);
      if (error) {
        console.log('➡️ OrderPackingInfo: failed loading package_info SEI fields', error);
        return;
      }

      const rows = data || [];
      const lookup = new Map((rows as any[]).map((row: any) => [row.id, row]));
      const originalRow = originalInfoId ? lookup.get(originalInfoId) : null;
      const finalRow = finalInfoId ? lookup.get(finalInfoId) : null;

      setOriginalSeiCategoryId(originalRow?.sei_category !== null && originalRow?.sei_category !== undefined ? String(originalRow.sei_category) : null);
      setFinalSeiCategoryId(finalRow?.sei_category !== null && finalRow?.sei_category !== undefined ? String(finalRow.sei_category) : null);
      setOriginalSeiProtectionId(originalRow?.sei_protection !== null && originalRow?.sei_protection !== undefined ? String(originalRow.sei_protection) : null);
      setFinalSeiProtectionId(finalRow?.sei_protection !== null && finalRow?.sei_protection !== undefined ? String(finalRow.sei_protection) : null);
    };

    loadSei();
  }, [useSeiFlow, originalInfoId, finalInfoId]);

  const ensureFinal = async (): Promise<string | null> => {
    if (finalId) return finalId;
    if (!orderPackageId) {
      console.warn('Cannot create final package info without orderPackageId');
      return null;
    }
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

  const save = async (fields: any, targetTier: 'original' | 'final' = editTarget) => {
    let targetId: string | null | undefined = null;
    if (targetTier === 'final') {
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
      isFinal: targetTier === 'final',
      updatedFinalInfoId: targetTier === 'final' ? targetId : undefined,
      source: 'info'
    });
  };

  const getSelectLabel = (value: string | null, options: { label: string; value: string }[]) => {
    if (!value) return null;
    return options.find((option) => option.value === value)?.label || null;
  };

  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const rowStyle = isMobile ? { flexWrap: 'wrap' as const, flexDirection: 'row' as const, marginHorizontal: -4 } : { flexWrap: 'nowrap' as const, flexDirection: 'row' as const };
  const cardStyle = isMobile ? { width: '25%' as DimensionValue, paddingHorizontal: 2, marginBottom: 8 } : undefined;

  const resolveTier = () => {
    return editTarget;
  };

  const quantityTier = resolveTier();
  const seiTier = resolveTier();
  const boxTypeTier = resolveTier();
  const tareTier = resolveTier();
  const netTier = resolveTier();
  const grossTier = resolveTier();
  const cogTier = resolveTier();
  const seiCategoryTier = resolveTier();
  const seiProtectionTier = resolveTier();

  return (
    <View style={rowStyle}>
      {/* Use flex to ensure all 7 cards stay on one line and fill parent width */}
      <View style={cardStyle} className={!isMobile ? "flex-1" : ""}>
        <TwoTierEditableCard editTarget={quantityTier} editable={editable} label="Quantity" original={original?.quantity ?? null} final={final?.quantity ?? null} type="number" onChange={(v, tier) => save({ quantity: v }, tier || quantityTier)} />
      </View>
      {useSeiFlow ? (
        <>
          <View style={cardStyle} className={!isMobile ? "flex-1" : ""}>
             <TwoTierEditableCard
               highlightChanges={false}
               editTarget={seiCategoryTier}
               editable={editable}
               label="SEI Category"
               original={getSelectLabel(originalSeiCategoryId, seiCategoryOptions) || '—'}
               final={getSelectLabel(finalSeiCategoryId, seiCategoryOptions) || '—'}
               type="select"
               selectItems={seiCategoryOptions}
               onChange={(value, tier) => {
                 const resolvedTier = tier || seiCategoryTier;
                 const cast = value ? Number(value) : null;
                 if (resolvedTier === 'final') {
                   setFinalSeiCategoryId(value || null);
                 } else {
                   setOriginalSeiCategoryId(value || null);
                 }
                 save({ sei_category: Number.isFinite(cast as number) ? cast : null }, resolvedTier);
               }}
               finalSelectValue={finalSeiCategoryId}
               defaultSelectValue={originalSeiCategoryId}
             />
          </View>
          <View style={cardStyle} className={!isMobile ? "flex-1" : ""}>
            <TwoTierEditableCard
              highlightChanges={false}
              editTarget={seiProtectionTier}
              editable={editable}
              label="SEI Protection"
              original={getSelectLabel(originalSeiProtectionId, seiProtectionOptions) || '—'}
              final={getSelectLabel(finalSeiProtectionId, seiProtectionOptions) || '—'}
              type="select"
              selectItems={seiProtectionOptions}
              onChange={(value, tier) => {
                const resolvedTier = tier || seiProtectionTier;
                const cast = value ? Number(value) : null;
                if (resolvedTier === 'final') {
                  setFinalSeiProtectionId(value || null);
                } else {
                  setOriginalSeiProtectionId(value || null);
                }
                save({ sei_protection: Number.isFinite(cast as number) ? cast : null }, resolvedTier);
              }}
              finalSelectValue={finalSeiProtectionId}
              defaultSelectValue={originalSeiProtectionId}
            />
          </View>
        </>
      ) : (
        <View style={cardStyle} className={!isMobile ? "flex-1" : ""}>
          <TwoTierEditableCard highlightChanges={false} editTarget={seiTier} editable={editable} label="S.E.I" original={original?.sei ?? null} final={final?.sei ?? null} type="select" selectItems={packTypes} onChange={(v, tier) => save({ packing_type_id: v }, tier || seiTier)} finalSelectValue={finalPackingTypeId || null} defaultSelectValue={originalPackingTypeId || null} />
        </View>
      )}
      <View style={cardStyle} className={!isMobile ? "flex-1" : ""}>
        <TwoTierEditableCard highlightChanges={false} editTarget={boxTypeTier} editable={editable} label="Box Type" original={original?.boxType ?? null} final={final?.boxType ?? null} type="select" selectItems={boxTypes} onChange={(v, tier) => save({ box_type_id: v }, tier || boxTypeTier)} finalSelectValue={finalBoxTypeId || null} defaultSelectValue={originalBoxTypeId || null} />
      </View>
      <View style={cardStyle} className={!isMobile ? "flex-1" : ""}>
        <TwoTierEditableCard editTarget={tareTier} editable={editable} label="Tare" original={original?.tare ?? null} final={final?.tare ?? null} type="number" onChange={(v, tier) => save({ tare: v }, tier || tareTier)} />
      </View>
      <View style={cardStyle} className={!isMobile ? "flex-1" : ""}>
        <TwoTierEditableCard editTarget={netTier} editable={editable} label="Net Weight" original={original?.netWeight ?? null} final={final?.netWeight ?? null} type="number" onChange={(v, tier) => save({ net_weight: v }, tier || netTier)} />
      </View>
      <View style={cardStyle} className={!isMobile ? "flex-1" : ""}>
        <TwoTierEditableCard editTarget={grossTier} editable={editable} label="Gross Weight" original={original?.grossWeight ?? null} final={final?.grossWeight ?? null} type="number" onChange={(v, tier) => save({ gross_weight: v }, tier || grossTier)} />
      </View>
      <View style={cardStyle} className={!isMobile ? "flex-1" : ""}>
        <TwoTierEditableCard editTarget={cogTier} editable={editable} label="Center of Gravity" original={original?.centerOfGravity ?? null} final={final?.centerOfGravity ?? null} type="switch" onChange={(v, tier) => save({ center_of_gravity: !!v }, tier || cogTier)} />
      </View>
    </View>
  );
};

export default OrderPackingInfo;
