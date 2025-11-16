import React from "react";
import OrderPackageMaterialsSection, {
  VariantSource,
} from "./OrderPackageMaterialsSection";

type SourceSpec = {
  type: "tag" | "material";
  value: string;
};

interface FilteredMaterialsSectionProps {
  orderPackageId: string;
  title: string;
  sources: SourceSpec[];
  quantityLabel?: string;
  materialTypeLabel: string;
  mediaDesignation?: string;
}

const FilteredMaterialsSection: React.FC<FilteredMaterialsSectionProps> = ({
  orderPackageId,
  title,
  sources,
  quantityLabel = "Quantity",
  materialTypeLabel,
  mediaDesignation,
}) => {
  const variantSources: VariantSource[] = sources.map((source) =>
    source.type === "material"
      ? { type: "material", value: source.value }
      : { type: "tag", value: source.value }
  );

  const autoTag =
    title === "Gas Accessories"
      ? "Gas Accessories"
      : title === "Vacuum Accessories"
      ? "Vacuum Accessories"
      : materialTypeLabel;

  const addPendingConfig = autoTag
    ? { autoTag, materialType: materialTypeLabel }
    : undefined;

  return (
    <OrderPackageMaterialsSection
      orderPackageId={orderPackageId}
      title={title}
      materialType={materialTypeLabel}
      variantSources={variantSources as VariantSource[]}
      quantityLabel={quantityLabel}
      mediaDesignation={mediaDesignation}
      addPendingConfig={addPendingConfig}
    />
  );
};

export default FilteredMaterialsSection;

