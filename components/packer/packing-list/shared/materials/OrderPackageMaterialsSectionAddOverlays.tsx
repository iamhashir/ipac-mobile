import React from "react";
import AnchoredSearchDropdown, {
  type AnchoredDropdownOption,
  type DropdownAnchorRect,
} from "./AnchoredSearchDropdown";
import { AddPendingMaterialModal } from "./AddPendingMaterialModal";
import {
  type AddPendingConfig,
  type VariantOption,
} from "./OrderPackageMaterialsSection.types";

interface PendingMaterialPayload {
  id: string;
  label: string;
  unitId?: string | null;
}

interface OrderPackageMaterialsSectionAddOverlaysProps {
  isEditable: boolean;
  addOpen: boolean;
  variants: VariantOption[];
  addPendingConfig?: AddPendingConfig;
  orderPackageId: string;
  materialType: string;
  showAddMaterialModal: boolean;
  setShowAddMaterialModal: React.Dispatch<React.SetStateAction<boolean>>;
  onPendingSuccess: (payload: PendingMaterialPayload) => Promise<void> | void;
  variantPickerOpen: boolean;
  setVariantPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  variantAnchor: DropdownAnchorRect | null;
  variantSearchQuery: string;
  setVariantSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filteredVariantOptions: AnchoredDropdownOption[];
  unitPickerOpen: boolean;
  setUnitPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  unitAnchor: DropdownAnchorRect | null;
  unitSearchQuery: string;
  setUnitSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filteredUnitOptions: AnchoredDropdownOption[];
  setFormVariant: React.Dispatch<React.SetStateAction<string | null>>;
  setFormIsPending: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingFormLabel: React.Dispatch<React.SetStateAction<string>>;
  setFormUnit: React.Dispatch<React.SetStateAction<string | null>>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>;
}

const OrderPackageMaterialsSectionAddOverlays: React.FC<
  OrderPackageMaterialsSectionAddOverlaysProps
> = ({
  isEditable,
  addOpen,
  variants,
  addPendingConfig,
  orderPackageId,
  materialType,
  showAddMaterialModal,
  setShowAddMaterialModal,
  onPendingSuccess,
  variantPickerOpen,
  setVariantPickerOpen,
  variantAnchor,
  variantSearchQuery,
  setVariantSearchQuery,
  filteredVariantOptions,
  unitPickerOpen,
  setUnitPickerOpen,
  unitAnchor,
  unitSearchQuery,
  setUnitSearchQuery,
  filteredUnitOptions,
  setFormVariant,
  setFormIsPending,
  setPendingFormLabel,
  setFormUnit,
  setErrors,
}) => {
  return (
    <>
      <AnchoredSearchDropdown
        visible={isEditable && addOpen && variantPickerOpen}
        anchorRect={variantAnchor}
        searchQuery={variantSearchQuery}
        onSearchQueryChange={setVariantSearchQuery}
        searchPlaceholder="Type to search items..."
        options={filteredVariantOptions}
        emptyText="No items found."
        onClose={() => setVariantPickerOpen(false)}
        onSelect={(option) => {
          const selectedVariant = variants.find((v) => v.value === option.key);
          if (!selectedVariant) return;

          setFormVariant(selectedVariant.value);
          setFormIsPending(false);
          setPendingFormLabel("");
          setErrors((prev) => ({ ...prev, variant: undefined }));

          const autoUnit = selectedVariant.unit_id || null;
          setFormUnit(autoUnit);
          setErrors((prev) => ({ ...prev, unit: undefined }));

          setVariantPickerOpen(false);
          setVariantSearchQuery("");
        }}
        footerAction={
          addPendingConfig
            ? {
                label: "Can't find it? Add new material",
                onPress: () => {
                  setVariantPickerOpen(false);
                  setShowAddMaterialModal(true);
                },
              }
            : undefined
        }
      />

      <AnchoredSearchDropdown
        visible={isEditable && addOpen && unitPickerOpen}
        anchorRect={unitAnchor}
        searchQuery={unitSearchQuery}
        onSearchQueryChange={setUnitSearchQuery}
        searchPlaceholder="Type to search units..."
        options={filteredUnitOptions}
        emptyText="No units found."
        onClose={() => setUnitPickerOpen(false)}
        onSelect={(option) => {
          setFormUnit(option.key);
          setErrors((prev) => ({ ...prev, unit: undefined }));
          setUnitPickerOpen(false);
          setUnitSearchQuery("");
        }}
      />

      {isEditable && addPendingConfig && (
        <AddPendingMaterialModal
          visible={showAddMaterialModal}
          onClose={() => setShowAddMaterialModal(false)}
          onSuccess={onPendingSuccess}
          orderPackageId={orderPackageId}
          autoTag={addPendingConfig.autoTag}
          materialType={addPendingConfig.materialType || materialType}
        />
      )}
    </>
  );
};

export default OrderPackageMaterialsSectionAddOverlays;
