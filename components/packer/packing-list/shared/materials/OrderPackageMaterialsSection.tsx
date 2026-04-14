import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Keyboard,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import CollapsibleCard from "../../common/CollapsibleCard";
import { db } from "../../../../../utils/api/supabase";
import { Check, X, ChevronDown, Camera } from "lucide-react-native";
import { AddPendingMaterialModal } from "./AddPendingMaterialModal";
import AnchoredSearchDropdown, {
  AnchoredDropdownOption,
  DropdownAnchorRect,
} from "./AnchoredSearchDropdown";

export type VariantSourceType = "tag" | "material" | "variantTag";

export interface VariantSource {
  type: VariantSourceType;
  value: string;
}

interface VariantOption {
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

interface AddPendingConfig {
  autoTag: string;
  materialType?: string;
}

interface CommentPreviewState {
  visible: boolean;
  text: string;
  title: string;
}

const EMPTY_ADDITIONAL_FIELDS: AdditionalFieldConfig[] = [];

interface OrderPackageMaterialsSectionProps {
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

const normalizeVariant = (raw: any): VariantOption | null => {
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

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const formatNumeric = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const cast = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(cast)) return String(value);
  const rounded = roundToTwo(cast);
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

const OrderPackageMaterialsSection: React.FC<
  OrderPackageMaterialsSectionProps
> = ({
  orderPackageId,
  title,
  materialType,
  variantSources = [],
  customVariantLoader,
  quantityLabel = "Qty",
  quantityPlaceholder = "e.g. 1",
  addButtonLabel = "Add item",
  addModalTitle,
  mediaDesignation,
  addPendingConfig,
  restrictToAllowedVariants = true,
  showDimensions = true,
  showComment = true,
  showCameraColumn,
  hideUseButton = false,
  hideRemoveButton = false,
  additionalFields = EMPTY_ADDITIONAL_FIELDS,
  editable = true,
  hideInnerSectionTitle = false,
}) => {
  const isEditable = editable !== false;
  const resolvedModalTitle =
    addModalTitle ?? `Add ${title?.toLowerCase?.() ?? title}`;
  const cameraEnabled =
    mediaDesignation && (showCameraColumn ?? true) ? true : false;

  const [items, setItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [units, setUnits] = useState<{ label: string; value: string }[]>([]);
  const [variantUnitIdMap, setVariantUnitIdMap] = useState<
    Record<string, string | null>
  >({});

  const [addOpen, setAddOpen] = useState(false);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [variantAnchor, setVariantAnchor] = useState<DropdownAnchorRect | null>(null);
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
  const [pendingFormLabel, setPendingFormLabel] = useState('');
  const [pendingLabelMap, setPendingLabelMap] = useState<Record<string, string>>({});
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
    const m: Record<string, string> = {};
    (units || []).forEach((u) => {
      m[u.value] = u.label;
    });
    return m;
  }, [units]);

  const variantLabelById = (id: string | null | undefined) => {
    if (!id) return "—";
    return variants.find((v) => v.value === id)?.label || "—";
  };

  const variantLabelForRow = (row: any) => {
    if (row.material_variant_id) return variantLabelById(row.material_variant_id);
    if (row.variant_request_id) {
      return (pendingLabelMap[row.variant_request_id] ?? 'Pending...') + ' 🕒';
    }
    return '—';
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
          const { data } = await db.getMaterialVariantsByVariantTag(
            source.value
          );
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

      const { data: u } = unitsResult;
      const { data: rows } = materialsResult;

      setVariants(variantOptions);
      setUnits(
        (u || []).map((x: any) => ({
          label: x.name || x.label,
          value: x.id || x.value,
        }))
      );

      const vMap: Record<string, string | null> = {};
      (variantOptions || []).forEach((opt) => {
        vMap[opt.value] = opt.unit_id || null;
      });
      setVariantUnitIdMap(vMap);

      // Fetch labels for pending variant rows
      const pendingRequestIds = (rows || [])
        .filter((r: any) => !r.material_variant_id && r.variant_request_id)
        .map((r: any) => r.variant_request_id as string);
      if (pendingRequestIds.length > 0) {
        const { data: pendingRows } = await db.query
          .from('material_variant_requests')
          .select('id, variant_name')
          .in('id', pendingRequestIds);
        const labelMap: Record<string, string> = {};
        (pendingRows || []).forEach((pr: any) => {
          labelMap[pr.id] = pr.variant_name || 'Pending...';
        });
        setPendingLabelMap(labelMap);
      } else {
        setPendingLabelMap({});
      }

      const allowedIds = new Set(
        (variantOptions || []).map((opt) => opt.value)
      );

      const filtered = (rows || []).filter((row: any) => {
        if (row.material_type !== materialType) return false;
        // Always show pending rows (they have no material_variant_id)
        if (!row.material_variant_id && row.variant_request_id) return true;
        if (!restrictToAllowedVariants) return true;
        if (allowedIds.size === 0) return true;
        return allowedIds.has(row.material_variant_id);
      });
      setItems(filtered);
      return { variantUnitMap: vMap };
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
    setPendingFormLabel('');
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
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          const nextAnchor: DropdownAnchorRect = {
            x: Number.isFinite(x) ? x : 8,
            y: Number.isFinite(y) ? y : 120,
            width: Number.isFinite(width) ? width : 280,
            height: Number.isFinite(height) ? height : 40,
          };
          setAnchor(nextAnchor);
          setOpen(true);
        });
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
    const qtyNum = formQuantity ? Number(formQuantity) : NaN;
    const unitId =
      formUnit || (formVariant ? variantUnitIdMap[formVariant] : null);
    const nextErrs: Record<string, string> = {};
    if (!formVariant) nextErrs.variant = "Item is required";
    if (!formQuantity || !Number.isFinite(qtyNum) || qtyNum <= 0)
      nextErrs.quantity = "Enter a valid quantity (> 0)";
    if (!unitId) nextErrs.unit = "Unit is required";

    additionalFields.forEach((field) => {
      const value = additionalValues[field.key];
      if (field.required && (!value || !value.trim())) {
        nextErrs[field.key] = `${field.label} is required`;
      }
      if (field.validator) {
        const message = field.validator(value ?? "");
        if (message) nextErrs[field.key] = message;
      }
    });

    setErrors(nextErrs);
    return Object.keys(nextErrs).length === 0;
  };

  const saveNew = async () => {
    if (!isEditable) return;
    if (!validate()) return;

    const qtyNum = roundToTwo(Number(formQuantity));
    const unitIdToUse: string =
      formUnit || (variantUnitIdMap[formVariant as string] as string);

    const payload: any = {
      order_package_id: orderPackageId,
      material_variant_id: formIsPending ? null : formVariant,
      variant_request_id: formIsPending ? formVariant : null,
      material_type: materialType,
      is_final: true,
      quantity: qtyNum,
      unit_id: unitIdToUse,
      length: showDimensions ? (formLength ? roundToTwo(Number(formLength)) : null) : null,
      width: showDimensions ? (formWidth ? roundToTwo(Number(formWidth)) : null) : null,
      comment: showComment ? formComment || null : null,
      item_used: false,
    };

    additionalFields.forEach((field) => {
      const rawValue = additionalValues[field.key];
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        payload[field.key] = null;
      } else if (field.transform) {
        payload[field.key] = field.transform(rawValue);
      } else if (field.keyboard === 'numeric') {
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
        const msg =
          error?.message || error?.details || error?.hint || "Failed to add item";
        Alert.alert("Error", String(msg));
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
    if (error) Alert.alert("Error", "Failed to update item used");
    else {
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
          if (error) Alert.alert("Error", "Failed to delete");
          else {
            setItems((prev) => prev.filter((row) => row.id !== id));
          }
        },
      },
    ]);
  };

  const handleCameraPress = async (row: any) => {
    if (!cameraEnabled || !isEditable) return;
    Alert.alert("Attach image", "Choose source", [
      { text: "Gallery", onPress: () => pickFromGallery(row) },
      { text: "Camera", onPress: () => takePhoto(row) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickFromGallery = async (row: any) => {
    if (!isEditable) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Media library access is needed.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri, row);
    }
  };

  const takePhoto = async (row: any) => {
    if (!isEditable) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera access is needed.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri, row);
    }
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
    } catch (e) {
      Alert.alert("Upload error", "Unexpected error while uploading.");
    }
  };

  const additionalColumns = additionalFields
    .filter((field) => field.column)
    .map((field) => ({
      key: field.key,
      label: field.column?.label || field.label,
      flex: field.column?.flex ?? 10,
      render: field.column?.render,
    }));

  const FLEX = {
    item: 28,
    quantity: 10,
    unit: 10,
    length: 8,
    width: 8,
    comment: 14,
    actions: 18,
    camera: 12,
  };

  const formatDimensionValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "—";
    return formatNumeric(value);
  };

  const openCommentModal = (row: any) => {
    const text = row?.comment?.trim() || "No comment provided.";
    const title = variantLabelById(row?.material_variant_id) || "Comment";
    setCommentPreview({ visible: true, text, title });
  };

  const closeCommentModal = () =>
    setCommentPreview({ visible: false, text: "", title: "" });

  const HeaderRow = () => {
    return (
    <View className="flex-row items-center bg-white/70 border border-gray-300 rounded px-2 py-2">
      <View style={{ flex: FLEX.item }}>
        <Text className="text-xs font-semibold text-gray-700">Item</Text>
      </View>
      <View style={{ flex: FLEX.quantity }}>
        <Text className="text-xs font-semibold text-gray-700">
          {quantityLabel}
        </Text>
      </View>
      {additionalColumns.map((col) => (
        <View key={col.key} style={{ flex: col.flex }}>
          <Text className="text-xs font-semibold text-gray-700">
            {col.label}
          </Text>
        </View>
      ))}
      <View style={{ flex: FLEX.unit }}>
        <Text className="text-xs font-semibold text-gray-700">Unit</Text>
      </View>
      {showDimensions && (
        <>
          <View style={{ flex: FLEX.length }}>
            <Text className="text-xs font-semibold text-gray-700">Len</Text>
          </View>
          <View style={{ flex: FLEX.width }}>
            <Text className="text-xs font-semibold text-gray-700">Wid</Text>
          </View>
        </>
      )}
      {showComment && (
        <View style={{ flex: FLEX.comment }}>
          <Text className="text-xs font-semibold text-gray-700">Comment</Text>
        </View>
      )}
      <View style={{ flex: FLEX.actions }}>
        <Text className="text-xs font-semibold text-gray-700">Item Used</Text>
      </View>
      {cameraEnabled && (
        <View style={{ flex: FLEX.camera }}>
          <Text className="text-xs font-semibold text-gray-700 text-center">
            Photo
          </Text>
        </View>
      )}
    </View>
    );
  };

  const DataRow = ({ row }: { row: any }) => {
    const hasComment =
      typeof row.comment === "string" && row.comment.trim().length > 0;

    return (
      <View className="flex-row items-center bg-white border border-gray-200 rounded px-2 py-2 mt-1">
        <View style={{ flex: FLEX.item }}>
          <Text className="text-sm text-gray-800" numberOfLines={1}>
            {variantLabelForRow(row)}
          </Text>
        </View>
        <View style={{ flex: FLEX.quantity }}>
          <Text className="text-sm text-gray-800">{formatNumeric(row.quantity)}</Text>
        </View>
        {additionalColumns.map((col) => (
          <View key={col.key} style={{ flex: col.flex }}>
            {col.render ? (
              col.render(row)
            ) : (
              <Text className="text-sm text-gray-800">{formatNumeric(row[col.key])}</Text>
            )}
          </View>
        ))}
        <View style={{ flex: FLEX.unit }}>
          <Text className="text-sm text-gray-800">
            {row.unit_id ? unitsMap[row.unit_id as string] || "—" : "—"}
          </Text>
        </View>
        {showDimensions && (
          <>
            <View style={{ flex: FLEX.length }}>
              <Text className="text-sm text-gray-800">
                {formatDimensionValue(row.length)}
              </Text>
            </View>
            <View style={{ flex: FLEX.width }}>
              <Text className="text-sm text-gray-800">
                {formatDimensionValue(row.width)}
              </Text>
            </View>
          </>
        )}
        {showComment && (
          <View style={{ flex: FLEX.comment }} className="items-center">
            <TouchableOpacity
              onPress={() => openCommentModal(row)}
              disabled={!hasComment}
              className={`px-3 py-1 rounded-full border flex-row items-center gap-1 ${
                hasComment
                  ? "bg-blue-50 border-blue-500"
                  : "bg-gray-100 border-gray-300"
              }`}
            >
              <View
                className={`w-2 h-2 rounded-full ${
                  hasComment ? "bg-blue-600" : "bg-gray-400"
                }`}
              />
              <Text
                className={`text-xs font-semibold ${
                  hasComment ? "text-blue-700" : "text-gray-400"
                }`}
              >
                {hasComment ? "View" : "No Notes"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flex: FLEX.actions, paddingRight: 12 }}>
          <View className="flex-row gap-2 flex-wrap items-center justify-start">
            {!hideUseButton && !row.item_used ? (
              <TouchableOpacity
                disabled={!isEditable}
                onPress={() => markUsed(row.id)}
                className={`px-2 py-1 rounded border ${
                  isEditable
                    ? "bg-green-50 border-green-600"
                    : "bg-gray-100 border-gray-300"
                }`}
              >
                <View className="flex-row items-center">
                  <Check size={18} color={isEditable ? "#15803d" : "#9ca3af"} />
                  <Text
                    className={`text-xs ml-1 ${
                      isEditable ? "text-green-700" : "text-gray-400"
                    }`}
                  >
                    Use
                  </Text>
                </View>
              </TouchableOpacity>
            ) : !hideUseButton && row.item_used ? (
              <View className="px-2 py-1 rounded bg-gray-100 border border-gray-300">
                <View className="flex-row items-center">
                  <Check size={18} color="#6b7280" />
                  <Text className="text-gray-600 text-xs ml-1">Used</Text>
                </View>
              </View>
            ) : null}
            {!hideRemoveButton && (
              <TouchableOpacity
                disabled={!isEditable}
                onPress={() => removeRow(row.id)}
                className={`px-2 py-1 rounded border ${
                  isEditable
                    ? "bg-red-50 border-red-600"
                    : "bg-gray-100 border-gray-300"
                }`}
              >
                <View className="flex-row items-center">
                  <X size={18} color={isEditable ? "#ff0000" : "#9ca3af"} />
                  <Text
                    className={`text-xs ml-1 ${
                      isEditable ? "text-red-800" : "text-gray-400"
                    }`}
                  >
                    Remove
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {cameraEnabled && (
          <View
            style={{ flex: FLEX.camera }}
            className="items-center justify-center"
          >
            <TouchableOpacity
              onPress={() => handleCameraPress(row)}
              className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border ${
                isEditable
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-gray-100 opacity-60"
              }`}
              activeOpacity={0.7}
              disabled={!isEditable}
            >
              <Camera size={16} color={isEditable ? "#2563eb" : "#9ca3af"} />
              <Text
                className={`text-xs font-semibold ${
                  isEditable ? "text-blue-700" : "text-gray-400"
                }`}
              >
                Photo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="mx-4 mt-4 mb-4">
      <CollapsibleCard
        title={title}
        containerClassName="border-gray-500 bg-white"
        defaultOpen
      >
        <View className="w-full rounded p-3 bg-gray-50 border border-gray-200">
          <View
            className={`flex-row items-center mb-2 ${
              hideInnerSectionTitle ? "justify-end" : "justify-between"
            }`}
          >
            {!hideInnerSectionTitle && (
              <Text className="text-gray-800 font-semibold">{title}</Text>
            )}
            <View className="flex-row items-center gap-2">
              {!isEditable && (
                <Text className="text-xs text-gray-500">Editing locked</Text>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (!isEditable) return;
                  if (addOpen) {
                    setAddOpen(false);
                    resetForm();
                  } else {
                    setAddOpen(true);
                  }
                }}
                disabled={!isEditable}
                className={`px-3 py-1.5 rounded border ${
                  isEditable
                    ? "bg-blue-50 border-blue-600"
                    : "bg-gray-100 border-gray-300"
                }`}
              >
                <Text
                  className={`text-sm ${
                    isEditable ? "text-blue-700" : "text-gray-400"
                  }`}
                >
                  {addOpen ? "Cancel" : addButtonLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <HeaderRow />
          {isEditable && addOpen && (
            <View className="flex-row items-center bg-blue-50 border border-blue-300 rounded px-2 py-2 mt-1 relative z-20">
              <View style={{ flex: FLEX.item }} className="relative">
                <TouchableOpacity
                  ref={variantTriggerRef}
                  onPress={toggleVariantPicker}
                  className="border border-gray-300 rounded p-2 bg-white"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-800" numberOfLines={1}>
                      {formIsPending ? `${pendingFormLabel} 🕒` : variantLabelById(formVariant)}
                    </Text>
                    <ChevronDown size={16} color="#374151" />
                  </View>
                </TouchableOpacity>
                {errors.variant ? (
                  <Text className="text-red-600 text-xs mt-1">{errors.variant}</Text>
                ) : null}
              </View>

              <View style={{ flex: FLEX.quantity }} className="px-1">
                <TextInput
                  value={formQuantity}
                  onChangeText={(t) => {
                    setFormQuantity(t);
                    setErrors((e) => ({ ...e, quantity: undefined }));
                  }}
                  keyboardType="numeric"
                  className="border border-gray-300 rounded p-2 bg-white text-sm"
                  placeholder={quantityPlaceholder}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                  autoCorrect={false}
                />
                {errors.quantity ? (
                  <Text className="text-red-600 text-xs mt-1">{errors.quantity}</Text>
                ) : null}
              </View>

              {additionalFields.map((field) => {
                const colFlex = field.column?.flex ?? 10;
                return (
                  <View key={field.key} style={{ flex: colFlex }} className="px-1">
                    <TextInput
                      value={additionalValues[field.key]}
                      onChangeText={(t) =>
                        setAdditionalValues((prev) => ({ ...prev, [field.key]: t }))
                      }
                      keyboardType={field.keyboard || 'default'}
                      className="border border-gray-300 rounded p-2 bg-white text-sm"
                      placeholder={field.placeholder || field.label}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={() => Keyboard.dismiss()}
                      autoCorrect={false}
                    />
                    {errors[field.key] ? (
                      <Text className="text-red-600 text-xs mt-1">{errors[field.key]}</Text>
                    ) : null}
                  </View>
                );
              })}

              <View style={{ flex: FLEX.unit }} className="px-1 relative">
                <TouchableOpacity
                  ref={unitTriggerRef}
                  onPress={toggleUnitPicker}
                  className="border border-gray-300 rounded p-2 bg-white"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-800" numberOfLines={1}>
                      {formUnit ? unitsMap[formUnit] || '—' : 'Unit'}
                    </Text>
                    <ChevronDown size={16} color="#374151" />
                  </View>
                </TouchableOpacity>
                {errors.unit ? (
                  <Text className="text-red-600 text-xs mt-1">{errors.unit}</Text>
                ) : null}
              </View>

              {showDimensions && (
                <>
                  <View style={{ flex: FLEX.length }} className="px-1">
                    <TextInput
                      value={formLength}
                      onChangeText={setFormLength}
                      keyboardType="numeric"
                      className="border border-gray-300 rounded p-2 bg-white text-sm"
                      placeholder="Len"
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={() => Keyboard.dismiss()}
                      autoCorrect={false}
                    />
                  </View>
                  <View style={{ flex: FLEX.width }} className="px-1">
                    <TextInput
                      value={formWidth}
                      onChangeText={setFormWidth}
                      keyboardType="numeric"
                      className="border border-gray-300 rounded p-2 bg-white text-sm"
                      placeholder="Wid"
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={() => Keyboard.dismiss()}
                      autoCorrect={false}
                    />
                  </View>
                </>
              )}

              {showComment && (
                <View style={{ flex: FLEX.comment }} className="px-1">
                  <TextInput
                    value={formComment}
                    onChangeText={setFormComment}
                    className="border border-gray-300 rounded p-2 bg-white text-sm"
                    placeholder="Comment"
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => Keyboard.dismiss()}
                    autoCorrect={false}
                  />
                </View>
              )}

              <View style={{ flex: FLEX.actions, paddingRight: 12 }}>
                <View className="flex-row gap-2 flex-wrap items-center justify-start">
                  <TouchableOpacity
                    onPress={() => {
                      setAddOpen(false);
                      resetForm();
                    }}
                    className="px-2 py-1 rounded bg-red-50 border border-red-600"
                  >
                    <Text className="text-red-800 text-xs">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveNew}
                    className="px-2 py-1 rounded bg-blue-50 border border-blue-600"
                    disabled={isSaving}
                  >
                    <Text className="text-blue-700 text-xs">
                      {isSaving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {cameraEnabled && (
                <View style={{ flex: FLEX.camera }} className="items-center justify-center">
                  <Text className="text-xs text-gray-500">After save</Text>
                </View>
              )}
            </View>
          )}

          {(items || []).length === 0 ? (
            <View className="mt-2 p-3 bg-white border border-gray-200 rounded">
              <Text className="text-sm text-gray-500">No rows added yet.</Text>
            </View>
          ) : (
            (items || []).map((row) => <DataRow key={row.id} row={row} />)
          )}
        </View>
      </CollapsibleCard>

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
          setPendingFormLabel('');
          setErrors((e) => ({ ...e, variant: undefined }));

          const autoUnit = selectedVariant.unit_id || null;
          setFormUnit(autoUnit);
          setErrors((e) => ({ ...e, unit: undefined }));

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
          setErrors((e) => ({ ...e, unit: undefined }));
          setUnitPickerOpen(false);
          setUnitSearchQuery("");
        }}
      />

      <Modal
        visible={commentPreview.visible}
        transparent
        animationType="fade"
        onRequestClose={closeCommentModal}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-black/40 justify-center items-center"
          onPress={closeCommentModal}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="w-11/12 bg-white rounded-lg p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-gray-800 mb-3">
              {commentPreview.title}
            </Text>
            <ScrollView className="max-h-60 mb-4">
              <Text className="text-sm text-gray-700 leading-5">
                {commentPreview.text}
              </Text>
            </ScrollView>
            <TouchableOpacity
              onPress={closeCommentModal}
              className="self-end px-4 py-2 rounded bg-blue-50 border border-blue-600"
            >
              <Text className="text-blue-700 font-medium">Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {isEditable && addPendingConfig && (
        <AddPendingMaterialModal
          visible={showAddMaterialModal}
          onClose={() => setShowAddMaterialModal(false)}
          onSuccess={async (payload) => {
            await load();
            setFormVariant(payload.id);
            setFormIsPending(true);
            setPendingFormLabel(payload.label);
            if (payload.unitId) {
              setFormUnit(payload.unitId);
              setErrors((errs) => ({ ...errs, unit: undefined }));
            }
            setErrors((errs) => ({ ...errs, variant: undefined }));
            setShowAddMaterialModal(false);
            setAddOpen(true);
          }}
          orderPackageId={orderPackageId}
          autoTag={addPendingConfig.autoTag}
          materialType={addPendingConfig.materialType || materialType}
        />
      )}
    </View>
  );
};

export default OrderPackageMaterialsSection;
