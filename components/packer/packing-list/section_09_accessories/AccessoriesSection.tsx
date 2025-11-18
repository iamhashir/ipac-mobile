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
  editable?: boolean;
}

const AccessoriesSection: React.FC<AccessoriesSectionProps> = ({
  orderPackageId,
  title = "Accessories",
  variantTag = "Accessories",
  materialType = "Accessories",
  addModalAutoTag,
  mediaDesignation = "accessory",
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
      editable={editable}
      addPendingConfig={addPendingConfig}
    />
  );
};

export default AccessoriesSection;
