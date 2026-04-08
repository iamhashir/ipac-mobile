import React from "react";
import { View, Text, TextInput } from "react-native";
import OrderPackageMaterialsSection from "../shared/materials/OrderPackageMaterialsSection";
import OrderPackageServicesSection from "../shared/services/OrderPackageServicesSection";
import CollapsibleCard from "../common/CollapsibleCard";

interface VacuumPackingSectionProps {
  orderPackageId: string;
  hideUseButton?: boolean;
  hideRemoveButton?: boolean;
  editable?: boolean;
}

const VacuumPackingSection: React.FC<VacuumPackingSectionProps> = ({
  orderPackageId,
  hideUseButton = false,
  hideRemoveButton = false,
  editable = true,
}) => {
  const canEdit = editable !== false;
  return (
    <View className="mt-4">
      <CollapsibleCard
        title="Vacuum Packing"
		titleClassName=" text-xl font-bold"
        containerClassName="border-gray-500 bg-indigo-50 mx-4"
        defaultOpen
      >
        <OrderPackageMaterialsSection
          orderPackageId={orderPackageId}
          title="Select laminate"
          materialType="Vacuum Packing"
          quantityLabel="in Bands"
          variantSources={[{ type: "material", value: "Laminate" }]}
          mediaDesignation="vacuum_packing"
          hideUseButton={hideUseButton}
          hideRemoveButton={hideRemoveButton}
          editable={canEdit}
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
          hideUseButton={hideUseButton}
          hideRemoveButton={hideRemoveButton}
          editable={canEdit}
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
          hideUseButton={hideUseButton}
          hideRemoveButton={hideRemoveButton}
          editable={canEdit}
          addPendingConfig={{
            autoTag: "Vacuum Accessories",
            materialType: "Vacuum Packing",
          }}
        />

        <OrderPackageServicesSection
          orderPackageId={orderPackageId}
          tag="Vacuum Packing"
          editable={canEdit}
        />
      </CollapsibleCard>
    </View>
  );
};

export default VacuumPackingSection;
