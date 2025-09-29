import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  Plus,
  Package,
  Building2,
  Tag as TagIcon,
  DollarSign,
  Settings,
  RefreshCw,
  AlertTriangle,
  X,
  Save,
} from "lucide-react-native";
import { supabase } from "../../utils/api/supabase";

// Import our inventory components and API functions
import {
  Material,
  MaterialVariant,
  Supplier,
  Tag,
  UnitOfMeasure,
  materialOperations,
  supplierOperations,
  tagOperations,
  unitOperations,
  materialTagOperations,
} from "../../utils/api/inventory";

import {
  MaterialCard,
  TagManagement,
  MaterialForm,
  VariantManagement,
} from "../../components/inventory/InventoryComponents";
import { SupplierCard } from "../../components/admin/inventory/supplier";
import {
  SupplierProductsModal,
  AddSupplierProductModal,
} from "../../components/admin/inventory/supplier";

// Direct imports instead of lazy loading to avoid Suspense-related stalls
import { SupplierForm } from "../../components/inventory/InventoryForms";

import { ConfirmModal } from "../../components/ui/ConfirmModal";

// Tab types
type TabType = "materials" | "suppliers" | "tags" | "settings";

import { TopTabs } from "../../components/inventory/TopTabs";

export default function InventoryPage() {
  // State management
  const [activeTab, setActiveTab] = useState<TabType>("materials");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Data states
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitDescription, setNewUnitDescription] = useState("");
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showVariantManagement, setShowVariantManagement] = useState(false);
  const [showSupplierProducts, setShowSupplierProducts] = useState(false);
  const [showAddSupplierProduct, setShowAddSupplierProduct] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(
    null
  );
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );

  // Price alert states
  const [showPriceAlerts, setShowPriceAlerts] = useState(false);
  const [priceSettings, setPriceSettings] = useState({
    warning_days: 90,
    alert_days: 180,
    enabled: true,
  });

  // Confirm delete modal state
  const [confirmDelete, setConfirmDelete] = useState<{
    visible: boolean;
    material: Material | null;
    loading: boolean;
  }>({
    visible: false,
    material: null,
    loading: false,
  });

  // Load on mount and whenever tab changes
  useEffect(() => {
    loadData(true);
    loadPriceSettings();
  }, [activeTab]);

  // Price alert functions
  const loadPriceSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "price_alert_thresholds")
        .single();

      if (data?.value) {
        setPriceSettings(data.value);
      }
    } catch (error) {
      console.error("Error loading price settings:", error);
    }
  };

  const savePriceSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("app_settings").upsert(
        {
          key: "price_alert_thresholds",
          value: priceSettings,
          description: "Thresholds for supplier pricing age alerts (in days)",
          category: "inventory",
        },
        {
          onConflict: "key",
        }
      );

      if (error) throw error;

      Alert.alert("Success", "Price alert settings saved successfully");
      setShowPriceAlerts(false);
    } catch (error) {
      console.error("Error saving price settings:", error);
      Alert.alert("Error", "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (showLoader: boolean = false) => {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [materialsResult, suppliersResult, tagsResult, unitsResult] =
        await Promise.all([
          materialOperations.getAll(),
          supplierOperations.getAll(),
          tagOperations.getAll(),
          unitOperations.getAll(),
        ]);

      if (
        materialsResult.error ||
        suppliersResult.error ||
        tagsResult.error ||
        unitsResult.error
      ) {
        Alert.alert("Error", "Failed to load inventory data");
        return;
      }

      const m = materialsResult.data || [];
      const s = suppliersResult.data || [];
      const t = tagsResult.data || [];
      const u = unitsResult.data || [];

      setMaterials(m);
      setSuppliers(s);
      setTags(t);
      setUnits(u);
    } catch (error) {
      console.error("Error loading data:", error);
      Alert.alert("Error", "Failed to load inventory data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Material operations
  const handleCreateMaterial = async (materialData: any) => {
    try {
      // Remove tags from the insert payload; insert tags via junction table afterward
      const { tags: tagIds, ...materialInfo } = materialData || {};

      const { data: newMaterial, error } = await materialOperations.create(
        materialInfo
      );
      if (error) {
        Alert.alert("Error", "Failed to create material");
        return;
      }

      // Handle tags if provided
      if (newMaterial && tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await materialTagOperations.addTagToMaterial(newMaterial.id, tagId);
        }
      }

      Alert.alert("Success", "Material created successfully");
      setShowMaterialForm(false);
      setSelectedMaterial(null);
      loadData(false);
    } catch (error) {
      console.error("Error creating material:", error);
      Alert.alert("Error", "Failed to create material");
    }
  };

  const handleUpdateMaterial = async (materialData: any) => {
    if (!selectedMaterial) return;

    try {
      // Separate tags from the core material fields to avoid 400 on PATCH
      const { tags: tagIds, ...materialInfo } = materialData || {};

      const { error } = await materialOperations.update(
        selectedMaterial.id,
        materialInfo
      );
      if (error) {
        Alert.alert("Error", "Failed to update material");
        return;
      }

      // Update tags (replace strategy)
      if (Array.isArray(tagIds)) {
        try {
          // Remove all existing tags for this material
          if (
            selectedMaterial.material_tags &&
            selectedMaterial.material_tags.length > 0
          ) {
            for (const mt of selectedMaterial.material_tags) {
              await materialTagOperations.removeTagFromMaterial(
                selectedMaterial.id,
                mt.tag_id
              );
            }
          }
          // Add the provided tags
          for (const tagId of tagIds) {
            await materialTagOperations.addTagToMaterial(
              selectedMaterial.id,
              tagId
            );
          }
        } catch (e) {
          // Non-fatal; proceed to refresh
          console.error("Material tag update warning:", e);
        }
      }

      Alert.alert("Success", "Material updated successfully");
      setShowMaterialForm(false);
      setSelectedMaterial(null);
      loadData(false);
    } catch (error) {
      console.error("Error updating material:", error);
      Alert.alert("Error", "Failed to update material");
    }
  };

  const handleDeleteMaterial = (material: Material) => {
    // Open confirmation modal
    setConfirmDelete({ visible: true, material, loading: false });
  };

  const confirmDeleteMaterial = async () => {
    if (!confirmDelete.material) return;
    try {
      setConfirmDelete((prev) => ({ ...prev, loading: true }));
      console.log(
        "🗑️ Deleting material (with cascade)...",
        confirmDelete.material.id
      );
      const { error } = await materialOperations.delete(
        confirmDelete.material.id
      );
      if (error) {
        console.error("Delete material error:", error);
        if (typeof alert === "function") alert("Failed to delete material");
      } else {
        if (typeof alert === "function") alert("Material deleted successfully");
        await loadData(false);
      }
    } catch (error) {
      console.error("Error deleting material:", error);
      if (typeof alert === "function") alert("Failed to delete material");
    } finally {
      setConfirmDelete({ visible: false, material: null, loading: false });
    }
  };

  // Supplier operations
  const handleCreateSupplier = async (supplierData: any) => {
    try {
      const { error } = await supplierOperations.create(supplierData);
      if (error) {
        Alert.alert("Error", "Failed to create supplier");
        return;
      }
      Alert.alert("Success", "Supplier created successfully");
      setShowSupplierForm(false);
      setSelectedSupplier(null);
      loadData(false);
    } catch (error) {
      console.error("Error creating supplier:", error);
      Alert.alert("Error", "Failed to create supplier");
    }
  };

  const handleUpdateSupplier = async (supplierData: any) => {
    if (!selectedSupplier) return;

    try {
      const { error } = await supplierOperations.update(
        selectedSupplier.id,
        supplierData
      );
      if (error) {
        Alert.alert("Error", "Failed to update supplier");
        return;
      }
      Alert.alert("Success", "Supplier updated successfully");
      setShowSupplierForm(false);
      setSelectedSupplier(null);
      loadData(false);
    } catch (error) {
      console.error("Error updating supplier:", error);
      Alert.alert("Error", "Failed to update supplier");
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    try {
      const { error } = await supplierOperations.delete(supplier.id);
      if (error) {
        Alert.alert("Error", "Failed to delete supplier");
        return;
      }
      Alert.alert("Success", "Supplier deleted successfully");
      loadData(false);
    } catch (error) {
      console.error("Error deleting supplier:", error);
      Alert.alert("Error", "Failed to delete supplier");
    }
  };

  // Tag operations
  const handleCreateTag = async (name: string) => {
    try {
      const { error } = await tagOperations.create(name);
      if (error) {
        Alert.alert("Error", "Failed to create tag");
        return;
      }
      Alert.alert("Success", "Tag created successfully");
      loadData(false);
    } catch (error) {
      console.error("Error creating tag:", error);
      Alert.alert("Error", "Failed to create tag");
    }
  };

  const handleUpdateTag = async (tag: Tag, newName: string) => {
    try {
      const { error } = await tagOperations.update(tag.id, newName);
      if (error) {
        Alert.alert("Error", "Failed to update tag");
        return;
      }
      Alert.alert("Success", "Tag updated successfully");
      loadData(false);
    } catch (error) {
      console.error("Error updating tag:", error);
      Alert.alert("Error", "Failed to update tag");
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    try {
      const { error } = await tagOperations.delete(tag.id);
      if (error) {
        Alert.alert("Error", "Failed to delete tag");
        return;
      }
      Alert.alert("Success", "Tag deleted successfully");
      loadData(false);
    } catch (error) {
      console.error("Error deleting tag:", error);
      Alert.alert("Error", "Failed to delete tag");
    }
  };

  // Unit operations (create only)
  const handleCreateUnit = async () => {
    const name = newUnitName.trim();
    const description = newUnitDescription.trim();
    if (!name) {
      Alert.alert("Error", "Unit name is required");
      return;
    }
    // Prevent duplicates (case-insensitive)
    if (units.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert("Info", "This unit already exists");
      return;
    }
    try {
      setSavingUnit(true);
      const payload: any = { name };
      if (description) payload.description = description;
      const { data, error } = await unitOperations.create(payload);
      if (error) {
        Alert.alert("Error", "Failed to create unit");
        return;
      }
      if (data) {
        setUnits((prev) => [...prev, data as UnitOfMeasure]);
        setNewUnitName("");
        setNewUnitDescription("");
        setShowUnitModal(false);
        Alert.alert("Success", "Unit added");
      }
    } catch (e) {
      console.error("Error creating unit:", e);
      Alert.alert("Error", "Failed to create unit");
    } finally {
      setSavingUnit(false);
    }
  };

  // Filter data based on search and tag
  const filteredMaterials = materials.filter((material) => {
    const matchesSearch =
      material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (material.description &&
        material.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag =
      selectedTagFilter === "all" ||
      (material.material_tags &&
        material.material_tags.some((mt) => mt.tag_id === selectedTagFilter));

    return matchesSearch && matchesTag;
  });

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.contact_person &&
        supplier.contact_person
          .toLowerCase()
          .includes(searchQuery.toLowerCase()))
  );

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    {
      key: "materials" as TabType,
      label: "Materials",
      icon: Package,
      count: materials.length,
    },
    {
      key: "suppliers" as TabType,
      label: "Suppliers",
      icon: Building2,
      count: suppliers.length,
    },
    {
      key: "tags" as TabType,
      label: "Tags",
      icon: TagIcon,
      count: tags.length,
    },
    { key: "settings" as TabType, label: "Settings", icon: Settings },
  ];

  const renderTopSummaryCard = () => {
    const Card = ({
      title,
      count,
      color,
      onAdd,
    }: {
      title: string;
      count: number;
      color: "blue" | "green" | "purple" | "gray";
      onAdd?: () => void;
    }) => {
      const colors: any = {
        blue: {
          bg: "bg-blue-50",
          title: "text-blue-600",
          count: "text-blue-800",
          border: "border-blue-100",
          btn: "bg-blue-600",
        },
        green: {
          bg: "bg-green-50",
          title: "text-green-600",
          count: "text-green-800",
          border: "border-green-100",
          btn: "bg-green-600",
        },
        purple: {
          bg: "bg-purple-50",
          title: "text-purple-600",
          count: "text-purple-800",
          border: "border-purple-100",
          btn: "bg-purple-600",
        },
        gray: {
          bg: "bg-gray-50",
          title: "text-gray-600",
          count: "text-gray-800",
          border: "border-gray-200",
          btn: "bg-gray-600",
        },
      };
      const c = colors[color];
      return (
        <View
          className={`ml-2 ${c.bg} border ${c.border} rounded-lg px-3 py-2 h-10 justify-between`}
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className={`text-xs font-medium ${c.title}`}>{title}</Text>
            <Text className={`text-base font-bold ${c.count}`}>{count}</Text>
            {onAdd && (
              <TouchableOpacity
                onPress={onAdd}
                className={`${c.btn} px-2 py-1 rounded`}
              >
                <Text className="text-white text-xs font-medium">Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    };

    if (activeTab === "materials")
      return (
        <Card
          title="Materials"
          count={materials.length}
          color="blue"
          onAdd={() => {
            setSelectedMaterial(null);
            setShowMaterialForm(true);
          }}
        />
      );
    if (activeTab === "suppliers")
      return (
        <Card
          title="Suppliers"
          count={suppliers.length}
          color="green"
          onAdd={() => {
            setSelectedSupplier(null);
            setShowSupplierForm(true);
          }}
        />
      );
    if (activeTab === "tags")
      return <Card title="Tags" count={tags.length} color="purple" />;
    return <Card title="Settings" count={0} color="gray" />;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "materials":
        return (
          <ScrollView className="flex-1 px-6 py-4">
            {/* Materials List */}
            {filteredMaterials.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                suppliers={suppliers}
                units={units}
                onEdit={(m) => {
                  setSelectedMaterial(m);
                  setShowMaterialForm(true);
                }}
                onDelete={handleDeleteMaterial}
                onManageVariants={(m) => {
                  setSelectedMaterial(m);
                  setShowVariantManagement(true);
                }}
              />
            ))}

            {/* Results info */}
            {filteredMaterials.length > 0 && (
              <View className="bg-white rounded-lg p-3 mb-4 flex-row items-center justify-between">
                <Text className="text-sm font-medium text-gray-700">
                  {filteredMaterials.length} material
                  {filteredMaterials.length !== 1 ? "s" : ""} found
                  {selectedTagFilter !== "all" && (
                    <Text className="text-purple-600">
                      {" "}
                      in "{tags.find((t) => t.id === selectedTagFilter)?.name}"
                    </Text>
                  )}
                </Text>
                {selectedTagFilter !== "all" && (
                  <TouchableOpacity
                    onPress={() => setSelectedTagFilter("all")}
                    className="bg-gray-100 px-3 py-1 rounded-lg"
                  >
                    <Text className="text-xs text-gray-600">Clear filter</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {filteredMaterials.length === 0 && !loading && (
              <View className="bg-white rounded-lg p-8 text-center">
                <Package size={48} color="#9ca3af" />
                <Text className="text-gray-500 text-lg mt-4">
                  No materials found
                </Text>
                <Text className="text-gray-400 text-sm mt-2">
                  {searchQuery || selectedTagFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Add your first material to get started"}
                </Text>
                {(searchQuery || selectedTagFilter !== "all") && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery("");
                      setSelectedTagFilter("all");
                    }}
                    className="bg-blue-50 px-4 py-2 rounded-lg mt-3"
                  >
                    <Text className="text-blue-600 font-medium">
                      Clear all filters
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        );

      case "suppliers":
        return (
          <ScrollView className="flex-1 px-6 py-4">
            {/* Suppliers List */}
            {filteredSuppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                onEdit={(s) => {
                  setSelectedSupplier(s);
                  setShowSupplierForm(true);
                }}
                onDelete={handleDeleteSupplier}
                onViewProducts={(s) => {
                  setSelectedSupplier(s);
                  setShowSupplierProducts(true);
                }}
                onAddProducts={(s) => {
                  setSelectedSupplier(s);
                  setShowAddSupplierProduct(true);
                }}
              />
            ))}

            {filteredSuppliers.length === 0 && !loading && (
              <View className="bg-white rounded-lg p-8 text-center">
                <Building2 size={48} color="#9ca3af" />
                <Text className="text-gray-500 text-lg mt-4">
                  No suppliers found
                </Text>
                <Text className="text-gray-400 text-sm mt-2">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Add your first supplier to get started"}
                </Text>
              </View>
            )}
          </ScrollView>
        );

      case "tags":
        return (
          <ScrollView className="flex-1 px-6 py-4">
            <TagManagement
              tags={filteredTags}
              materials={materials}
              onCreateTag={handleCreateTag}
              onDeleteTag={handleDeleteTag}
              onUpdateTag={handleUpdateTag}
            />
          </ScrollView>
        );

      case "settings":
        return (
          <ScrollView className="flex-1 px-6 py-4">
            <View className="bg-white rounded-lg p-6">
              <Text className="text-xl font-bold text-gray-900 mb-6">
                Inventory Settings
              </Text>

              {/* System Statistics */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-3">
                  System Overview
                </Text>
                <View className="grid grid-cols-2 gap-3">
                  <View className="bg-blue-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-blue-600">
                      {materials.length}
                    </Text>
                    <Text className="text-sm text-blue-800">
                      Total Materials
                    </Text>
                  </View>
                  <View className="bg-green-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-green-600">
                      {materials.reduce(
                        (sum, m) => sum + (m.material_variants?.length || 0),
                        0
                      )}
                    </Text>
                    <Text className="text-sm text-green-800">
                      Total Variants
                    </Text>
                  </View>
                  <View className="bg-orange-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-orange-600">
                      {suppliers.length}
                    </Text>
                    <Text className="text-sm text-orange-800">
                      Total Suppliers
                    </Text>
                  </View>
                  <View className="bg-purple-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-purple-600">
                      {tags.length}
                    </Text>
                    <Text className="text-sm text-purple-800">Total Tags</Text>
                  </View>
                </View>
              </View>

              {/* Units of Measure */}
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-lg font-semibold text-gray-900">
                    Units of Measure ({units.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowUnitModal(true)}
                    className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
                  >
                    <Plus size={16} color="white" />
                    <Text className="ml-1 text-white font-medium">
                      Add Unit
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="bg-gray-50 p-4 rounded-lg">
                  <View className="flex-row flex-wrap">
                    {units.map((unit) => (
                      <View key={unit.id} className="relative mr-2 mb-2">
                        <Pressable
                          onHoverIn={() => setHoveredUnitId(unit.id)}
                          onHoverOut={() => setHoveredUnitId(null)}
                          className="bg-white px-3 py-1 rounded-full border border-gray-200"
                        >
                          <Text className="text-sm text-gray-700">
                            {unit.name}
                          </Text>
                        </Pressable>
                        {hoveredUnitId === unit.id && !!unit.description && (
                          <View className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 bg-black px-2 py-1 rounded shadow-lg z-10">
                            <Text className="text-[10px] text-white max-w-xs">
                              {unit.description}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              {/* Price Alert Configuration */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-3">
                  Price Alert Configuration
                </Text>
                <TouchableOpacity
                  onPress={() => setShowPriceAlerts(true)}
                  className="bg-yellow-50 p-4 rounded-lg flex-row items-center border border-yellow-200"
                >
                  <AlertTriangle size={20} color="#f59e0b" />
                  <View className="ml-3 flex-1">
                    <Text className="text-yellow-800 font-medium">
                      Configure Price Age Alerts
                    </Text>
                    <Text className="text-yellow-700 text-sm mt-1">
                      Set thresholds for price age warnings
                    </Text>
                    <View className="flex-row mt-2">
                      <View className="bg-yellow-100 px-2 py-1 rounded mr-2">
                        <Text className="text-xs text-yellow-800">
                          Warning: {priceSettings.warning_days}d
                        </Text>
                      </View>
                      <View className="bg-red-100 px-2 py-1 rounded">
                        <Text className="text-xs text-red-800">
                          Alert: {priceSettings.alert_days}d
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Actions */}
              <View className="space-y-3">
                <TouchableOpacity
                  onPress={() => loadData()}
                  className="bg-blue-50 p-4 rounded-lg flex-row items-center"
                >
                  <RefreshCw size={20} color="#3b82f6" />
                  <Text className="ml-3 text-blue-700 font-medium">
                    Refresh All Data
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <Text className="text-gray-500 text-lg">Loading inventory data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-6 py-4 bg-white border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            Inventory Management
          </Text>
          <TouchableOpacity
            onPress={() => loadData(false)}
            disabled={refreshing}
            className={`px-4 py-2 rounded-lg flex-row items-center ${
              refreshing ? "bg-gray-300" : "bg-blue-500"
            }`}
          >
            <Text className="text-white font-medium">
              {refreshing ? "Refreshing..." : "Refresh"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Top Tabs with compact right card inside container */}
        <TopTabs
          tabs={tabs.map((t) => ({
            key: t.key,
            label: t.label,
            count: t.count,
          }))}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as any)}
          rightSlot={renderTopSummaryCard()}
        />

        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3 mb-4">
          <Search size={20} color="#6b7280" />
          <TextInput
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-gray-900"
          />
        </View>

        {/* Tag Filter - Only show on materials tab */}
        {activeTab === "materials" && (
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Filter by Tag
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-2"
            >
              <View className="flex-row px-2">
                <TouchableOpacity
                  onPress={() => setSelectedTagFilter("all")}
                  className={`mr-3 px-3 py-2 rounded-lg ${
                    selectedTagFilter === "all"
                      ? "bg-purple-500"
                      : "bg-gray-200"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      selectedTagFilter === "all"
                        ? "text-white"
                        : "text-gray-700"
                    }`}
                  >
                    All Materials ({materials.length})
                  </Text>
                </TouchableOpacity>
                {tags.map((tag) => {
                  const materialCount = materials.filter(
                    (m) =>
                      m.material_tags &&
                      m.material_tags.some((mt) => mt.tag_id === tag.id)
                  ).length;
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      onPress={() => setSelectedTagFilter(tag.id)}
                      className={`mr-3 px-3 py-2 rounded-lg flex-row items-center ${
                        selectedTagFilter === tag.id
                          ? "bg-purple-500"
                          : "bg-gray-200"
                      }`}
                    >
                      <TagIcon
                        size={14}
                        color={
                          selectedTagFilter === tag.id ? "#ffffff" : "#6b7280"
                        }
                      />
                      <Text
                        className={`ml-1 text-sm font-medium ${
                          selectedTagFilter === tag.id
                            ? "text-white"
                            : "text-gray-700"
                        }`}
                      >
                        {tag.name} ({materialCount})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Material Form Modal */}
      <Modal
        visible={showMaterialForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1">
          <MaterialForm
            material={selectedMaterial || undefined}
            units={units}
            tags={tags}
            onSave={
              selectedMaterial ? handleUpdateMaterial : handleCreateMaterial
            }
            onCancel={() => {
              setShowMaterialForm(false);
              setSelectedMaterial(null);
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* Supplier Form Modal */}
      <Modal
        visible={showSupplierForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1">
          <SupplierForm
            supplier={selectedSupplier || undefined}
            onSave={
              selectedSupplier ? handleUpdateSupplier : handleCreateSupplier
            }
            onCancel={() => {
              setShowSupplierForm(false);
              setSelectedSupplier(null);
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* Variant Management Modal */}
      <Modal
        visible={showVariantManagement}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1">
          {selectedMaterial && (
            <VariantManagement
              material={selectedMaterial}
              suppliers={suppliers}
              units={units}
              onClose={() => {
                setShowVariantManagement(false);
                setSelectedMaterial(null);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
      {/* Supplier Products Modal (view-only) */}
      {showSupplierProducts && selectedSupplier && (
        <SupplierProductsModal
          visible={showSupplierProducts}
          supplier={selectedSupplier}
          allUnits={units}
          onUpdate={() => loadData(false)}
          onClose={() => {
            setShowSupplierProducts(false);
            setSelectedSupplier(null);
          }}
        />
      )}

      {/* Add Supplier Product Modal */}
      {showAddSupplierProduct && selectedSupplier && (
        <AddSupplierProductModal
          visible={showAddSupplierProduct}
          supplier={selectedSupplier}
          allMaterials={materials}
          allUnits={units}
          onClose={() => {
            setShowAddSupplierProduct(false);
            setSelectedSupplier(null);
          }}
          onUpdate={() => {
            // Refresh data to reflect new supplier products
            loadData(false);
          }}
        />
      )}

      {/* Price Alert Configuration Modal */}
      <Modal visible={showPriceAlerts} animationType="slide" transparent>
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-lg p-6">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-bold text-gray-900">
                  Price Alert Configuration
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  Set when to show price age warnings
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPriceAlerts(false)}
                className="p-2 rounded-full bg-gray-100"
              >
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Warning Threshold */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Warning Threshold (days)
              </Text>
              <View className="flex-row items-center">
                <TextInput
                  value={String(priceSettings.warning_days)}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setPriceSettings((prev) => ({
                      ...prev,
                      warning_days: num,
                    }));
                  }}
                  keyboardType="number-pad"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
                />
                <View className="ml-3 bg-yellow-100 px-3 py-2 rounded-lg">
                  <Text className="text-yellow-700 text-sm">⚠️ Warning</Text>
                </View>
              </View>
              <Text className="text-xs text-gray-500 mt-1">
                Show warning icon when price is older than{" "}
                {priceSettings.warning_days} days
              </Text>
            </View>

            {/* Alert Threshold */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Alert Threshold (days)
              </Text>
              <View className="flex-row items-center">
                <TextInput
                  value={String(priceSettings.alert_days)}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setPriceSettings((prev) => ({ ...prev, alert_days: num }));
                  }}
                  keyboardType="number-pad"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
                />
                <View className="ml-3 bg-red-100 px-3 py-2 rounded-lg">
                  <Text className="text-red-700 text-sm">🚨 Alert</Text>
                </View>
              </View>
              <Text className="text-xs text-gray-500 mt-1">
                Show alert icon when price is older than{" "}
                {priceSettings.alert_days} days
              </Text>
            </View>

            {/* Enable/Disable Toggle */}
            <TouchableOpacity
              onPress={() =>
                setPriceSettings((prev) => ({
                  ...prev,
                  enabled: !prev.enabled,
                }))
              }
              className="flex-row items-center justify-between mb-6 p-3 bg-gray-50 rounded-lg"
            >
              <Text className="text-gray-700 font-medium">
                Enable Price Alerts
              </Text>
              <View
                className={`w-12 h-6 rounded-full ${
                  priceSettings.enabled ? "bg-blue-500" : "bg-gray-300"
                }`}
              >
                <View
                  className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-all ${
                    priceSettings.enabled ? "ml-6" : "ml-0.5"
                  }`}
                />
              </View>
            </TouchableOpacity>

            {/* Status Indicators Preview */}
            <View className="bg-gray-50 rounded-lg p-4 mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-3">
                Status Indicators:
              </Text>
              <View className="space-y-2">
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-green-500 rounded-full mr-2" />
                  <Text className="text-sm text-gray-600">
                    Good - Price updated within {priceSettings.warning_days}{" "}
                    days
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-yellow-500 rounded-full mr-2" />
                  <Text className="text-sm text-gray-600">
                    Warning - Price {priceSettings.warning_days}-
                    {priceSettings.alert_days} days old
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-red-500 rounded-full mr-2" />
                  <Text className="text-sm text-gray-600">
                    Alert - Price older than {priceSettings.alert_days} days
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowPriceAlerts(false)}
                className="flex-1 bg-gray-100 py-3 rounded-lg"
              >
                <Text className="text-center text-gray-700 font-medium">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={savePriceSettings}
                disabled={loading}
                className="flex-1 bg-blue-500 py-3 rounded-lg flex-row items-center justify-center"
              >
                <Save size={16} color="white" />
                <Text className="text-center text-white font-medium ml-2">
                  {loading ? "Saving..." : "Save Settings"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Unit of Measure Modal */}
      <Modal visible={showUnitModal} animationType="slide" transparent>
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-lg p-6">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-bold text-gray-900">
                  Add Unit of Measure
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  Provide a name and optional description
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowUnitModal(false)}
                className="p-2 rounded-full bg-gray-100"
              >
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Unit Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Name *
              </Text>
              <TextInput
                value={newUnitName}
                onChangeText={setNewUnitName}
                placeholder="e.g., Kg, Ltr, Pcs"
                className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
              />
            </View>

            {/* Description */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </Text>
              <TextInput
                value={newUnitDescription}
                onChangeText={setNewUnitDescription}
                placeholder="Short description"
                multiline
                numberOfLines={3}
                className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
              />
            </View>

            {/* Actions */}
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowUnitModal(false)}
                className="flex-1 bg-gray-100 py-3 rounded-lg"
              >
                <Text className="text-center text-gray-700 font-medium">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateUnit}
                disabled={savingUnit}
                className="flex-1 bg-blue-500 py-3 rounded-lg flex-row items-center justify-center"
              >
                <Save size={16} color="white" />
                <Text className="text-center text-white font-medium ml-2">
                  {savingUnit ? "Saving..." : "Save Unit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Delete Material Modal */}
      <ConfirmModal
        visible={confirmDelete.visible}
        title="Delete Material"
        description={`Are you sure you want to delete "${
          confirmDelete.material?.name ?? ""
        }"? This will remove its variants, tags and supplier pricing.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={confirmDelete.loading}
        onCancel={() =>
          setConfirmDelete({ visible: false, material: null, loading: false })
        }
        onConfirm={confirmDeleteMaterial}
      >
        {confirmDelete.material ? (
          <View>
            <Text className="text-sm text-gray-700 mb-2">This will permanently delete:</Text>
            <View className="bg-red-50 border border-red-200 rounded-lg p-3">
              <Text className="text-xs text-red-800">
                {(confirmDelete.material.material_variants || []).length} variant(s)
                {" • "}
                {(confirmDelete.material.material_tags || []).length} tag link(s)
                {" • "}
                {(() => {
                  const vs = confirmDelete.material?.material_variants || [];
                  let c = 0;
                  vs.forEach(v => { c += (v.supplier_pricing?.length || 0); });
                  return `${c} supplier pricing record(s)`;
                })()}
              </Text>
            </View>

            <View className="mt-3">
              <Text className="text-sm font-medium text-gray-900">Variants</Text>
              { (confirmDelete.material.material_variants || []).length === 0 ? (
                <Text className="text-xs text-gray-500 mt-1">None</Text>
              ) : (
                (confirmDelete.material.material_variants || []).map((v) => (
                  <Text key={v.id} className="text-xs text-gray-700 mt-1">• {v.variant_name}</Text>
                ))
              )}
            </View>

            <View className="mt-3">
              <Text className="text-sm font-medium text-gray-900">Tag links</Text>
              { (confirmDelete.material.material_tags || []).length === 0 ? (
                <Text className="text-xs text-gray-500 mt-1">None</Text>
              ) : (
                (confirmDelete.material.material_tags || []).map((mt, idx) => (
                  <Text key={`${mt.tag_id}-${idx}`} className="text-xs text-gray-700 mt-1">• {mt.tags?.name || mt.tag_id}</Text>
                ))
              )}
            </View>

            <View className="mt-3">
              <Text className="text-sm font-medium text-gray-900">Supplier pricing</Text>
              {(() => {
                const vs = confirmDelete.material?.material_variants || [];
                const rows: { id: string; supplier: string; price: any; unit: string; variant: string }[] = [];
                vs.forEach(v => {
                  (v.supplier_pricing || []).forEach((p: any) => rows.push({
                    id: p.id,
                    supplier: p.suppliers?.name || 'Unknown',
                    price: p.price,
                    unit: p.units_of_measure?.name || 'unit',
                    variant: v.variant_name,
                  }));
                });
                if (rows.length === 0) return <Text className="text-xs text-gray-500 mt-1">None</Text>;
                return rows.map(r => (
                  <Text key={r.id} className="text-xs text-gray-700 mt-1">• {r.supplier}: AED {typeof r.price === 'number' ? r.price : String(r.price)} per {r.unit} — {r.variant}</Text>
                ));
              })()}
            </View>
          </View>
        ) : null}
      </ConfirmModal>
    </SafeAreaView>
  );
}
