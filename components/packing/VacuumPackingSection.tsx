import React from "react";
import { View, Text, TextInput } from "react-native";
import OrderPackageMaterialsSection from "./OrderPackageMaterialsSection";

interface VacuumPackingSectionProps {
  orderPackageId: string;
}

const VacuumPackingSection: React.FC<VacuumPackingSectionProps> = ({
  orderPackageId,
}) => {
  return (
    <View className="mt-4">
      <View className="mx-4 mb-2">
        <Text className="text-xl font-semibold text-gray-900">
          Vacuum packing
        </Text>
      </View>

      <OrderPackageMaterialsSection
        orderPackageId={orderPackageId}
        title="Select laminate"
        materialType="Vacuum Packing"
        quantityLabel="in Bands"
        variantSources={[{ type: "material", value: "Laminate" }]}
        mediaDesignation="vacuum_packing"
        addPendingConfig={{
          autoTag: "Laminate",
          materialType: "Vacuum Packing",
        }}
      />

      <OrderPackageMaterialsSection
        orderPackageId={orderPackageId}
        title="Desiccant"
        materialType="Vacuum Packing"
        variantSources={[{ type: "material", value: "Desiccant" }]}
        mediaDesignation="vacuum_packing"
        addPendingConfig={{
          autoTag: "Desiccant",
          materialType: "Vacuum Packing",
        }}
      />

      <OrderPackageMaterialsSection
        orderPackageId={orderPackageId}
        title="Vacuum Accessories"
        materialType="Vacuum Packing"
        variantSources={[{ type: "tag", value: "Vacuum Accessories" }]}
        mediaDesignation="vacuum_packing"
        addPendingConfig={{
          autoTag: "Vacuum Accessories",
          materialType: "Vacuum Packing",
        }}
      />

      <View className="bg-white rounded-xl border border-gray-400 p-3 mx-4 my-2">
        <View className="px-3 py-1 rounded-full self-start mb-2">
          <Text className="text-blue-800 text-xs font-semibold">Service</Text>
        </View>
        <View className="border border-gray-300 rounded-lg p-2">
          <TextInput
            placeholder="Electronic Humidity and temperature monitor"
            className="text-gray-800"
          />
        </View>
      </View>
    </View>
  );
};

export default VacuumPackingSection;
