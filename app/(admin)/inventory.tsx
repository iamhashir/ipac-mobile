import React, { useState, useEffect } from "react";
import { Alert, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../utils/api/supabase";

// Import our inventory API functions
import {
  Material,
  Supplier,
  Tag,
  UnitOfMeasure,
  materialOperations,
  supplierOperations,
  tagOperations,
  unitOperations,
  materialTagOperations,
} from "../../utils/api/inventory";

// Import the new modular components
import {
  HeaderSection,
  SummaryCard,
  MaterialsTab,
  SuppliersTab,
  TagsTab,
  SettingsTab,
  ModalsContainer,
} from "../../components/admin/inventory/material";

// Tab types
type TabType = "materials" | "suppliers" | "tags" | "settings";

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

  // Helper functions for component callbacks
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedTagFilter("all");
  };

  const handleAddMaterial = () => {
    setSelectedMaterial(null);
    setShowMaterialForm(true);
  };

  const handleAddSupplier = () => {
    setSelectedSupplier(null);
    setShowSupplierForm(true);
  };

  const handleEditMaterial = (material: Material) => {
    setSelectedMaterial(material);
    setShowMaterialForm(true);
  };

  const handleManageVariants = (material: Material) => {
    setSelectedMaterial(material);
    setShowVariantManagement(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierForm(true);
  };

  const handleViewProducts = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierProducts(true);
  };

  const handleAddProducts = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowAddSupplierProduct(true);
  };

  const renderSummaryCard = () => (
    <SummaryCard
      activeTab={activeTab}
      materials={materials}
      suppliers={suppliers}
      tags={tags}
      onAddMaterial={handleAddMaterial}
      onAddSupplier={handleAddSupplier}
    />
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "materials":
        return (
          <MaterialsTab
            filteredMaterials={filteredMaterials}
            suppliers={suppliers}
            units={units}
            tags={tags}
            selectedTagFilter={selectedTagFilter}
            searchQuery={searchQuery}
            loading={loading}
            onEditMaterial={handleEditMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onManageVariants={handleManageVariants}
            onClearFilters={handleClearFilters}
          />
        );

      case "suppliers":
        return (
          <SuppliersTab
            filteredSuppliers={filteredSuppliers}
            searchQuery={searchQuery}
            loading={loading}
            onEditSupplier={handleEditSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onViewProducts={handleViewProducts}
            onAddProducts={handleAddProducts}
          />
        );

      case "tags":
        return (
          <TagsTab
            filteredTags={filteredTags}
            materials={materials}
            onCreateTag={handleCreateTag}
            onDeleteTag={handleDeleteTag}
            onUpdateTag={handleUpdateTag}
          />
        );

      case "settings":
        return (
          <SettingsTab
            materials={materials}
            suppliers={suppliers}
            tags={tags}
            units={units}
            priceSettings={priceSettings}
            onShowUnitModal={() => setShowUnitModal(true)}
            onShowPriceAlerts={() => setShowPriceAlerts(true)}
            onRefreshData={() => loadData()}
          />
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
      <HeaderSection
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedTagFilter={selectedTagFilter}
        setSelectedTagFilter={setSelectedTagFilter}
        refreshing={refreshing}
        onRefresh={() => loadData(false)}
        materials={materials}
        suppliers={suppliers}
        tags={tags}
        renderTopSummaryCard={renderSummaryCard}
      />

      {/* Tab Content */}
      {renderTabContent()}

      <ModalsContainer
        // Modal visibility states
        showMaterialForm={showMaterialForm}
        showSupplierForm={showSupplierForm}
        showVariantManagement={showVariantManagement}
        showSupplierProducts={showSupplierProducts}
        showAddSupplierProduct={showAddSupplierProduct}
        showPriceAlerts={showPriceAlerts}
        showUnitModal={showUnitModal}
        confirmDelete={confirmDelete}

        // Selected items
        selectedMaterial={selectedMaterial}
        selectedSupplier={selectedSupplier}

        // Data arrays
        materials={materials}
        suppliers={suppliers}
        units={units}
        tags={tags}

        // Form state
        newUnitName={newUnitName}
        newUnitDescription={newUnitDescription}
        savingUnit={savingUnit}
        priceSettings={priceSettings}
        loading={loading}

        // Event handlers
        onCreateMaterial={handleCreateMaterial}
        onUpdateMaterial={handleUpdateMaterial}
        onCreateSupplier={handleCreateSupplier}
        onUpdateSupplier={handleUpdateSupplier}
        onCreateUnit={handleCreateUnit}
        onSavePriceSettings={savePriceSettings}
        onConfirmDeleteMaterial={confirmDeleteMaterial}
        onUpdateData={() => loadData(false)}

        // State setters
        setShowMaterialForm={setShowMaterialForm}
        setSelectedMaterial={setSelectedMaterial}
        setShowSupplierForm={setShowSupplierForm}
        setSelectedSupplier={setSelectedSupplier}
        setShowVariantManagement={setShowVariantManagement}
        setShowSupplierProducts={setShowSupplierProducts}
        setShowAddSupplierProduct={setShowAddSupplierProduct}
        setShowPriceAlerts={setShowPriceAlerts}
        setShowUnitModal={setShowUnitModal}
        setNewUnitName={setNewUnitName}
        setNewUnitDescription={setNewUnitDescription}
        setPriceSettings={setPriceSettings}
        setConfirmDelete={setConfirmDelete}
      />
    </SafeAreaView>
  );
}
