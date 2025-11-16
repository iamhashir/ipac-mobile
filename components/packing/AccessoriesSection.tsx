import React from "react";
import OrderPackageMaterialsSection, {
  VariantSource,
} from "./OrderPackageMaterialsSection";

interface AccessoriesSectionProps {
  orderPackageId: string;
  title?: string;
  variantTag?: string;
  materialType?: string;
  addModalAutoTag?: string;
  itemLabel?: string;
  mediaDesignation?: string;
}

const AccessoriesSection: React.FC<AccessoriesSectionProps> = ({
  orderPackageId,
  title = "Accessories",
  variantTag = "accessories",
  materialType = "Accessories",
  addModalAutoTag,
  mediaDesignation = "accessory",
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
      addPendingConfig={addPendingConfig}
    />
  );
};

export default AccessoriesSection;
