import React from "react";
import OrderPackageMaterialsSection, {
  VariantSource,
} from "../shared/materials/OrderPackageMaterialsSection";

interface AccessoriesSectionProps {
  orderPackageId: string;
  title?: string;
  variantTag?: string;
  materialType?: string;
  addModalAutoTag?: string;
  itemLabel?: string;
  mediaDesignation?: string;
  hideUseButton?: boolean;
  hideRemoveButton?: boolean;
  editable?: boolean;
}

const AccessoriesSection: React.FC<AccessoriesSectionProps> = ({
  orderPackageId,
  title = "Accessories",
  variantTag = "Accessories",
  materialType = "Accessories",
  addModalAutoTag,
  mediaDesignation = "accessory",
  hideUseButton = false,
  hideRemoveButton = false,
  editable = true,
}) => {
  const sources: VariantSource[] = variantTag
    ? [{ type: "variantTag", value: variantTag }]
    : [];

  const addPendingConfig = (addModalAutoTag ?? title)
    ? {
        autoTag: addModalAutoTag ?? title,
        materialType,
      }
    : undefined;

  return (
    <OrderPackageMaterialsSection
      orderPackageId={orderPackageId}
      title={title}
      materialType={materialType}
      variantSources={sources}
      addButtonLabel="Add item"
      quantityLabel="Qty"
      quantityPlaceholder="e.g. 1"
      mediaDesignation={mediaDesignation}
      hideUseButton={hideUseButton}
      hideRemoveButton={hideRemoveButton}
      editable={editable}
      addPendingConfig={addPendingConfig}
    />
  );
};

// Memoized: primitive props — skips re-render when parent rebuilds tab JSX.
export default React.memo(AccessoriesSection);
