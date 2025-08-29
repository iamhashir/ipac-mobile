import React from 'react';
import { View, Text } from 'react-native';
import OrderPackingInfo, { BoxInfoDetails } from './order_packing_info';
import OrderPackingDimensions, { DimensionsTriple } from './order_packing_dimensions';
import OrderPackingItems from './order_packing_items';

interface BoxInfoPair {
  original: BoxInfoDetails | null;
  final: BoxInfoDetails | null;
}

interface DimensionPair { original: DimensionsTriple | null; final: DimensionsTriple | null; }

interface BoxDetailsTabProps {
  orderPackageId: string;
  packageNumber: number | null;
  description?: string | null;
  info?: BoxInfoPair;
  dimensions?: {
    internal: DimensionPair;
    external: DimensionPair;
  };
  originalPkgInfoId?: string | null;
  finalPkgInfoId?: string | null;
  onAttachPics?: (item: { order_package_id: string; designation: string | null; quantity: number | null }) => void;
  originalBoxTypeId?: string | null;
  finalBoxTypeId?: string | null;
  originalPackingTypeId?: string | null;
  finalPackingTypeId?: string | null;
}

const BoxDetailsTab: React.FC<BoxDetailsTabProps> = ({ orderPackageId, packageNumber, description, info, dimensions, originalPkgInfoId, finalPkgInfoId, onAttachPics, originalBoxTypeId, finalBoxTypeId, originalPackingTypeId, finalPackingTypeId }) => {
  return (
    <View className="bg-white rounded-b-lg p-4">
      <Text className="text-lg font-semibold text-gray-800">Box #{packageNumber ?? '—'}</Text>
      {description ? (
        <Text className="text-gray-600 mt-2">{description}</Text>
      ) : (
        <Text className="text-gray-500 mt-2">No description provided.</Text>
      )}

      {/* Packing Info cards */}
      <View className="mt-4">
        <OrderPackingInfo
          original={info?.original || null}
          final={info?.final || null}
          originalInfoId={originalPkgInfoId || null}
          finalInfoId={finalPkgInfoId || null}
          orderPackageId={orderPackageId}
          originalBoxTypeId={originalBoxTypeId || null}
          finalBoxTypeId={finalBoxTypeId || null}
          originalPackingTypeId={originalPackingTypeId || null}
          finalPackingTypeId={finalPackingTypeId || null}
        />
      </View>

      {/* Dimensions boxes */}
      <View className="mt-4">
        <OrderPackingDimensions 
          orderPackageId={orderPackageId}
          originalInfoId={originalPkgInfoId || null}
          finalInfoId={finalPkgInfoId || null}
          internal={dimensions?.internal || { original: null, final: null }}
          external={dimensions?.external || { original: null, final: null }}
        />
      </View>

      {/* Packing Items */}
      <View className="mt-4">
        <OrderPackingItems orderPackageId={orderPackageId} onAttachPics={onAttachPics} />
      </View>
    </View>
  );
};

export default BoxDetailsTab;

