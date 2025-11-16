import React from "react";
import { View, Text } from "react-native";
import OrderPackageMaterialsSection, {
  AdditionalFieldConfig,
} from "./OrderPackageMaterialsSection";

interface GasPackingSectionProps {
  orderPackageId: string;
}

const GasPackingSection: React.FC<GasPackingSectionProps> = ({
  orderPackageId,
}) => {
  const gasUsageField: AdditionalFieldConfig = {
    key: "quantity_used",
    label: "Quantity of Gas Used",
    placeholder: "e.g. 10",
    required: true,
    keyboard: "numeric",
    validator: (value) => {
      if (!value?.trim()) return "Quantity of Gas Used is required";
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0)
        return "Enter gas used (> 0)";
      return undefined;
    },
    transform: (value) => Number(value),
    column: {
      label: "Quantity of Gas Used",
      flex: 14,
    },
  };

  return (
    <View className="mt-4">
      <View className="mx-4 mb-2">
        <Text className="text-xl font-semibold text-gray-900">
          Gas packing
        </Text>
      </View>

      <OrderPackageMaterialsSection
        orderPackageId={orderPackageId}
        title="Select laminate"
        materialType="Gas Packing"
        quantityLabel="in Bands"
        variantSources={[{ type: "material", value: "Laminate" }]}
        mediaDesignation="gas_packing"
        addPendingConfig={{ autoTag: "Laminate", materialType: "Gas Packing" }}
      />

      <OrderPackageMaterialsSection
        orderPackageId={orderPackageId}
        title="Desiccant"
        materialType="Gas Packing"
        variantSources={[{ type: "material", value: "Desiccant" }]}
        mediaDesignation="gas_packing"
        addPendingConfig={{ autoTag: "Desiccant", materialType: "Gas Packing" }}
      />

      <OrderPackageMaterialsSection
        orderPackageId={orderPackageId}
        title="Gas"
        materialType="Gas Packing"
        variantSources={[{ type: "material", value: "Gas" }]}
        quantityLabel="Quantity of cylinder"
        quantityPlaceholder="e.g. 1"
        addButtonLabel="Add gas"
        addModalTitle="Add gas"
        mediaDesignation="gas_packing"
        showDimensions={false}
        additionalFields={[gasUsageField]}
        addPendingConfig={{ autoTag: "Gas", materialType: "Gas Packing" }}
      />

      <OrderPackageMaterialsSection
        orderPackageId={orderPackageId}
        title="Gas Accessories"
        materialType="Gas Packing"
        variantSources={[{ type: "tag", value: "gas accessories" }]}
        mediaDesignation="gas_packing"
        addPendingConfig={{
          autoTag: "Gas Accessories",
          materialType: "Gas Packing",
        }}
      />
    </View>
  );
};

export default GasPackingSection;