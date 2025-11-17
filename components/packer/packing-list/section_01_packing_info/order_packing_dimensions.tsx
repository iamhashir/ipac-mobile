import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { db } from '../../../../utils/api/supabase';
import DimensionsBox, { DimensionsTriple } from '../common/DimensionsBox';
import { PackageInfoChangeEvent } from './types';

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
  editable?: boolean;
  onChange?: (change: PackageInfoChangeEvent) => void; // Callback when data changes
}

type PartialTriple = Partial<DimensionsTriple>;

const OrderPackingDimensions: React.FC<OrderPackingDimensionsProps> = ({ orderPackageId, originalInfoId, finalInfoId, internal, external, editable = true, onChange }) => {
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
        if (res?.error) {
          console.error('Error saving dimensions:', res.error);
          const { Alert } = require('react-native');
          const errorMsg = res.error?.message || res.error?.details || 'Failed to save dimensions';
          Alert.alert('Error', `Failed to save: ${errorMsg}`);
        } else if (!finalId && res?.data?.final_pkg_info) {
          setFinalId(res.data.final_pkg_info);
        }
        const targetInfoId = res?.data?.final_pkg_info || finalId;
        if (targetInfoId) {
          onChange?.({
            infoId: targetInfoId,
            fields: scope === 'internal'
              ? {
                  internal_length: next.length ?? null,
                  internal_width: next.width ?? null,
                  internal_height: next.height ?? null,
                }
              : {
                  external_length: next.length ?? null,
                  external_width: next.width ?? null,
                  external_height: next.height ?? null,
                },
            orderPackageId,
            isFinal: true,
            updatedFinalInfoId: targetInfoId,
            scope,
            source: 'dimensions'
          });
        }
      }).catch((err: any) => {
        console.error('Unexpected error saving dimensions:', err);
        const { Alert } = require('react-native');
        Alert.alert('Error', 'Unexpected error while saving dimensions');
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
