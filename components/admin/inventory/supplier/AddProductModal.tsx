import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import {
  ChevronRight,
  ChevronDown,
  Package,
  Plus,
  Search,
  Tag as TagIcon,
  X,
} from "lucide-react-native";
import {
  Supplier,
  Material,
  MaterialVariant,
  UnitOfMeasure,
} from "../../../../utils/api/inventory";
import {
  supplierOperations,
  variantOperations,
  materialOperations,
  pricingOperations,
} from "../../../../utils/api/inventory";

export interface AddSupplierProductModalProps {
  visible: boolean;
  supplier: Supplier;
  allMaterials: Material[];
  allUnits: UnitOfMeasure[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function AddSupplierProductModal({
  visible,
  supplier,
  allMaterials,
  allUnits,
  onClose,
  onUpdate,
}: AddSupplierProductModalProps) {
  const [showOptions, setShowOptions] = useState(true);
  const [mode, setMode] = useState<"existing" | "new_variant" | "new_material">(
    "existing"
  );
  const [showManager, setShowManager] = useState(false);

  useEffect(() => {
    if (visible) {
      // Open directly into the unified manager (no mode selection screen)
      setShowOptions(false);
      setMode("existing");
      setShowManager(true);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black bg-opacity-50 justify-center items-center p-4">
        <TouchableOpacity className="absolute inset-0" onPress={onClose} />
        <View className="bg-white rounded-2xl w-full max-w-4xl max-h-[90%] overflow-hidden">
          {/* Header */}
          <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
            <View>
              <Text className="text-xl font-bold text-gray-900">
                Add Product for {supplier.name}
              </Text>
              <Text className="text-sm text-gray-600 mt-1">
                Type to search and select a material/variant. If not found, new entries will be created automatically, then pricing will be added.
              </Text>
            </View>
            <TouchableOpacity
              className="bg-gray-100 p-2 rounded-lg"
              onPress={onClose}
            >
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {showOptions && (
            <View className="bg-gray-50 p-4 border-b border-gray-200">
              <Text className="text-sm font-medium text-gray-700 mb-3">
                Choose how to add a product:
              </Text>
              <View>
                <TouchableOpacity
                  className="bg-white p-3 rounded-lg border border-gray-200 flex-row items-center mb-2"
                  onPress={() => {
                    setMode("existing");
                    setShowOptions(false);
                    setShowManager(true);
                  }}
                >
                  <Package size={20} color="#3b82f6" />
                  <View className="ml-3 flex-1">
                    <Text className="font-medium text-gray-900">
                      Add pricing for existing product
                    </Text>
                    <Text className="text-xs text-gray-600">
                      Select from existing materials and variants
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#6b7280" />
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-white p-3 rounded-lg border border-gray-200 flex-row items-center mb-2"
                  onPress={() => {
                    setMode("new_variant");
                    setShowOptions(false);
                    setShowManager(true);
                  }}
                >
                  <TagIcon size={20} color="#10b981" />
                  <View className="ml-3 flex-1">
                    <Text className="font-medium text-gray-900">
                      Create new variant
                    </Text>
                    <Text className="text-xs text-gray-600">
                      Add a new variant to an existing material
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#6b7280" />
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-white p-3 rounded-lg border border-gray-200 flex-row items-center"
                  onPress={() => {
                    setMode("new_material");
                    setShowOptions(false);
                    setShowManager(true);
                  }}
                >
                  <Plus size={20} color="#f59e0b" />
                  <View className="ml-3 flex-1">
                    <Text className="font-medium text-gray-900">
                      Create new material
                    </Text>
                    <Text className="text-xs text-gray-600">
                      Add a completely new material with variants
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showManager && (
            <SupplierVariantManager
              visible={showManager}
              supplier={supplier}
              allMaterials={allMaterials}
              allUnits={allUnits}
              onClose={() => {
                setShowManager(false);
                onClose();
              }}
              onUpdate={onUpdate}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

interface SupplierVariantManagerProps {
  visible: boolean;
  supplier: Supplier;
  allMaterials: Material[];
  allUnits: UnitOfMeasure[];
  onClose: () => void;
  onUpdate: () => void;
}

function SupplierVariantManager({
  visible,
  supplier,
  allMaterials,
  allUnits,
  onClose,
  onUpdate,
}: SupplierVariantManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(
    null
  );
  const [selectedVariant, setSelectedVariant] =
    useState<MaterialVariant | null>(null);
  const [price, setPrice] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<UnitOfMeasure | null>(null);
  const [stockLevel, setStockLevel] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredMaterials, setFilteredMaterials] =
    useState<Material[]>(allMaterials);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [variantQuery, setVariantQuery] = useState("");
  const [variantSuffix, setVariantSuffix] = useState("");
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [unitQuery, setUnitQuery] = useState("");

  // New material/variant form states
  const [newMaterialName, setNewMaterialName] = useState("");
  const [newMaterialDescription, setNewMaterialDescription] = useState("");
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantDescription, setNewVariantDescription] = useState("");
  const [variantAttributes, setVariantAttributes] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);

  // Variant naming preference
  const [includePrefix, setIncludePrefix] = useState(true);

  // Derived flags
  const isNewMaterial = !selectedMaterial && searchQuery.trim().length > 0;

  useEffect(() => {
    if (isNewMaterial) {
      setNewMaterialName(searchQuery);
    }
  }, [isNewMaterial, searchQuery]);

  // Compute suggestions for existing material + suffix typing
  const variantSuggestions = useMemo(() => {
    if (!selectedMaterial) return [] as MaterialVariant[];
    const q = (variantSuffix || '').toLowerCase().trim();
    const mat = (selectedMaterial?.name || '').toLowerCase();
    const list = (selectedMaterial.material_variants || []).filter((v) => {
      const name = v.variant_name.toLowerCase();
      const suffix = name.startsWith(mat) ? name.slice(mat.length).trimStart() : name;
      return !q || suffix.includes(q);
    });
    return list;
  }, [selectedMaterial, variantSuffix]);

  // Auto-hide dropdown if no suggestions or prefix disabled
  useEffect(() => {
    if (!includePrefix) {
      setShowVariantDropdown(false);
      return;
    }
    const q = variantSuffix.trim();
    if (!q) {
      setShowVariantDropdown(false);
    } else {
      setShowVariantDropdown(variantSuggestions.length > 0);
    }
  }, [includePrefix, variantSuffix, variantSuggestions.length]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMaterials(allMaterials);
    } else {
      const filtered = allMaterials.filter(
        (material) =>
          material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (material.description &&
            material.description
              .toLowerCase()
              .includes(searchQuery.toLowerCase())) ||
          (material.material_variants &&
            material.material_variants.some((variant) =>
              variant.variant_name
                .toLowerCase()
                .includes(searchQuery.toLowerCase())
            ))
      );
      setFilteredMaterials(filtered);
    }
  }, [searchQuery, allMaterials]);

  const resetForm = () => {
    setSearchQuery("");
    setSelectedMaterial(null);
    setSelectedVariant(null);
    setPrice("");
    setSelectedUnit(null);
    setStockLevel("");
    setShowDropdown(false);
    setVariantQuery("");
    setVariantSuffix("");
    setShowVariantDropdown(false);
    setNewMaterialName("");
    setNewMaterialDescription("");
    setNewVariantName("");
    setNewVariantDescription("");
    setVariantAttributes([{ key: "", value: "" }]);
  };

  const handleSelectMaterial = (material: Material) => {
    setSelectedMaterial(material);
    setSelectedVariant(null);
    setShowDropdown(false);
    setSearchQuery(`${material.name}`);
    setVariantQuery(`${material.name} - `);
    setVariantSuffix("");
    setShowVariantDropdown(false);
    // Default the unit to the material's unit for convenience
    if (material.unit_id) {
      const unit = allUnits.find((u) => u.id === material.unit_id) || null;
      setSelectedUnit(unit);
    }
  };

  const handleSelectVariant = (variant: MaterialVariant) => {
    setSelectedVariant(variant);
    const mat = selectedMaterial?.name || "";
    const raw = variant.variant_name || "";
    const suffix = raw.startsWith(mat) ? raw.slice(mat.length).trimStart() : raw;
    setVariantSuffix(suffix);
    setVariantQuery(`${mat}${suffix ? ' - ' + suffix : ''}`);
    setShowVariantDropdown(false);
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    const creatingNewMaterial = !selectedMaterial && searchQuery.trim().length > 0;
    const creatingNewVariant =
      (selectedMaterial && !selectedVariant && variantSuffix.trim().length > 0) ||
      (creatingNewMaterial && newVariantName.trim().length > 0);

    if (!selectedUnit) newErrors.unit = "Please select a unit of measure";
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
      newErrors.price = "Enter a valid price";

    // For existing selections, require a variant selected OR a new one typed
    if (!creatingNewMaterial && !selectedMaterial) {
      newErrors.material = "Please select or type a material";
    }

    if (!selectedVariant && !creatingNewVariant) {
      newErrors.variant = "Please select a variant or type a new one";
    }

    // For creating new, validate names
    if (creatingNewMaterial && !newMaterialName.trim()) {
      newErrors.newMaterialName = "Material name is required";
    }
    if (creatingNewVariant) {
      if (creatingNewMaterial && !newVariantName.trim())
        newErrors.newVariantName = "Variant name is required";
      if (selectedMaterial && !variantSuffix.trim())
        newErrors.newVariantName = "Variant name is required";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      // 1) Ensure material exists
      let material = selectedMaterial as Material | null;
      if (!material) {
        const materialPayload: any = {
          name: newMaterialName.trim() || searchQuery.trim(),
          description: newMaterialDescription || null,
          unit_id: selectedUnit?.id || null,
        };
        const { data: newMat, error: matErr } = await materialOperations.create(
          materialPayload
        );
        if (matErr || !newMat) {
          setErrors({ materialCreate: "Failed to create material" });
          setIsSubmitting(false);
          return;
        }
        material = newMat as Material;
      }

      // 2) Ensure variant exists
      let variant = selectedVariant as MaterialVariant | null;
      if (!variant) {
        const builtName = selectedMaterial
          ? (includePrefix
              ? `${material.name}${variantSuffix.trim() ? ' ' + variantSuffix.trim() : ''}`
              : `${variantSuffix.trim()}`)
          : (includePrefix
              ? `${(newMaterialName || material.name).trim()}${newVariantName.trim() ? ' ' + newVariantName.trim() : ''}`
              : `${newVariantName.trim()}`);

        // Build attributes
        const attrsObj = variantAttributes.reduce((acc, kv) => {
          const k = kv.key.trim();
          const v = kv.value.trim();
          if (k && v) acc[k] = v;
          return acc;
        }, {} as Record<string, string>);

        const variantData: any = {
          material_id: material.id,
          variant_name: builtName,
          description: (selectedMaterial ? newVariantDescription : newVariantDescription) || null,
          attributes: Object.keys(attrsObj).length > 0 ? attrsObj : {},
          unit_id: selectedUnit!.id,
        };
        const { data: newVar, error: varErr } = await variantOperations.create(
          variantData
        );
        if (varErr || !newVar) {
          setErrors({ variantCreate: "Failed to create variant" });
          setIsSubmitting(false);
          return;
        }
        variant = newVar as MaterialVariant;
      }

      // 3) Create pricing
      const pricingData: any = {
        material_variant_id: variant.id,
        supplier_id: supplier.id,
        price: parseFloat(price),
        unit_id: selectedUnit!.id,
        stock_level: stockLevel ? parseInt(stockLevel) : null,
      };
      const { error: pricingError } = await pricingOperations.create(pricingData);
      if (!pricingError) {
        resetForm();
        onUpdate();
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVariantWithPricing = async () => {
    const newErrors: Record<string, string> = {};
    if (!selectedMaterial) newErrors.material = "Please select a material";
    if (!newVariantName.trim())
      newErrors.newVariantName = "Variant name is required";
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
      newErrors.price = "Enter a valid price";
    if (!selectedUnit) newErrors.unit = "Please select a unit of measure";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setIsSubmitting(true);
    try {
      const variantData: any = {
        material_id: selectedMaterial.id,
        variant_name: `${selectedMaterial.name}${newVariantName.trim() ? ' ' + newVariantName.trim() : ''}`,
        description: newVariantDescription || null,
        attributes: {},
      };
      const { data: newVariant, error: variantError } =
        await variantOperations.create(variantData);
      if (variantError || !newVariant) {
        setErrors({ variantCreate: "Failed to create variant" });
        setIsSubmitting(false);
        return;
      }
      const pricingData: any = {
        material_variant_id: newVariant.id,
        supplier_id: supplier.id,
        price: parseFloat(price),
        unit_id: selectedUnit.id,
        stock_level: stockLevel ? parseInt(stockLevel) : null,
      };
      const { error: pricingError } = await pricingOperations.create(
        pricingData
      );
      if (!pricingError) {
        resetForm();
        setNewVariantName("");
        setNewVariantDescription("");
        onUpdate();
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateMaterialWithVariantAndPricing = async () => {
    const newErrors: Record<string, string> = {};
    if (!newMaterialName.trim())
      newErrors.newMaterialName = "Material name is required";
    if (!newVariantName.trim())
      newErrors.newVariantName = "Variant name is required";
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
      newErrors.price = "Enter a valid price";
    if (!selectedUnit) newErrors.unit = "Please select a unit of measure";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setIsSubmitting(true);
    try {
      const materialData: any = {
        name: newMaterialName,
        description: newMaterialDescription || null,
        unit_id: selectedUnit.id,
      };
      const { data: newMaterial, error: materialError } =
        await materialOperations.create(materialData);
      if (materialError || !newMaterial) {
        setErrors({ materialCreate: "Failed to create material" });
        setIsSubmitting(false);
        return;
      }
      const variantData: any = {
        material_id: newMaterial.id,
        variant_name: `${newMaterial.name}${newVariantName.trim() ? ' ' + newVariantName.trim() : ''}`,
        description: newVariantDescription || null,
        attributes: {},
      };
      const { data: newVariant, error: variantError } =
        await variantOperations.create(variantData);
      if (variantError || !newVariant) {
        setErrors({
          variantCreate: "Material created but failed to create variant",
        });
        setIsSubmitting(false);
        return;
      }
      const pricingData: any = {
        material_variant_id: newVariant.id,
        supplier_id: supplier.id,
        price: parseFloat(price),
        unit_id: selectedUnit.id,
        stock_level: stockLevel ? parseInt(stockLevel) : null,
      };
      const { error: pricingError } = await pricingOperations.create(
        pricingData
      );
      if (!pricingError) {
        resetForm();
        setNewMaterialName("");
        setNewMaterialDescription("");
        setNewVariantName("");
        setNewVariantDescription("");
        onUpdate();
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">


        {/* Unified selection and creation */}
        <View className="mb-4">
            {/* Material selector */}
            <Text className="text-base font-medium text-gray-900 mb-2">
              Material *
            </Text>
            <View className="relative">
              <TextInput
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setShowDropdown(true);
                  if (!text) {
                    setSelectedMaterial(null);
                    setSelectedVariant(null);
                    setVariantQuery("");
                    setShowVariantDropdown(false);
                  }
                }}
                placeholder="Search for material..."
                className="border border-gray-300 rounded-lg px-3 py-2 pr-10"
              />
              <TouchableOpacity
                className="absolute right-3 top-2"
                onPress={() => setShowDropdown(!showDropdown)}
              >
                <Search size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {showDropdown && (
              <View className="mt-2 bg-white border border-gray-300 rounded-lg max-h-64 shadow-lg">
                <ScrollView>
                  {filteredMaterials.map((material) => (
                    <TouchableOpacity
                      key={material.id}
                      className="p-3 border-b border-gray-100"
                      onPress={() => handleSelectMaterial(material)}
                    >
                      <Text className="font-medium text-gray-900">
                        {material.name}
                      </Text>
                      {material.description ? (
                        <Text className="text-sm text-gray-600">
                          {material.description}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {errors.material && (
                <Text className="text-xs text-red-600 mt-1">
                  {errors.material}
                </Text>
              )}

            {/* New Material details when typed but not selected */}
            {!selectedMaterial && searchQuery.trim().length > 0 && (
              <View className="mt-4">
                <Text className="text-sm text-gray-600 mb-2">New material will be created: <Text className="font-medium text-gray-900">{searchQuery.trim()}</Text></Text>
                <Text className="text-base font-medium text-gray-900 mb-2">Material Description</Text>
                <TextInput
                  value={newMaterialDescription}
                  onChangeText={setNewMaterialDescription}
                  placeholder="Enter material description (optional)"
                  multiline
                  numberOfLines={3}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                />
              </View>
            )}

            {/* Variant selector or creation */}
            {selectedMaterial && (
              <View className="mt-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-medium text-gray-900">Variant *</Text>
                  <TouchableOpacity
                    onPress={() => setIncludePrefix(prev => !prev)}
                    className={`px-2 py-1 rounded border ${includePrefix ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-300'}`}
                  >
                    <Text className="text-xs text-gray-700">Prefix: {includePrefix ? 'On' : 'Off'}</Text>
                  </TouchableOpacity>
                </View>
                <View className="relative">
                  {includePrefix ? (
                    <View className="flex-row items-center border border-gray-300 rounded-lg overflow-hidden pr-10">
                      <View className="bg-gray-100 px-3 py-2 border-r border-gray-300">
                        <Text className="text-gray-700 font-medium">{selectedMaterial?.name || ''}</Text>
                      </View>
                      <TextInput
                        value={variantSuffix}
                        onChangeText={(text) => {
                          setVariantSuffix(text);
                          if (!text) setSelectedVariant(null);
                        }}
                        placeholder="e.g., 12mm Marine"
                        className="flex-1 px-3 py-2 text-gray-900"
                      />
                      <TouchableOpacity
                        className="absolute right-3 top-2"
                        onPress={() => setShowVariantDropdown(prev => (variantSuggestions.length > 0 ? !prev : false))}
                      >
                        <Search size={20} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TextInput
                      value={variantSuffix}
                      onChangeText={(text) => {
                        setVariantSuffix(text);
                        if (!text) setSelectedVariant(null);
                      }}
                      placeholder="e.g., Buckle White Belt 19mm"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  )}
                  <Text className="text-xs text-gray-500 mt-1">
                    Full name: {includePrefix ? ((selectedMaterial?.name?.trim() || '') + (variantSuffix?.trim() ? ` ${variantSuffix.trim()}` : '')) : (variantSuffix?.trim() || '')}
                  </Text>
                </View>
                {(showVariantDropdown && includePrefix && variantSuggestions.length > 0) && (
                  <View className="mt-2 bg-white border border-gray-300 rounded-lg max-h-64 shadow-lg">
                    <ScrollView>
                      {variantSuggestions.map((variant) => (
                        <TouchableOpacity
                          key={variant.id}
                          className="p-3 border-b border-gray-100"
                          onPress={() => handleSelectVariant(variant)}
                        >
                          <Text className="text-sm text-gray-800">
                            {variant.variant_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
                {errors.variant && (
                  <Text className="text-xs text-red-600 mt-1">
                    {errors.variant}
                  </Text>
                )}

                {/* If user typed a new variant (no selection), show extra fields */}
                {!selectedVariant && variantSuffix.trim().length > 0 && (
                  <>
                    <View className="mt-4">
                      <Text className="text-base font-medium text-gray-900 mb-2">Variant Description</Text>
                      <TextInput
                        value={newVariantDescription}
                        onChangeText={setNewVariantDescription}
                        placeholder="Enter variant description (optional)"
                        className="border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </View>
                    <View className="mt-2">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-sm font-medium text-gray-700">Attributes</Text>
                        <TouchableOpacity onPress={() => setVariantAttributes(prev => [...prev, { key: '', value: '' }])} className="bg-blue-50 px-2 py-1 rounded-lg">
                          <Text className="text-xs text-blue-600 font-medium">Add</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ maxHeight: 120 }}>
                        <ScrollView>
                          {variantAttributes.map((attr, idx) => (
                            <View key={idx} className="flex-row mb-2 space-x-1">
                              <View className="flex-1">
                                <TextInput
                                  value={attr.key}
                                  onChangeText={(t) => setVariantAttributes(prev => prev.map((a, i) => i === idx ? { ...a, key: t } : a))}
                                  placeholder="Property"
                                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                                />
                              </View>
                              <View className="flex-1">
                                <TextInput
                                  value={attr.value}
                                  onChangeText={(t) => setVariantAttributes(prev => prev.map((a, i) => i === idx ? { ...a, value: t } : a))}
                                  placeholder="Value"
                                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                                />
                              </View>
                              {variantAttributes.length > 1 && (
                                <TouchableOpacity onPress={() => setVariantAttributes(prev => prev.filter((_, i) => i !== idx))} className="bg-red-50 px-2 rounded-lg justify-center">
                                  <Text className="text-red-600 text-xs">Remove</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* New Variant when creating new material */}
            {!selectedMaterial && searchQuery.trim().length > 0 && (
              <>
                <View className="mb-4 mt-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-medium text-gray-900">Variant Name *</Text>
                    <TouchableOpacity
                      onPress={() => setIncludePrefix(prev => !prev)}
                      className={`px-2 py-1 rounded border ${includePrefix ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-300'}`}
                    >
                      <Text className="text-xs text-gray-700">Prefix: {includePrefix ? 'On' : 'Off'}</Text>
                    </TouchableOpacity>
                  </View>
                  {includePrefix ? (
                    <View className="flex-row items-center border border-gray-300 rounded-lg overflow-hidden">
                      <View className="bg-gray-100 px-3 py-2 border-r border-gray-300">
                        <Text className="text-gray-700 font-medium">{newMaterialName || ""}</Text>
                      </View>
                      <TextInput
                        value={newVariantName}
                        onChangeText={setNewVariantName}
                        placeholder="e.g., 12mm Marine"
                        className="flex-1 px-3 py-2 text-gray-900"
                      />
                    </View>
                  ) : (
                    <TextInput
                      value={newVariantName}
                      onChangeText={setNewVariantName}
                      placeholder="e.g., Buckle White Belt 19mm"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  )}
                  <Text className="text-xs text-gray-500 mt-1">
                    Full name: {includePrefix ? ((newMaterialName?.trim() || "") + (newVariantName?.trim() ? ` ${newVariantName.trim()}` : "")) : (newVariantName?.trim() || "")}
                  </Text>
                  {errors.newVariantName && (
                    <Text className="text-xs text-red-600 mt-1">{errors.newVariantName}</Text>
                  )}
                </View>
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-900 mb-2">Variant Description</Text>
                  <TextInput
                    value={newVariantDescription}
                    onChangeText={setNewVariantDescription}
                    placeholder="Enter variant description (optional)"
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                </View>
                <View className="mb-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-sm font-medium text-gray-700">Attributes</Text>
                    <TouchableOpacity onPress={() => setVariantAttributes(prev => [...prev, { key: '', value: '' }])} className="bg-blue-50 px-2 py-1 rounded-lg">
                      <Text className="text-xs text-blue-600 font-medium">Add</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ maxHeight: 120 }}>
                    <ScrollView>
                      {variantAttributes.map((attr, idx) => (
                        <View key={idx} className="flex-row mb-2 space-x-1">
                          <View className="flex-1">
                            <TextInput
                              value={attr.key}
                              onChangeText={(t) => setVariantAttributes(prev => prev.map((a, i) => i === idx ? { ...a, key: t } : a))}
                              placeholder="Property"
                              className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                            />
                          </View>
                          <View className="flex-1">
                            <TextInput
                              value={attr.value}
                              onChangeText={(t) => setVariantAttributes(prev => prev.map((a, i) => i === idx ? { ...a, value: t } : a))}
                              placeholder="Value"
                              className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                            />
                          </View>
                          {variantAttributes.length > 1 && (
                            <TouchableOpacity onPress={() => setVariantAttributes(prev => prev.filter((_, i) => i !== idx))} className="bg-red-50 px-2 rounded-lg justify-center">
                              <Text className="text-red-600 text-xs">Remove</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </>
            )}
          </View>

        {/* Pricing fields */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Price (AED) *
          </Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="Enter price"
            keyboardType="decimal-pad"
            className="border border-gray-300 rounded-lg px-3 py-2"
          />
              {errors.price && (
            <Text className="text-xs text-red-600 mt-1">{errors.price}</Text>
          )}
        </View>
      <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Unit of Measure *</Text>
          <View>
            <TouchableOpacity
              onPress={() => setUnitDropdownOpen(prev => !prev)}
              className="border border-gray-300 rounded-lg px-3 py-2 flex-row items-center justify-between"
            >
              <Text className="text-gray-900">{selectedUnit?.name && selectedUnit.name.trim() && selectedUnit.name.trim() !== '.' ? selectedUnit.name : 'Select unit'}</Text>
              <ChevronDown size={16} color="#6b7280" />
            </TouchableOpacity>
            {unitDropdownOpen && (
              <View className="mt-2 bg-white border border-gray-300 rounded-lg max-h-64">
                {/* search box to type and sort */}
                <View className="p-2 border-b border-gray-200">
                  <TextInput
                    value={unitQuery}
                    onChangeText={setUnitQuery}
                    placeholder="Type to filter units..."
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </View>
                <ScrollView>
                  {allUnits
                    .slice()
                    .sort((a, b) => {
                      const q = unitQuery.toLowerCase();
                      if (!q) return a.name.localeCompare(b.name);
                      const ia = a.name.toLowerCase().indexOf(q);
                      const ib = b.name.toLowerCase().indexOf(q);
                      const ra = ia === -1 ? 9999 : ia;
                      const rb = ib === -1 ? 9999 : ib;
                      if (ra !== rb) return ra - rb;
                      return a.name.localeCompare(b.name);
                    })
                    .filter((u) => !unitQuery.trim() || u.name.toLowerCase().includes(unitQuery.toLowerCase()) || (u.description || '').toLowerCase().includes(unitQuery.toLowerCase()))
                    .map((unit) => (
                      <TouchableOpacity key={unit.id} onPress={() => { setSelectedUnit(unit); setUnitDropdownOpen(false); setUnitQuery(''); }} className="p-3 border-b border-gray-100">
                        <Text className="text-sm text-gray-900">{unit.name}</Text>
                        {unit.description ? (<Text className="text-xs text-gray-500">{unit.description}</Text>) : null}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}
          </View>
          {errors.unit && <Text className="text-xs text-red-600 mt-1">{errors.unit}</Text>}
        </View>
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Stock Level
          </Text>
          <TextInput
            value={stockLevel}
            onChangeText={setStockLevel}
            placeholder="Optional stock level"
            keyboardType="number-pad"
            className="border border-gray-300 rounded-lg px-3 py-2"
          />
        </View>
      </ScrollView>

      {/* Footer actions */}
      <View className="flex-row p-4 border-t border-gray-200">
        <TouchableOpacity
          className="flex-1 bg-gray-100 py-3 border border-gray-400 rounded-lg mr-2"
          onPress={onClose}
        >
          <Text className="text-center text-gray-700 font-medium">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-blue-500 border border-blue-800 py-3 rounded-lg"
          onPress={handleSubmit}
        >
          <Text className="text-center text-white font-medium">
            Save
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
