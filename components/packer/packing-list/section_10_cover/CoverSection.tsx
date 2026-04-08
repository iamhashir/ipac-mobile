import React from "react";
import { View } from "react-native";
import CollapsibleCard from "../common/CollapsibleCard";
import OrderPackageMaterialsSection from "../shared/materials/OrderPackageMaterialsSection";

interface CoverSectionProps {
  orderPackageId: string;
  editable?: boolean;
  hideUseButton?: boolean;
  hideRemoveButton?: boolean;
}

const CoverSection: React.FC<CoverSectionProps> = ({
  orderPackageId,
  editable = true,
  hideUseButton = false,
  hideRemoveButton = false,
}) => {
  return (
    <View className="mt-4">
      <CollapsibleCard
        title="Cover"
        containerClassName="border-gray-500 bg-amber-50 mx-4"
        titleClassName=" text-xl font-bold"
        defaultOpen
      >
        <OrderPackageMaterialsSection
          orderPackageId={orderPackageId}
          title="Cover Materials"
          materialType="Cover"
          variantSources={[
            { type: "material", value: "Defensor" },
            { type: "material", value: "Tarpaulin" },
            { type: "material", value: "Tarpulin" },
            { type: "material", value: "Heatshrink" },
          ]}
          quantityLabel="Qty"
          mediaDesignation="cover"
          editable={editable}
          hideUseButton={hideUseButton}
          hideRemoveButton={hideRemoveButton}
          addPendingConfig={{ autoTag: "Cover", materialType: "Cover" }}
        />
      </CollapsibleCard>
    </View>
  );
};

export default CoverSection;
