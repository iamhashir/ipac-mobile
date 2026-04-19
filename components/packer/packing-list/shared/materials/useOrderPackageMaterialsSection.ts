import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { db } from "../../../../../utils/api/supabase";
import type {
  AnchoredDropdownOption,
  DropdownAnchorRect,
} from "./AnchoredSearchDropdown";
import {
  normalizeVariant,
  roundToTwo,
  type AdditionalFieldConfig,
  type CommentPreviewState,
  type VariantOption,
  type VariantSource,
} from "./OrderPackageMaterialsSection.types";

interface UseOrderPackageMaterialsSectionParams {
  orderPackageId: string;
  title: string;
  materialType: string;
  variantSources: VariantSource[];
  customVariantLoader?: () => Promise<VariantOption[]>;
  restrictToAllowedVariants: boolean;
  additionalFields: AdditionalFieldConfig[];
  showDimensions: boolean;
  showComment: boolean;
  mediaDesignation?: string;
  isEditable: boolean;
  cameraEnabled: boolean;
}

export const useOrderPackageMaterialsSection = ({
  orderPackageId,
  title,
  materialType,
  variantSources,
  customVariantLoader,
  restrictToAllowedVariants,
  additionalFields,
  showDimensions,
  showComment,
  mediaDesignation,
  isEditable,
  cameraEnabled,
}: UseOrderPackageMaterialsSectionParams) => {
  const [items, setItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [units, setUnits] = useState<{ label: string; value: string }[]>([]);
  const [variantUnitIdMap, setVariantUnitIdMap] = useState<
    Record<string, string | null>
  >({});

  const [addOpen, setAddOpen] = useState(false);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [variantAnchor, setVariantAnchor] = useState<DropdownAnchorRect | null>(
    null
  );
  const [unitAnchor, setUnitAnchor] = useState<DropdownAnchorRect | null>(null);
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
  const [unitSearchQuery, setUnitSearchQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [commentPreview, setCommentPreview] = useState<CommentPreviewState>({
    visible: false,
    text: "",
    title: "",
  });

  const variantTriggerRef = useRef<any>(null);
  const unitTriggerRef = useRef<any>(null);

  useEffect(() => {
    if (!isEditable) {
      setAddOpen(false);
      setVariantPickerOpen(false);
      setUnitPickerOpen(false);
      setVariantAnchor(null);
      setUnitAnchor(null);
      setShowAddMaterialModal(false);
    }
  }, [isEditable]);

  const additionalDefaults = useMemo(() => {
    const defaults: Record<string, string> = {};
    additionalFields.forEach((field) => {
      defaults[field.key] = "";
    });
    return defaults;
  }, [additionalFields]);

  const [formVariant, setFormVariant] = useState<string | null>(null);
  const [formIsPending, setFormIsPending] = useState(false);
  const [pendingFormLabel, setPendingFormLabel] = useState("");
  const [pendingLabelMap, setPendingLabelMap] = useState<Record<string, string>>(
    {}
  );
  const [formQuantity, setFormQuantity] = useState<string>("");
  const [formUnit, setFormUnit] = useState<string | null>(null);
  const [formLength, setFormLength] = useState<string>("");
  const [formWidth, setFormWidth] = useState<string>("");
  const [formComment, setFormComment] = useState<string>("");
  const [additionalValues, setAdditionalValues] = useState(additionalDefaults);

  useEffect(() => {
    setAdditionalValues(additionalDefaults);
  }, [additionalDefaults]);

  const variantSourcesKey = useMemo(
    () => JSON.stringify(variantSources ?? []),
    [variantSources]
  );

  const unitsMap = useMemo(() => {
    const map: Record<string, string> = {};
    (units || []).forEach((unit) => {
      map[unit.value] = unit.label;
    });
    return map;
  }, [units]);

  const variantLabelById = (id: string | null | undefined) => {
    if (!id) return "—";
    return variants.find((variant) => variant.value === id)?.label || "—";
  };

  const variantLabelForRow = (row: any) => {
    if (row.material_variant_id) return variantLabelById(row.material_variant_id);
    if (row.variant_request_id) {
      return (pendingLabelMap[row.variant_request_id] ?? "Pending...") + " 🕒";
    }
    return "—";
  };

  const fetchVariants = async (): Promise<VariantOption[]> => {
    if (customVariantLoader) {
      const custom = await customVariantLoader();
      return custom || [];
    }

    if (!variantSources.length) return [];

    const results = await Promise.all(
      variantSources.map(async (source) => {
        if (source.type === "tag") {
          const { data } = await db.getMaterialVariantsByTag(source.value);
          return data || [];
        }
        if (source.type === "variantTag") {
          const { data } = await db.getMaterialVariantsByVariantTag(source.value);
          return data || [];
        }
        if (source.type === "material") {
          const { data } = await db.getMaterialVariantsByMaterialExactName(
            source.value
          );
          return data || [];
        }
        return [];
      })
    );

    const flat = results.flat();
    const dedup = new Map<string, VariantOption>();
    flat.forEach((raw) => {
      const normalized = normalizeVariant(raw);
      if (normalized) {
        dedup.set(normalized.value, normalized);
      }
    });

    return Array.from(dedup.values());
  };

  const load = async () => {
    try {
      const [unitsResult, materialsResult, variantOptions] = (await Promise.all([
        db.getAllUnits(),
        db.getOrderPackageMaterials(orderPackageId),
        fetchVariants(),
      ])) as [
        { data: any[] | null },
        { data: any[] | null },
        VariantOption[]
      ];

      const { data: unitRows } = unitsResult;
      const { data: materialRows } = materialsResult;

      setVariants(variantOptions);
      setUnits(
        (unitRows || []).map((unit: any) => ({
          label: unit.name || unit.label,
          value: unit.id || unit.value,
        }))
      );

      const unitMap: Record<string, string | null> = {};
      (variantOptions || []).forEach((variant) => {
        unitMap[variant.value] = variant.unit_id || null;
      });
      setVariantUnitIdMap(unitMap);

      const pendingRequestIds = (materialRows || [])
        .filter((row: any) => !row.material_variant_id && row.variant_request_id)
        .map((row: any) => row.variant_request_id as string);

      if (pendingRequestIds.length > 0) {
        const { data: pendingRows } = await db.query
          .from("material_variant_requests")
          .select("id, variant_name")
          .in("id", pendingRequestIds);

        const labelMap: Record<string, string> = {};
        (pendingRows || []).forEach((pending: any) => {
          labelMap[pending.id] = pending.variant_name || "Pending...";
        });
        setPendingLabelMap(labelMap);
      } else {
        setPendingLabelMap({});
      }

      const allowedIds = new Set((variantOptions || []).map((opt) => opt.value));

      const filtered = (materialRows || []).filter((row: any) => {
        if (row.material_type !== materialType) return false;
        if (!row.material_variant_id && row.variant_request_id) return true;
        if (!restrictToAllowedVariants) return true;
        if (allowedIds.size === 0) return true;
        return allowedIds.has(row.material_variant_id);
      });

      setItems(filtered);
      return { variantUnitMap: unitMap };
    } catch (error) {
      console.log(`➡️ ${title}: Failed to load materials`, error);
      Alert.alert("Error", "Unable to load materials for this section.");
    }
  };

  useEffect(() => {
    setItems([]);
    load();
  }, [orderPackageId, variantSourcesKey, materialType]);

  const resetForm = () => {
    setFormVariant(null);
    setFormIsPending(false);
    setPendingFormLabel("");
    setFormQuantity("");
    setFormUnit(null);
    setFormLength("");
    setFormWidth("");
    setFormComment("");
    setVariantPickerOpen(false);
    setUnitPickerOpen(false);
    setVariantAnchor(null);
    setUnitAnchor(null);
    setVariantSearchQuery("");
    setUnitSearchQuery("");
    setAdditionalValues(additionalDefaults);
    setErrors({});
    setIsSaving(false);
  };

  const openDropdownFromTrigger = (
    triggerRef: React.RefObject<any>,
    setAnchor: React.Dispatch<React.SetStateAction<DropdownAnchorRect | null>>,
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    requestAnimationFrame(() => {
      const node = triggerRef.current;
      if (node && typeof node.measureInWindow === "function") {
        node.measureInWindow(
          (x: number, y: number, width: number, height: number) => {
            const nextAnchor: DropdownAnchorRect = {
              x: Number.isFinite(x) ? x : 8,
              y: Number.isFinite(y) ? y : 120,
              width: Number.isFinite(width) ? width : 280,
              height: Number.isFinite(height) ? height : 40,
            };
            setAnchor(nextAnchor);
            setOpen(true);
          }
        );
      } else {
        setOpen(true);
      }
    });
  };

  const toggleVariantPicker = () => {
    if (variantPickerOpen) {
      setVariantPickerOpen(false);
      return;
    }

    setUnitPickerOpen(false);
    openDropdownFromTrigger(variantTriggerRef, setVariantAnchor, setVariantPickerOpen);
  };

  const toggleUnitPicker = () => {
    if (unitPickerOpen) {
      setUnitPickerOpen(false);
      return;
    }

    setVariantPickerOpen(false);
    openDropdownFromTrigger(unitTriggerRef, setUnitAnchor, setUnitPickerOpen);
  };

  const filteredVariantOptions: AnchoredDropdownOption[] = useMemo(() => {
    return (variants || [])
      .filter((opt) => {
        if (!variantSearchQuery.trim()) return true;
        return opt.label.toLowerCase().includes(variantSearchQuery.toLowerCase());
      })
      .map((opt) => ({
        key: opt.value,
        label: opt.label,
        badge: opt.unit_id ? unitsMap[opt.unit_id as string] || "—" : undefined,
      }));
  }, [variants, variantSearchQuery, unitsMap]);

  const filteredUnitOptions: AnchoredDropdownOption[] = useMemo(() => {
    return (units || [])
      .filter((opt) => {
        if (!unitSearchQuery.trim()) return true;
        return opt.label.toLowerCase().includes(unitSearchQuery.toLowerCase());
      })
      .map((opt) => ({
        key: opt.value,
        label: opt.label,
      }));
  }, [units, unitSearchQuery]);

  const validate = () => {
    const quantityNumber = formQuantity ? Number(formQuantity) : NaN;
    const unitId = formUnit || (formVariant ? variantUnitIdMap[formVariant] : null);
    const nextErrors: Record<string, string> = {};

    if (!formVariant) nextErrors.variant = "Item is required";
    if (!formQuantity || !Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      nextErrors.quantity = "Enter a valid quantity (> 0)";
    }
    if (!unitId) nextErrors.unit = "Unit is required";

    additionalFields.forEach((field) => {
      const value = additionalValues[field.key];
      if (field.required && (!value || !value.trim())) {
        nextErrors[field.key] = `${field.label} is required`;
      }
      if (field.validator) {
        const message = field.validator(value ?? "");
        if (message) nextErrors[field.key] = message;
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveNew = async () => {
    if (!isEditable) return;
    if (!validate()) return;

    const quantityNumber = roundToTwo(Number(formQuantity));
    const unitIdToUse: string =
      formUnit || (variantUnitIdMap[formVariant as string] as string);

    const payload: any = {
      order_package_id: orderPackageId,
      material_variant_id: formIsPending ? null : formVariant,
      variant_request_id: formIsPending ? formVariant : null,
      material_type: materialType,
      is_final: true,
      quantity: quantityNumber,
      unit_id: unitIdToUse,
      length: showDimensions
        ? formLength
          ? roundToTwo(Number(formLength))
          : null
        : null,
      width: showDimensions
        ? formWidth
          ? roundToTwo(Number(formWidth))
          : null
        : null,
      comment: showComment ? formComment || null : null,
      item_used: false,
    };

    additionalFields.forEach((field) => {
      const rawValue = additionalValues[field.key];
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        payload[field.key] = null;
      } else if (field.transform) {
        payload[field.key] = field.transform(rawValue);
      } else if (field.keyboard === "numeric") {
        const parsed = Number(rawValue);
        payload[field.key] = Number.isFinite(parsed) ? roundToTwo(parsed) : rawValue;
      } else {
        payload[field.key] = rawValue;
      }
    });

    try {
      setIsSaving(true);
      const { data, error } = await db.addOrderPackageMaterial(payload);
      if (error) {
        const message =
          error?.message || error?.details || error?.hint || "Failed to add item";
        Alert.alert("Error", String(message));
        return;
      }

      if (formIsPending && formVariant && pendingFormLabel) {
        setPendingLabelMap((prev) => ({ ...prev, [formVariant]: pendingFormLabel }));
      }

      const allowedIds = new Set((variants || []).map((opt) => opt.value));
      const shouldIncludeRow = (() => {
        if (!data) return false;
        if (data.material_type !== materialType) return false;
        if (!data.material_variant_id && data.variant_request_id) return true;
        if (!restrictToAllowedVariants) return true;
        if (allowedIds.size === 0) return true;
        return allowedIds.has(data.material_variant_id);
      })();

      if (data && shouldIncludeRow) {
        setItems((prev) => [...prev, data]);
      } else {
        await load();
      }

      setAddOpen(false);
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const markUsed = async (id: string) => {
    if (!isEditable) return;

    const { error } = await db.updateOrderPackageMaterial(id, {
      item_used: true,
    });

    if (error) {
      Alert.alert("Error", "Failed to update item used");
    } else {
      setItems((prev) =>
        prev.map((row) => (row.id === id ? { ...row, item_used: true } : row))
      );
    }
  };

  const removeRow = async (id: string) => {
    if (!isEditable) return;

    Alert.alert("Remove item", "Are you sure you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await db.deleteOrderPackageMaterial(id);
          if (error) {
            Alert.alert("Error", "Failed to delete");
          } else {
            setItems((prev) => prev.filter((row) => row.id !== id));
          }
        },
      },
    ]);
  };

  const uploadAsset = async (uri: string, row: any) => {
    if (!mediaDesignation || !isEditable) return;

    try {
      const materialName = variantLabelById(row.material_variant_id);
      const notes = `${title}: ${materialName} (Qty: ${row.quantity || 0})`;
      const { error } = await db.uploadMediaToStorage(
        orderPackageId,
        uri,
        mediaDesignation,
        notes
      );
      if (error) {
        Alert.alert("Upload failed", "Could not upload image to storage.");
      } else {
        Alert.alert("Uploaded", "Image uploaded successfully.");
      }
    } catch {
      Alert.alert("Upload error", "Unexpected error while uploading.");
    }
  };

  const pickFromGallery = async (row: any) => {
    if (!isEditable) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Media library access is needed.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length) {
      await uploadAsset(result.assets[0].uri, row);
    }
  };

  const takePhoto = async (row: any) => {
    if (!isEditable) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera access is needed.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets && result.assets.length) {
      await uploadAsset(result.assets[0].uri, row);
    }
  };

  const handleCameraPress = async (row: any) => {
    if (!cameraEnabled || !isEditable) return;

    Alert.alert("Attach image", "Choose source", [
      { text: "Gallery", onPress: () => pickFromGallery(row) },
      { text: "Camera", onPress: () => takePhoto(row) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openCommentModal = (row: any) => {
    const text = row?.comment?.trim() || "No comment provided.";
    const modalTitle = variantLabelById(row?.material_variant_id) || "Comment";
    setCommentPreview({ visible: true, text, title: modalTitle });
  };

  const closeCommentModal = () => {
    setCommentPreview({ visible: false, text: "", title: "" });
  };

  const handleToggleAdd = () => {
    if (!isEditable) return;

    if (addOpen) {
      setAddOpen(false);
      resetForm();
      return;
    }

    setAddOpen(true);
  };

  const handleCancelAdd = () => {
    setAddOpen(false);
    resetForm();
  };

  const handleQuantityChange = (value: string) => {
    setFormQuantity(value);
    setErrors((prev) => ({ ...prev, quantity: undefined }));
  };

  const handleAdditionalChange = (key: string, value: string) => {
    setAdditionalValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handlePendingMaterialSuccess = async (payload: {
    id: string;
    label: string;
    unitId?: string | null;
  }) => {
    await load();
    setFormVariant(payload.id);
    setFormIsPending(true);
    setPendingFormLabel(payload.label);
    if (payload.unitId) {
      setFormUnit(payload.unitId);
      setErrors((prev) => ({ ...prev, unit: undefined }));
    }
    setErrors((prev) => ({ ...prev, variant: undefined }));
    setShowAddMaterialModal(false);
    setAddOpen(true);
  };

  return {
    items,
    variants,
    unitsMap,
    addOpen,
    variantPickerOpen,
    setVariantPickerOpen,
    unitPickerOpen,
    setUnitPickerOpen,
    variantAnchor,
    unitAnchor,
    variantSearchQuery,
    setVariantSearchQuery,
    unitSearchQuery,
    setUnitSearchQuery,
    errors,
    setErrors,
    isSaving,
    showAddMaterialModal,
    setShowAddMaterialModal,
    commentPreview,
    variantTriggerRef,
    unitTriggerRef,
    formVariant,
    setFormVariant,
    formIsPending,
    setFormIsPending,
    pendingFormLabel,
    setPendingFormLabel,
    formQuantity,
    formUnit,
    setFormUnit,
    formLength,
    setFormLength,
    formWidth,
    setFormWidth,
    formComment,
    setFormComment,
    additionalValues,
    filteredVariantOptions,
    filteredUnitOptions,
    variantLabelById,
    variantLabelForRow,
    toggleVariantPicker,
    toggleUnitPicker,
    saveNew,
    markUsed,
    removeRow,
    handleCameraPress,
    openCommentModal,
    closeCommentModal,
    handleToggleAdd,
    handleCancelAdd,
    handleQuantityChange,
    handleAdditionalChange,
    handlePendingMaterialSuccess,
  };
};
