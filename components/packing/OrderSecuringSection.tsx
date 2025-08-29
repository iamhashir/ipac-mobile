import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import CollapsibleCard from './common/CollapsibleCard';
import GroupBox from './common/GroupBox';
import TwoTierEditableCard from './common/TwoTierEditableCard';
import { db } from '../../utils/api/supabase';

interface OrderSecuringSectionProps {
  orderPackageId: string;
}

type Side = 'big_sides' | 'small_sides' | 'lid' | 'base';

const smallWidth = 160;
const typeWideWidth = 240;

const OrderSecuringSection: React.FC<OrderSecuringSectionProps> = ({ orderPackageId }) => {
  const [materials, setMaterials] = useState<{ label: string; value: string }[]>([]);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: mats } = await db.getAllMaterials();
      setMaterials((mats || []).map((m: any) => ({ label: m.name, value: m.id })));
      const { data } = await db.getSecuringForPackage(orderPackageId);
      setData(data || []);
    };
    init();
  }, [orderPackageId]);

  const bySide = useMemo(() => {
    const map: Record<Side, { original: any | null; final: any | null }> = {
      big_sides: { original: null, final: null },
      small_sides: { original: null, final: null },
      lid: { original: null, final: null },
      base: { original: null, final: null },
    };
    (data || []).forEach((row: any) => {
      const key = row.securing_side as Side;
      if (!key) return;
      if (row.is_final) map[key].final = row;
      else map[key].original = row;
    });
    return map;
  }, [data]);

  const templateField = (row: any, field: string) => row?.securing_template ? row.securing_template[field] : null;
  const materialNameById = (id: string | null | undefined) => {
    const item = materials.find(m => m.value === id);
    return item?.label || '—';
  };

  const renderSide = (title: string, side: Side) => {
    const orig = bySide[side].original;
    const fin = bySide[side].final;
    const tmplOrig = orig?.securing_template;
    const tmplFin = fin?.securing_template;

    const saveTemplate = async (fields: any) => {
      if (!tmplFin?.id) return;
      await db.updateSecuringTemplate(tmplFin.id, fields);
    };

    const saveBeam = async (beamKey: 'horizontal_bar' | 'vertical_bar' | 'skids', fields: any) => {
      const beam = tmplFin?.[beamKey];
      if (!beam?.id) return;
      await db.updateBeam(beam.id, fields);
    };

    return (
      <CollapsibleCard key={side} title={title} containerClassName="bg-white border-gray-500 mx-4 mb-4" defaultOpen>
        {/* Top row: Quantity | Type | Thickness */}
        <View className="flex-row flex-wrap">
          <TwoTierEditableCard label="Quantity" original={tmplOrig?.quantity ?? null} final={tmplFin?.quantity ?? null} type="number" onChange={(v) => saveTemplate({ quantity: v })} width={smallWidth} />
          <TwoTierEditableCard label="Type" original={materialNameById(tmplOrig?.type_id)} final={materialNameById(tmplFin?.type_id)} type="select" selectItems={materials} onChange={(v) => saveTemplate({ type_id: v })} width={typeWideWidth} finalSelectValue={tmplFin?.type_id || null} defaultSelectValue={tmplOrig?.type_id || null} />
          <TwoTierEditableCard label="Thickness" original={tmplOrig?.thickness ?? null} final={tmplFin?.thickness ?? null} type="number" onChange={(v) => saveTemplate({ thickness: v })} width={smallWidth} />
        </View>

        {/* Horizontal Bars */}
        <GroupBox title="Horizontal bars">
          <View className="flex-row flex-wrap">
            <TwoTierEditableCard label="Quantity" original={tmplOrig?.horizontal_bar?.quantity ?? null} final={tmplFin?.horizontal_bar?.quantity ?? null} type="number" onChange={(v) => saveBeam('horizontal_bar', { quantity: v })} width={smallWidth} />
            <TwoTierEditableCard label="Type" original={materialNameById(tmplOrig?.horizontal_bar?.type)} final={materialNameById(tmplFin?.horizontal_bar?.type)} type="select" selectItems={materials} onChange={(v) => saveBeam('horizontal_bar', { type: v })} width={smallWidth} finalSelectValue={tmplFin?.horizontal_bar?.type || null} defaultSelectValue={tmplOrig?.horizontal_bar?.type || null} />
            <TwoTierEditableCard label="Space" original={tmplOrig?.horizontal_bar?.space ?? null} final={tmplFin?.horizontal_bar?.space ?? null} type="number" onChange={(v) => saveBeam('horizontal_bar', { space: v })} width={smallWidth} />
            <TwoTierEditableCard label="Width" original={tmplOrig?.horizontal_bar?.width ?? null} final={tmplFin?.horizontal_bar?.width ?? null} type="number" onChange={(v) => saveBeam('horizontal_bar', { width: v })} width={smallWidth} />
            <TwoTierEditableCard label="Thickness" original={tmplOrig?.horizontal_bar?.thickness ?? null} final={tmplFin?.horizontal_bar?.thickness ?? null} type="number" onChange={(v) => saveBeam('horizontal_bar', { thickness: v })} width={smallWidth} />
          </View>
        </GroupBox>

        {/* Vertical Bars */}
        <GroupBox title="Vertical bars">
          <View className="flex-row flex-wrap">
            <TwoTierEditableCard label="Quantity" original={tmplOrig?.vertical_bar?.quantity ?? null} final={tmplFin?.vertical_bar?.quantity ?? null} type="number" onChange={(v) => saveBeam('vertical_bar', { quantity: v })} width={smallWidth} />
            <TwoTierEditableCard label="Type" original={materialNameById(tmplOrig?.vertical_bar?.type)} final={materialNameById(tmplFin?.vertical_bar?.type)} type="select" selectItems={materials} onChange={(v) => saveBeam('vertical_bar', { type: v })} width={smallWidth} finalSelectValue={tmplFin?.vertical_bar?.type || null} defaultSelectValue={tmplOrig?.vertical_bar?.type || null} />
            <TwoTierEditableCard label="Space" original={tmplOrig?.vertical_bar?.space ?? null} final={tmplFin?.vertical_bar?.space ?? null} type="number" onChange={(v) => saveBeam('vertical_bar', { space: v })} width={smallWidth} />
            <TwoTierEditableCard label="Width" original={tmplOrig?.vertical_bar?.width ?? null} final={tmplFin?.vertical_bar?.width ?? null} type="number" onChange={(v) => saveBeam('vertical_bar', { width: v })} width={smallWidth} />
            <TwoTierEditableCard label="Thickness" original={tmplOrig?.vertical_bar?.thickness ?? null} final={tmplFin?.vertical_bar?.thickness ?? null} type="number" onChange={(v) => saveBeam('vertical_bar', { thickness: v })} width={smallWidth} />
          </View>
        </GroupBox>

        {/* Skids for Base only */}
        {side === 'base' && (
          <GroupBox title="Skids">
            <View className="flex-row flex-wrap">
              <TwoTierEditableCard label="Quantity" original={tmplOrig?.skids?.quantity ?? null} final={tmplFin?.skids?.quantity ?? null} type="number" onChange={(v) => saveBeam('skids', { quantity: v })} width={smallWidth} />
              <TwoTierEditableCard label="Type" original={materialNameById(tmplOrig?.skids?.type)} final={materialNameById(tmplFin?.skids?.type)} type="select" selectItems={materials} onChange={(v) => saveBeam('skids', { type: v })} width={smallWidth} finalSelectValue={tmplFin?.skids?.type || null} defaultSelectValue={tmplOrig?.skids?.type || null} />
              <TwoTierEditableCard label="Thickness" original={tmplOrig?.skids?.thickness ?? null} final={tmplFin?.skids?.thickness ?? null} type="number" onChange={(v) => saveBeam('skids', { thickness: v })} width={smallWidth} />
            </View>
          </GroupBox>
        )}
      </CollapsibleCard>
    );
  };

  return (
    <View className="mt-2 mb-6">
      <Text className="text-gray-800 font-semibold mx-4 mb-2">Securing</Text>
      {renderSide('Big sides', 'big_sides')}
      {renderSide('Small sides', 'small_sides')}
      {renderSide('Lid', 'lid')}
      {renderSide('Base', 'base')}
    </View>
  );
};

export default OrderSecuringSection;
