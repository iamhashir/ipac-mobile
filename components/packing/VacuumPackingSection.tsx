import React from 'react';
import { View, Text, TextInput } from 'react-native';
import CollapsibleCard from './common/CollapsibleCard';
import FilteredMaterialsSection from './FilteredMaterialsSection';

interface VacuumPackingSectionProps {
  orderPackageId: string;
}

const VacuumPackingSection: React.FC<VacuumPackingSectionProps> = ({ orderPackageId }) => {
  return (
    <View className="mx-4 mt-4 mb-4">
      <CollapsibleCard title="Vacuum packing" containerClassName="border-gray-500 bg-white" defaultOpen>
        <View className="px-2 pb-2">
          {/* Laminates */}
          <FilteredMaterialsSection
            orderPackageId={orderPackageId}
            title="Select laminate"
            materialTypeLabel="Laminate"
            quantityLabel="in Bands"
            sources={[{ type: 'tag', value: 'laminate' }, { type: 'tag', value: 'laminates' }, { type: 'material', value: 'laminate' }]}
          />

          {/* Desiccant */}
          <FilteredMaterialsSection
            orderPackageId={orderPackageId}
            title="Desiccant"
            materialTypeLabel="Desiccant"
            sources={[{ type: 'tag', value: 'desiccant' }, { type: 'material', value: 'desicant' }, { type: 'material', value: 'desiccant' }]}
          />

          {/* Vacuum Accessories */}
          <FilteredMaterialsSection
            orderPackageId={orderPackageId}
            title="Vacuum Accessories"
            materialTypeLabel="Vacuum Accessories"
            sources={[{ type: 'tag', value: 'vacuum' }, { type: 'tag', value: 'vacuum packing' }, { type: 'tag', value: 'vacuum_packing' }]}
          />

          {/* Service - placeholder input only; wire to DB later if needed */}
          <View className="bg-white rounded-xl border border-gray-400 p-3 m-1 self-start w-full">
            <View className="px-3 py-1 rounded-full self-start mb-2">
              <Text className="text-blue-800 text-xs font-semibold">Service</Text>
            </View>
            <View className="border border-gray-300 rounded-lg p-2">
              <TextInput placeholder="Electronic Humidity and temperature monitor" className="text-gray-800" />
            </View>
          </View>
        </View>
      </CollapsibleCard>
    </View>
  );
};

export default VacuumPackingSection;
