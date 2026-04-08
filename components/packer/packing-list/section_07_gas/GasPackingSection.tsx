import React from "react";
import { View, Text } from "react-native";
import OrderPackageMaterialsSection, {
  AdditionalFieldConfig,
} from "../shared/materials/OrderPackageMaterialsSection";
import OrderPackageServicesSection from "../shared/services/OrderPackageServicesSection";
import CollapsibleCard from "../common/CollapsibleCard";

interface GasPackingSectionProps {
  orderPackageId: string;
  hideUseButton?: boolean;
  hideRemoveButton?: boolean;
  editable?: boolean;
}

const GasPackingSection: React.FC<GasPackingSectionProps> = ({
  orderPackageId,
  hideUseButton = false,
  hideRemoveButton = false,
  editable = true,
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
      if (!Number.isFinite(num) || num <= 0) return "Enter gas used (> 0)";
      return undefined;
    },
    transform: (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
    },
    column: {
      label: "Quantity of Gas Used",
      flex: 14,
    },
  };

  return (
    <View className="mt-4">
      <CollapsibleCard
        title="Gas Packing"
        containerClassName="border-gray-800 bg-emerald-50 mx-4"
        titleClassName=" text-xl font-bold"
        defaultOpen
      >
        <OrderPackageMaterialsSection
          orderPackageId={orderPackageId}
          title="Select laminate"
          materialType="Gas Packing"
          quantityLabel="in Bands"
          variantSources={[{ type: "material", value: "Laminate" }]}
          mediaDesignation="gas_packing"
          hideUseButton={hideUseButton}
          hideRemoveButton={hideRemoveButton}
          editable={editable}
          addPendingConfig={{
            autoTag: "Laminate",
            materialType: "Gas Packing",
          }}
        />

        <OrderPackageMaterialsSection
          orderPackageId={orderPackageId}
          title="Desiccant"
          materialType="Gas Packing"
          variantSources={[{ type: "material", value: "Desiccant" }]}
          mediaDesignation="gas_packing"
          hideUseButton={hideUseButton}
          hideRemoveButton={hideRemoveButton}
          editable={editable}
          addPendingConfig={{
            autoTag: "Desiccant",
            materialType: "Gas Packing",
          }}
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
          hideUseButton={hideUseButton}
          hideRemoveButton={hideRemoveButton}
          editable={editable}
          addPendingConfig={{ autoTag: "Gas", materialType: "Gas Packing" }}
        />

        <OrderPackageMaterialsSection
          orderPackageId={orderPackageId}
          title="Gas Accessories"
          materialType="Gas Packing"
          variantSources={[{ type: "tag", value: "gas accessories" }]}
          mediaDesignation="gas_packing"
          hideUseButton={hideUseButton}
          hideRemoveButton={hideRemoveButton}
          editable={editable}
          addPendingConfig={{
            autoTag: "Gas Accessories",
            materialType: "Gas Packing",
          }}
        />

        <OrderPackageServicesSection
          orderPackageId={orderPackageId}
          tag="Gas Packing"
          editable={editable}
        />
      </CollapsibleCard>
    </View>
  );
};

export default GasPackingSection;
