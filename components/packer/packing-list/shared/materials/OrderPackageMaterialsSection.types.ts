import React from "react";

export type VariantSourceType = "tag" | "material" | "variantTag";

export interface VariantSource {
  type: VariantSourceType;
  value: string;
}

export interface VariantOption {
  label: string;
  value: string;
  unit_id?: string | null;
  unit_name?: string | null;
}

export interface AdditionalFieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  keyboard?: "default" | "numeric";
  validator?: (value: string) => string | undefined;
  transform?: (value: string) => any;
  column?: {
    label?: string;
    flex?: number;
    render?: (row: any) => React.ReactNode;
  };
}

export interface AddPendingConfig {
  autoTag: string;
  materialType?: string;
}

export interface CommentPreviewState {
  visible: boolean;
  text: string;
  title: string;
}

export interface OrderPackageMaterialsSectionProps {
  orderPackageId: string;
  title: string;
  materialType: string;
  variantSources?: VariantSource[];
  customVariantLoader?: () => Promise<VariantOption[]>;
  quantityLabel?: string;
  quantityPlaceholder?: string;
  addButtonLabel?: string;
  addModalTitle?: string;
  mediaDesignation?: string;
  addPendingConfig?: AddPendingConfig;
  restrictToAllowedVariants?: boolean;
  showDimensions?: boolean;
  showComment?: boolean;
  showCameraColumn?: boolean;
  hideUseButton?: boolean;
  hideRemoveButton?: boolean;
  additionalFields?: AdditionalFieldConfig[];
  editable?: boolean;
  hideInnerSectionTitle?: boolean;
}

export interface MaterialsRowFlex {
  item: number;
  quantity: number;
  unit: number;
  length: number;
  width: number;
  comment: number;
  actions: number;
  camera: number;
}

export const MATERIALS_ROW_FLEX: MaterialsRowFlex = {
  item: 28,
  quantity: 10,
  unit: 10,
  length: 8,
  width: 8,
  comment: 14,
  actions: 18,
  camera: 12,
};

export const EMPTY_ADDITIONAL_FIELDS: AdditionalFieldConfig[] = [];

export const normalizeVariant = (raw: any): VariantOption | null => {
  const value = raw?.value || raw?.id;
  if (!value) return null;
  const label = raw?.label || raw?.variant_name || raw?.name || "Unnamed";
  const unitId =
    raw?.unit_id ||
    raw?.materials?.unit_id ||
    raw?.units_of_measure?.id ||
    null;
  const unitName =
    raw?.unit_name ||
    raw?.materials?.units_of_measure?.name ||
    raw?.units_of_measure?.name ||
    null;

  return {
    label,
    value,
    unit_id: unitId,
    unit_name: unitName,
  };
};

export const roundToTwo = (value: number) => Math.round(value * 100) / 100;

export const formatNumeric = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const cast = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(cast)) return String(value);
  const rounded = roundToTwo(cast);
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
};
