import React from 'react';
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

const OrderPackingDimensions: React.FC<OrderPackingDimensionsProps> = ({ orderPackageId, originalInfoId, finalInfoId, internal, external }) => {
  const makeSaver = (scope: 'internal' | 'external') => async (d: DimensionsTriple) => {
    await db.upsertFinalDimensions({
      orderPackageId,
      finalInfoId,
      originalInfoId,
      scope,
      length: d.length,
      width: d.width,
      height: d.height,
    });
  };

  return (
    <View className="flex-row flex-wrap">
      <DimensionsBox
        heading="Internal Dimensions"
        original={internal?.original}
        final={internal?.final}
        onSaveFinal={makeSaver('internal')}
      />
      <DimensionsBox
        heading="External Dimensions"
        original={external?.original}
        final={external?.final}
        onSaveFinal={makeSaver('external')}
      />
    </View>
  );
};

export default OrderPackingDimensions;
