import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import CollapsibleCard from "./common/CollapsibleCard";
import { db } from "../../utils/api/supabase";
import { Check, X, ChevronDown, Camera } from "lucide-react-native";
import { AddPendingMaterialModal } from "./AddPendingMaterialModal";

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
  additionalFields?: AdditionalFieldConfig[];
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
  additionalFields = EMPTY_ADDITIONAL_FIELDS,
}) => {
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
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
  const [unitSearchQuery, setUnitSearchQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);

  const additionalDefaults = useMemo(() => {
    const defaults: Record<string, string> = {};
    additionalFields.forEach((field) => {
      defaults[field.key] = "";
    });
    return defaults;
  }, [additionalFields]);

  const [formVariant, setFormVariant] = useState<string | null>(null);
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
      const [{ data: u }, { data: rows }, variantOptions] = await Promise.all([
        db.getAllUnits(),
        db.getOrderPackageMaterials(orderPackageId),
        fetchVariants(),
      ]);

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

      const allowedIds = new Set(
        (variantOptions || []).map((opt) => opt.value)
      );

      const filtered = (rows || []).filter((row: any) => {
        if (row.material_type !== materialType) return false;
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
    setFormQuantity("");
    setFormUnit(null);
    setFormLength("");
    setFormWidth("");
    setFormComment("");
    setVariantPickerOpen(false);
    setUnitPickerOpen(false);
    setVariantSearchQuery("");
    setUnitSearchQuery("");
    setAdditionalValues(additionalDefaults);
    setErrors({});
    setIsSaving(false);
  };

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
    if (!validate()) return;

    const qtyNum = Number(formQuantity);
    const unitIdToUse: string =
      formUnit || (variantUnitIdMap[formVariant as string] as string);

    const payload: any = {
      order_package_id: orderPackageId,
      material_variant_id: formVariant,
      material_type: materialType,
      is_final: true,
      quantity: qtyNum,
      unit_id: unitIdToUse,
      length: showDimensions ? (formLength ? Number(formLength) : null) : null,
      width: showDimensions ? (formWidth ? Number(formWidth) : null) : null,
      comment: showComment ? formComment || null : null,
      item_used: false,
    };

    additionalFields.forEach((field) => {
      const rawValue = additionalValues[field.key];
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        payload[field.key] = null;
      } else if (field.transform) {
        payload[field.key] = field.transform(rawValue);
      } else {
        payload[field.key] = rawValue;
      }
    });

    try {
      setIsSaving(true);
      const { error } = await db.addOrderPackageMaterial(payload);
      if (error) {
        const msg =
          error?.message || error?.details || error?.hint || "Failed to add item";
        Alert.alert("Error", String(msg));
        return;
      }
      setAddOpen(false);
      resetForm();
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const markUsed = async (id: string) => {
    const { error } = await db.updateOrderPackageMaterial(id, {
      item_used: true,
    });
    if (error) Alert.alert("Error", "Failed to update item used");
    else await load();
  };

  const removeRow = async (id: string) => {
    Alert.alert("Remove item", "Are you sure you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await db.deleteOrderPackageMaterial(id);
          if (error) Alert.alert("Error", "Failed to delete");
          else await load();
        },
      },
    ]);
  };

  const handleCameraPress = async (row: any) => {
    if (!cameraEnabled) return;
    Alert.alert("Attach image", "Choose source", [
      { text: "Gallery", onPress: () => pickFromGallery(row) },
      { text: "Camera", onPress: () => takePhoto(row) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickFromGallery = async (row: any) => {
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
    if (!mediaDesignation) return;
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
    item: 30,
    quantity: 10,
    unit: 10,
    length: 8,
    width: 8,
    comment: 30,
    actions: 20,
    camera: 4,
  };

  const HeaderRow = () => (
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
          <Text className="text-xs font-semibold text-gray-700"></Text>
        </View>
      )}
    </View>
  );

  const DataRow = ({ row }: { row: any }) => (
    <View className="flex-row items-center bg-white border border-gray-200 rounded px-2 py-2 mt-1">
      <View style={{ flex: FLEX.item }}>
        <Text className="text-sm text-gray-800" numberOfLines={1}>
          {variantLabelById(row.material_variant_id)}
        </Text>
      </View>
      <View style={{ flex: FLEX.quantity }}>
        <Text className="text-sm text-gray-800">{row.quantity ?? ""}</Text>
      </View>
      {additionalColumns.map((col) => (
        <View key={col.key} style={{ flex: col.flex }}>
          {col.render ? (
            col.render(row)
          ) : (
            <Text className="text-sm text-gray-800">
              {row[col.key] ?? ""}
            </Text>
          )}
        </View>
      ))}
      <View style={{ flex: FLEX.unit }}>
        <Text className="text-sm text-gray-800">
          {unitsMap[row.unit_id] || "—"}
        </Text>
      </View>
      {showDimensions && (
        <>
          <View style={{ flex: FLEX.length }}>
            <Text className="text-sm text-gray-800">{row.length ?? ""}</Text>
          </View>
          <View style={{ flex: FLEX.width }}>
            <Text className="text-sm text-gray-800">{row.width ?? ""}</Text>
          </View>
        </>
      )}
      {showComment && (
        <View style={{ flex: FLEX.comment }}>
          <Text className="text-sm text-gray-800" numberOfLines={1}>
            {row.comment || ""}
          </Text>
        </View>
      )}
      <View style={{ flex: FLEX.actions }}>
        <View className="flex-row gap-2">
          {!row.item_used ? (
            <TouchableOpacity
              onPress={() => markUsed(row.id)}
              className="px-2 py-1 rounded bg-green-50 border border-green-600"
            >
              <View className="flex-row items-center">
                <Check size={18} color="#15803d" />
                <Text className="text-green-700 text-xs ml-1">Use</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="px-2 py-1 rounded bg-gray-100 border border-gray-300">
              <View className="flex-row items-center">
                <Check size={18} color="#6b7280" />
                <Text className="text-gray-600 text-xs ml-1">Used</Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            onPress={() => removeRow(row.id)}
            className="px-2 py-1 rounded bg-red-50 border border-red-600"
          >
            <View className="flex-row items-center">
              <X size={18} color="#ff0000" />
              <Text className="text-red-800 text-xs ml-1">Remove</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      {cameraEnabled && (
        <View style={{ flex: FLEX.camera }} className="items-center justify-center">
          <TouchableOpacity
            onPress={() => handleCameraPress(row)}
            className="p-1"
            activeOpacity={0.7}
          >
            <Camera size={16} color="#2563eb" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View className="mx-4 mt-4 mb-4">
      <CollapsibleCard
        title={title}
        containerClassName="border-gray-500 bg-white"
        defaultOpen
      >
        <View className="w-full rounded p-3 bg-gray-50 border border-gray-200">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-800 font-semibold">{title}</Text>
            <TouchableOpacity
              onPress={() => setAddOpen(true)}
              className="bg-blue-50 border border-blue-600 px-3 py-1.5 rounded"
            >
              <Text className="text-blue-700 text-sm">{addButtonLabel}</Text>
            </TouchableOpacity>
          </View>

          <HeaderRow />
          {(items || []).map((row) => (
            <DataRow key={row.id} row={row} />
          ))}
        </View>
      </CollapsibleCard>

      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-black/40 justify-center items-center"
          onPress={() => {
            setAddOpen(false);
            resetForm();
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="w-11/12 bg-white rounded-lg p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-gray-800 mb-3">
              {resolvedModalTitle}
            </Text>

            <Text className="text-sm text-gray-700 mb-1">
              Item<Text className="text-red-600">*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setVariantPickerOpen((v) => !v)}
              className="border border-gray-300 rounded p-2 mb-1 bg-white"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-800">
                  {variantLabelById(formVariant)}
                </Text>
                <ChevronDown size={16} color="#374151" />
              </View>
            </TouchableOpacity>
            {errors.variant ? (
              <Text className="text-red-600 text-xs mb-2">
                {errors.variant}
              </Text>
            ) : (
              <View className="mb-1" />
            )}
            {variantPickerOpen && (
              <View className="max-h-60 border border-gray-200 rounded mb-2 bg-white">
                <View className="p-2 border-b border-gray-200">
                  <TextInput
                    value={variantSearchQuery}
                    onChangeText={setVariantSearchQuery}
                    placeholder="Type to search items..."
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    autoFocus
                  />
                </View>
                <ScrollView>
                  {variants.length === 0 ? (
                    <View className="px-3 py-4">
                      <Text className="text-gray-500 text-sm text-center">
                        No items found.
                      </Text>
                    </View>
                  ) : (
                    variants
                      .filter((opt) => {
                        if (!variantSearchQuery.trim()) return true;
                        return opt.label
                          .toLowerCase()
                          .includes(variantSearchQuery.toLowerCase());
                      })
                      .map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => {
                            setFormVariant(opt.value);
                            setErrors((e) => ({ ...e, variant: undefined }));
                            const autoUnit = opt.unit_id || null;
                            setFormUnit(autoUnit);
                            setErrors((e) => ({ ...e, unit: undefined }));
                            setVariantPickerOpen(false);
                            setVariantSearchQuery("");
                          }}
                          className="px-3 py-2 border-b border-gray-100"
                        >
                          <View className="flex-row justify-between items-center">
                            <Text className="text-gray-800">{opt.label}</Text>
                            {opt.unit_id ? (
                              <View className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                <Text className="text-[10px] text-slate-700">
                                  {unitsMap[opt.unit_id as string] || "—"}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      ))
                  )}
                </ScrollView>
                {addPendingConfig && (
                  <View className="p-2 border-t border-gray-300">
                    <TouchableOpacity
                      onPress={() => {
                        setVariantPickerOpen(false);
                        setShowAddMaterialModal(true);
                      }}
                      className="bg-blue-50 border border-blue-500 rounded px-3 py-2"
                    >
                      <Text className="text-blue-700 text-center font-medium text-sm">
                        Can't find it? Add new material
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <Text className="text-sm text-gray-700 mb-1">
              {quantityLabel}
              <Text className="text-red-600">*</Text>
            </Text>
            <TextInput
              value={formQuantity}
              onChangeText={(t) => {
                setFormQuantity(t);
                setErrors((e) => ({ ...e, quantity: undefined }));
              }}
              keyboardType="numeric"
              className="border border-gray-300 rounded p-2 mb-1 bg-white"
              placeholder={quantityPlaceholder}
            />
            {errors.quantity ? (
              <Text className="text-red-600 text-xs mb-2">
                {errors.quantity}
              </Text>
            ) : (
              <View className="mb-1" />
            )}

            {additionalFields.map((field) => (
              <View key={field.key}>
                <Text className="text-sm text-gray-700 mb-1">
                  {field.label}
                  {field.required ? <Text className="text-red-600">*</Text> : null}
                </Text>
                <TextInput
                  value={additionalValues[field.key]}
                  onChangeText={(t) =>
                    setAdditionalValues((prev) => ({ ...prev, [field.key]: t }))
                  }
                  keyboardType={field.keyboard || "default"}
                  className="border border-gray-300 rounded p-2 mb-1 bg-white"
                  placeholder={field.placeholder}
                />
                {errors[field.key] ? (
                  <Text className="text-red-600 text-xs mb-2">
                    {errors[field.key]}
                  </Text>
                ) : (
                  <View className="mb-1" />
                )}
              </View>
            ))}

            <Text className="text-sm text-gray-700 mb-1">
              Unit<Text className="text-red-600">*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setUnitPickerOpen((v) => !v)}
              className="border border-gray-300 rounded p-2 mb-1 bg-white"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-800">
                  {formUnit ? unitsMap[formUnit] || "—" : "Select unit"}
                </Text>
                <ChevronDown size={16} color="#374151" />
              </View>
            </TouchableOpacity>
            {formVariant && variantUnitIdMap[formVariant] && (
              <Text className="text-[10px] text-gray-500 mb-1">
                Default: {unitsMap[variantUnitIdMap[formVariant] as string] || "—"}
              </Text>
            )}
            {errors.unit ? (
              <Text className="text-red-600 text-xs mb-2">{errors.unit}</Text>
            ) : (
              <View className="mb-1" />
            )}
            {unitPickerOpen && (
              <View className="max-h-60 border border-gray-200 rounded mb-2 bg-white">
                <View className="p-2 border-b border-gray-200">
                  <TextInput
                    value={unitSearchQuery}
                    onChangeText={setUnitSearchQuery}
                    placeholder="Type to search units..."
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    autoFocus
                  />
                </View>
                <ScrollView>
                  {units
                    .filter((opt) => {
                      if (!unitSearchQuery.trim()) return true;
                      return opt.label
                        .toLowerCase()
                        .includes(unitSearchQuery.toLowerCase());
                    })
                    .map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => {
                          setFormUnit(opt.value);
                          setErrors((e) => ({ ...e, unit: undefined }));
                          setUnitPickerOpen(false);
                          setUnitSearchQuery("");
                        }}
                        className="px-3 py-2 border-b border-gray-100"
                      >
                        <Text className="text-gray-800">{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}

            {showDimensions && (
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-sm text-gray-700 mb-1">Length</Text>
                  <TextInput
                    value={formLength}
                    onChangeText={setFormLength}
                    keyboardType="numeric"
                    className="border border-gray-300 rounded p-2 mb-2"
                    placeholder="cm"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-gray-700 mb-1">Width</Text>
                  <TextInput
                    value={formWidth}
                    onChangeText={setFormWidth}
                    keyboardType="numeric"
                    className="border border-gray-300 rounded p-2 mb-2"
                    placeholder="cm"
                  />
                </View>
              </View>
            )}

            {showComment && (
              <>
                <Text className="text-sm text-gray-700 mb-1">Comment</Text>
                <TextInput
                  value={formComment}
                  onChangeText={setFormComment}
                  className="border border-gray-300 rounded p-2 mb-3"
                  placeholder="Optional notes"
                />
              </>
            )}

            <View className="flex-row justify-end gap-2">
              <TouchableOpacity
                onPress={() => {
                  setAddOpen(false);
                  resetForm();
                }}
                className="px-3 py-2 rounded bg-red-50 border border-red-600"
              >
                <Text className="text-red-800">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveNew}
                className="px-3 py-2 rounded bg-blue-50 border border-blue-600"
              >
                <Text className="text-blue-700">
                  {isSaving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {addPendingConfig && (
        <AddPendingMaterialModal
          visible={showAddMaterialModal}
          onClose={() => setShowAddMaterialModal(false)}
          onSuccess={async (variantId) => {
            const result = await load();
            setFormVariant(variantId);
            const defaultUnit = result?.variantUnitMap?.[variantId];
            if (defaultUnit) {
              setFormUnit(defaultUnit);
              setErrors((errs) => ({ ...errs, unit: undefined }));
            }
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
