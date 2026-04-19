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
  editTarget?: 'original' | 'final';
  allowFinalEdit?: boolean;
  requiresOriginalFirst?: boolean;
  editable?: boolean;
  onChange?: (change: PackageInfoChangeEvent) => void; // Callback when data changes
}

type PartialTriple = Partial<DimensionsTriple>;

const clampTwoDecimals = (value: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
};

const OrderPackingDimensions: React.FC<OrderPackingDimensionsProps> = ({
  orderPackageId,
  originalInfoId,
  finalInfoId,
  internal,
  external,
  editTarget = 'final',
  allowFinalEdit = true,
  requiresOriginalFirst = false,
  editable = true,
  onChange,
}) => {
  const [currentOriginal, setCurrentOriginal] = useState<{ internal: DimensionsTriple | null; external: DimensionsTriple | null }>({
    internal: internal?.original || null,
    external: external?.original || null,
  });

  // Local mirror of final dimensions to make inputs controlled and responsive
  const [currentFinal, setCurrentFinal] = useState<{ internal: DimensionsTriple | null; external: DimensionsTriple | null }>({
    internal: internal?.final || null,
    external: external?.final || null,
  });
  const [finalId, setFinalId] = useState<string | null>(finalInfoId || null);

  useEffect(() => { setFinalId(finalInfoId || null); }, [finalInfoId]);

  useEffect(() => {
    setCurrentOriginal({ internal: internal?.original || null, external: external?.original || null });
  }, [internal?.original, external?.original]);

  useEffect(() => {
    setCurrentFinal({ internal: internal?.final || null, external: external?.final || null });
  }, [internal?.final, external?.final]);

  const commit = async (scope: 'internal' | 'external', patch: PartialTriple, targetTier: 'original' | 'final') => {
    const normalizedPatch: PartialTriple = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'length')) {
      normalizedPatch.length = clampTwoDecimals(patch.length ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'width')) {
      normalizedPatch.width = clampTwoDecimals(patch.width ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'height')) {
      normalizedPatch.height = clampTwoDecimals(patch.height ?? null);
    }

    if (targetTier === 'original') {
      if (!originalInfoId) return;

      setCurrentOriginal((prev) => {
        const base = (prev as any)[scope] || { length: null, width: null, height: null };
        const next = { ...base, ...normalizedPatch } as DimensionsTriple;

        const fields =
          scope === 'internal'
            ? {
                internal_length: next.length ?? null,
                internal_width: next.width ?? null,
                internal_height: next.height ?? null,
              }
            : {
                external_length: next.length ?? null,
                external_width: next.width ?? null,
                external_height: next.height ?? null,
              };

        void db.updatePackageInfo(originalInfoId, fields).then((res: any) => {
          if (res?.error) {
            console.error('Error saving original dimensions:', res.error);
            const { Alert } = require('react-native');
            const errorMsg = res.error?.message || res.error?.details || 'Failed to save dimensions';
            Alert.alert('Error', `Failed to save: ${errorMsg}`);
            return;
          }

          onChange?.({
            infoId: originalInfoId,
            fields,
            orderPackageId,
            isFinal: false,
            scope,
            source: 'dimensions',
          });
        }).catch((err: any) => {
          console.error('Unexpected error saving original dimensions:', err);
          const { Alert } = require('react-native');
          Alert.alert('Error', 'Unexpected error while saving dimensions');
        });

        return { ...prev, [scope]: next } as any;
      });
      return;
    }

    // Final tier updates
    setCurrentFinal((prev) => {
      const base = (prev as any)[scope] || { length: null, width: null, height: null };
      const next = { ...base, ...normalizedPatch } as DimensionsTriple;
      // Fire-and-forget upsert (auto-save behavior)
      void db
        .upsertFinalDimensions({
          orderPackageId,
          finalInfoId: finalId,
          originalInfoId,
          scope,
          length: next.length,
          width: next.width,
          height: next.height,
        })
        .then((res: any) => {
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
              fields:
                scope === 'internal'
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
              source: 'dimensions',
            });
          }
        })
        .catch((err: any) => {
          console.error('Unexpected error saving dimensions:', err);
          const { Alert } = require('react-native');
          Alert.alert('Error', 'Unexpected error while saving dimensions');
        });
      return { ...prev, [scope]: next } as any;
    });
  };

  const internalTarget: 'original' | 'final' = editTarget;

  const externalTarget: 'original' | 'final' = editTarget;

  const internalAllowFinal = allowFinalEdit;
  const externalAllowFinal = allowFinalEdit;

  return (
    <View className="flex-row" style={{ flexWrap: 'nowrap' }}>
      <DimensionsBox
        heading="Internal Dimensions"
        original={currentOriginal.internal}
        final={currentFinal.internal}
        onChangeOriginal={(patch) => commit('internal', patch, 'original')}
        onChangeFinal={(patch) => commit('internal', patch, 'final')}
        editTarget={internalTarget}
        enableFinalEdit={internalAllowFinal}
        editable={editable}
      />
      <DimensionsBox
        heading="External Dimensions"
        original={currentOriginal.external}
        final={currentFinal.external}
        onChangeOriginal={(patch) => commit('external', patch, 'original')}
        onChangeFinal={(patch) => commit('external', patch, 'final')}
        editTarget={externalTarget}
        enableFinalEdit={externalAllowFinal}
        editable={editable}
      />
    </View>
  );
};

export default OrderPackingDimensions;
