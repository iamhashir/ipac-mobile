import React from 'react';
import { View } from 'react-native';
import CollapsibleCard from './common/CollapsibleCard';
import FilteredMaterialsSection from './FilteredMaterialsSection';
import GasMaterialsSection from './GasMaterialsSection';

interface GasPackingSectionProps {
  orderPackageId: string;
}

const GasPackingSection: React.FC<GasPackingSectionProps> = ({ orderPackageId }) => {
  return (
    <View className="mx-4 mt-4 mb-4">
      <CollapsibleCard title="Gas packing" containerClassName="border-gray-500 bg-white" defaultOpen>
        <View className="px-2 pb-2">
          {/* Laminates */}
          <FilteredMaterialsSection
            orderPackageId={orderPackageId}
            title="Select laminate"
            materialTypeLabel="Gas Packing"
            quantityLabel="in Bands"
            sources={[{ type: 'material', value: 'Laminate' }]}
            mediaDesignation="gas_packing"
          />

          {/* Desiccant */}
          <FilteredMaterialsSection
            orderPackageId={orderPackageId}
            title="Desiccant"
            materialTypeLabel="Gas Packing"
            sources={[{ type: 'material', value: 'Desiccant' }]}
            mediaDesignation="gas_packing"
          />

          {/* Gas (new subsection) */}
          <GasMaterialsSection orderPackageId={orderPackageId} />

          {/* Gas Accessories */}
          <FilteredMaterialsSection
            orderPackageId={orderPackageId}
            title="Gas Accessories"
            materialTypeLabel="Gas Packing"
            sources={[{ type: 'tag', value: 'gas accessories' }]}
            mediaDesignation="gas_packing"
          />
        </View>
      </CollapsibleCard>
    </View>
  );
};

export default GasPackingSection;