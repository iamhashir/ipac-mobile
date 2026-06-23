import React from "react";
import { View } from "react-native";
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
      <OrderPackageMaterialsSection
        orderPackageId={orderPackageId}
        title="Cover"
        materialType="Defensor"
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
        addPendingConfig={{ autoTag: "Cover", materialType: "Defensor" }}
        hideInnerSectionTitle
      />
    </View>
  );
};

// Memoized: primitive props — skips re-render when parent rebuilds tab JSX.
export default React.memo(CoverSection);
