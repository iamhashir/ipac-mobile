import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { db } from '../../utils/api/supabase';
import DimensionsBox, { DimensionsTriple } from './common/DimensionsBox';

export interface OrderPackingDimensionsProps {
  orderPackageId: string;
  originalInfoId: string | null;
  finalInfoId: string | null;
  internal: {
    original: DimensionsTriple | null | undefined;
    final: DimensionsTriple | null | undefined;
  };
  external: {
    original: DimensionsTriple | null | undefined;
    final: DimensionsTriple | null | undefined;
  };
}

type PartialTriple = Partial<DimensionsTriple>;

const OrderPackingDimensions: React.FC<OrderPackingDimensionsProps> = ({ orderPackageId, originalInfoId, finalInfoId, internal, external }) => {
  // Local mirror of final dimensions to make inputs controlled and responsive
  const [currentFinal, setCurrentFinal] = useState<{ internal: DimensionsTriple | null; external: DimensionsTriple | null }>({
    internal: internal?.final || null,
    external: external?.final || null,
  });
  const [finalId, setFinalId] = useState<string | null>(finalInfoId || null);
  useEffect(() => { setFinalId(finalInfoId || null); }, [finalInfoId]);
  useEffect(() => {
    setCurrentFinal({ internal: internal?.final || null, external: external?.final || null });
  }, [internal?.final, external?.final]);

  const commit = async (scope: 'internal' | 'external', patch: PartialTriple) => {
    // 1) Update UI immediately
    setCurrentFinal(prev => {
      const base = (prev as any)[scope] || { length: null, width: null, height: null };
      const next = { ...base, ...patch } as DimensionsTriple;
      // Fire-and-forget upsert (auto-save behavior)
      void db.upsertFinalDimensions({
        orderPackageId,
        finalInfoId: finalId,
        originalInfoId,
        scope,
        length: next.length,
        width: next.width,
        height: next.height,
      }).then((res: any) => {
        if (!finalId && res?.data?.final_pkg_info) {
          setFinalId(res.data.final_pkg_info);
        }
      });
      return { ...prev, [scope]: next } as any;
    });
  };

  return (
    <View className="flex-row" style={{ flexWrap: 'nowrap' }}>
      <DimensionsBox
        heading="Internal Dimensions"
        original={internal?.original}
        final={currentFinal.internal}
        onChangeFinal={(patch) => commit('internal', patch)}
      />
      <DimensionsBox
        heading="External Dimensions"
        original={external?.original}
        final={currentFinal.external}
        onChangeFinal={(patch) => commit('external', patch)}
      />
    </View>
  );
};

export default OrderPackingDimensions;
