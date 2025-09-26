import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Package, Building2, Tag as TagIcon, DollarSign, Settings, RefreshCw, AlertTriangle, X, Save } from 'lucide-react-native';
import { supabase } from '../../utils/api/supabase';

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
  materialTagOperations
} from '../../utils/api/inventory';

import { MaterialCard, SupplierCard, TagManagement, MaterialForm, VariantManagement, SupplierProductModal } from '../../components/inventory/InventoryComponents';

// Direct imports instead of lazy loading to avoid Suspense-related stalls
import { SupplierForm } from '../../components/inventory/InventoryForms';

import { ConfirmModal } from '../../components/ui/ConfirmModal';

// Tab types
type TabType = 'materials' | 'suppliers' | 'tags' | 'settings';

import { TopTabs } from '../../components/inventory/TopTabs';

export default function InventoryPage() {
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Data states
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitDescription, setNewUnitDescription] = useState('');
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showVariantManagement, setShowVariantManagement] = useState(false);
  const [showSupplierProducts, setShowSupplierProducts] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  // Price alert states
  const [showPriceAlerts, setShowPriceAlerts] = useState(false);
  const [priceSettings, setPriceSettings] = useState({
    warning_days: 90,
    alert_days: 180,
    enabled: true
  });

  // Confirm delete modal state
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; material: Material | null; loading: boolean }>({
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
        .from('app_settings')
        .select('value')
        .eq('key', 'price_alert_thresholds')
        .single();
      
      if (data?.value) {
        setPriceSettings(data.value);
      }
    } catch (error) {
      console.error('Error loading price settings:', error);
    }
  };

  const savePriceSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'price_alert_thresholds',
          value: priceSettings,
          description: 'Thresholds for supplier pricing age alerts (in days)',
          category: 'inventory'
        }, {
          onConflict: 'key'
        });
      
      if (error) throw error;
      
      Alert.alert('Success', 'Price alert settings saved successfully');
      setShowPriceAlerts(false);
    } catch (error) {
      console.error('Error saving price settings:', error);
      Alert.alert('Error', 'Failed to save settings');
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
      const [materialsResult, suppliersResult, tagsResult, unitsResult] = await Promise.all([
        materialOperations.getAll(),
        supplierOperations.getAll(),
        tagOperations.getAll(),
        unitOperations.getAll()
      ]);

      if (materialsResult.error || suppliersResult.error || tagsResult.error || unitsResult.error) {
        Alert.alert('Error', 'Failed to load inventory data');
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
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load inventory data');
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

      const { data: newMaterial, error } = await materialOperations.create(materialInfo);
      if (error) {
        Alert.alert('Error', 'Failed to create material');
        return;
      }

      // Handle tags if provided
      if (newMaterial && tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await materialTagOperations.addTagToMaterial(newMaterial.id, tagId);
        }
      }

      Alert.alert('Success', 'Material created successfully');
      setShowMaterialForm(false);
      setSelectedMaterial(null);
      loadData(false);
    } catch (error) {
      console.error('Error creating material:', error);
      Alert.alert('Error', 'Failed to create material');
    }
  };

  const handleUpdateMaterial = async (materialData: any) => {
    if (!selectedMaterial) return;
    
    try {
      const { error } = await materialOperations.update(selectedMaterial.id, materialData);
      if (error) {
        Alert.alert('Error', 'Failed to update material');
        return;
      }

      // Handle tags - first remove all existing tags, then add new ones
      if (materialData.tags) {
        // Add new tags
        for (const tagId of materialData.tags) {
          try {
            await materialTagOperations.addTagToMaterial(selectedMaterial.id, tagId);
          } catch (error) {
            // Tag might already exist, ignore error
          }
        }
      }

      Alert.alert('Success', 'Material updated successfully');
      setShowMaterialForm(false);
      setSelectedMaterial(null);
      loadData(false);
    } catch (error) {
      console.error('Error updating material:', error);
      Alert.alert('Error', 'Failed to update material');
    }
  };

  const handleDeleteMaterial = (material: Material) => {
    // Open confirmation modal
    setConfirmDelete({ visible: true, material, loading: false });
  };

  const confirmDeleteMaterial = async () => {
    if (!confirmDelete.material) return;
    try {
      setConfirmDelete(prev => ({ ...prev, loading: true }));
      console.log('🗑️ Deleting material (with cascade)...', confirmDelete.material.id);
      const { error } = await materialOperations.delete(confirmDelete.material.id);
      if (error) {
        console.error('Delete material error:', error);
        if (typeof alert === 'function') alert('Failed to delete material');
      } else {
      if (typeof alert === 'function') alert('Material deleted successfully');
        await loadData(false);

      }
    } catch (error) {
      console.error('Error deleting material:', error);
      if (typeof alert === 'function') alert('Failed to delete material');
    } finally {
      setConfirmDelete({ visible: false, material: null, loading: false });
    }
  };

  // Supplier operations
  const handleCreateSupplier = async (supplierData: any) => {
    try {
      const { error } = await supplierOperations.create(supplierData);
      if (error) {
        Alert.alert('Error', 'Failed to create supplier');
        return;
      }
      Alert.alert('Success', 'Supplier created successfully');
      setShowSupplierForm(false);
      setSelectedSupplier(null);
      loadData(false);
    } catch (error) {
      console.error('Error creating supplier:', error);
      Alert.alert('Error', 'Failed to create supplier');
    }
  };

  const handleUpdateSupplier = async (supplierData: any) => {
    if (!selectedSupplier) return;
    
    try {
      const { error } = await supplierOperations.update(selectedSupplier.id, supplierData);
      if (error) {
        Alert.alert('Error', 'Failed to update supplier');
        return;
      }
      Alert.alert('Success', 'Supplier updated successfully');
      setShowSupplierForm(false);
      setSelectedSupplier(null);
      loadData(false);
    } catch (error) {
      console.error('Error updating supplier:', error);
      Alert.alert('Error', 'Failed to update supplier');
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    Alert.alert(
      'Delete Supplier',
      `Are you sure you want to delete "${supplier.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supplierOperations.delete(supplier.id);
              if (error) {
                Alert.alert('Error', 'Failed to delete supplier');
                return;
              }
              Alert.alert('Success', 'Supplier deleted successfully');
              loadData(false);
            } catch (error) {
              console.error('Error deleting supplier:', error);
              Alert.alert('Error', 'Failed to delete supplier');
            }
          }
        }
      ]
    );
  };

  // Tag operations
  const handleCreateTag = async (name: string) => {
    try {
      const { error } = await tagOperations.create(name);
      if (error) {
        Alert.alert('Error', 'Failed to create tag');
        return;
      }
      Alert.alert('Success', 'Tag created successfully');
      loadData(false);
    } catch (error) {
      console.error('Error creating tag:', error);
      Alert.alert('Error', 'Failed to create tag');
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    try {
      const { error } = await tagOperations.delete(tag.id);
      if (error) {
        Alert.alert('Error', 'Failed to delete tag');
        return;
      }
      Alert.alert('Success', 'Tag deleted successfully');
      loadData(false);
    } catch (error) {
      console.error('Error deleting tag:', error);
      Alert.alert('Error', 'Failed to delete tag');
    }
  };

  // Unit operations (create only)
  const handleCreateUnit = async () => {
    const name = newUnitName.trim();
    const description = newUnitDescription.trim();
    if (!name) {
      Alert.alert('Error', 'Unit name is required');
      return;
    }
    // Prevent duplicates (case-insensitive)
    if (units.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Info', 'This unit already exists');
      return;
    }
    try {
      setSavingUnit(true);
      const payload: any = { name };
      if (description) payload.description = description;
      const { data, error } = await unitOperations.create(payload);
      if (error) {
        Alert.alert('Error', 'Failed to create unit');
        return;
      }
      if (data) {
        setUnits(prev => [...prev, data as UnitOfMeasure]);
        setNewUnitName('');
        setNewUnitDescription('');
        setShowUnitModal(false);
        Alert.alert('Success', 'Unit added');
      }
    } catch (e) {
      console.error('Error creating unit:', e);
      Alert.alert('Error', 'Failed to create unit');
    } finally {
      setSavingUnit(false);
    }
  };

  // Filter data based on search and tag
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (material.description && material.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTag = selectedTagFilter === 'all' ||
      (material.material_tags && material.material_tags.some(mt => mt.tag_id === selectedTagFilter));
    
    return matchesSearch && matchesTag;
  });

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (supplier.contact_person && supplier.contact_person.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { key: 'materials' as TabType, label: 'Materials', icon: Package, count: materials.length },
    { key: 'suppliers' as TabType, label: 'Suppliers', icon: Building2, count: suppliers.length },
    { key: 'tags' as TabType, label: 'Tags', icon: TagIcon, count: tags.length },
    { key: 'settings' as TabType, label: 'Settings', icon: Settings }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'materials':
        return (
          <ScrollView className="flex-1 px-6 py-4">
            {/* Add Material Button */}
            <TouchableOpacity
              onPress={() => setShowMaterialForm(true)}
              className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4 flex-row items-center justify-center"
            >
              <Plus size={20} color="#6b7280" />
              <Text className="ml-2 text-gray-600 font-medium">Add New Material</Text>
            </TouchableOpacity>

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
                  {filteredMaterials.length} material{filteredMaterials.length !== 1 ? 's' : ''} found
                  {selectedTagFilter !== 'all' && (
                    <Text className="text-purple-600"> in "{tags.find(t => t.id === selectedTagFilter)?.name}"</Text>
                  )}
                </Text>
                {selectedTagFilter !== 'all' && (
                  <TouchableOpacity 
                    onPress={() => setSelectedTagFilter('all')}
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
                <Text className="text-gray-500 text-lg mt-4">No materials found</Text>
                <Text className="text-gray-400 text-sm mt-2">
                  {searchQuery || selectedTagFilter !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : 'Add your first material to get started'
                  }
                </Text>
                {(searchQuery || selectedTagFilter !== 'all') && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedTagFilter('all');
                    }}
                    className="bg-blue-50 px-4 py-2 rounded-lg mt-3"
                  >
                    <Text className="text-blue-600 font-medium">Clear all filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        );

      case 'suppliers':
        return (
          <ScrollView className="flex-1 px-6 py-4">
            {/* Add Supplier Button */}
            <TouchableOpacity
              onPress={() => setShowSupplierForm(true)}
              className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4 flex-row items-center justify-center"
            >
              <Plus size={20} color="#6b7280" />
              <Text className="ml-2 text-gray-600 font-medium">Add New Supplier</Text>
            </TouchableOpacity>

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
              />
            ))}

            {filteredSuppliers.length === 0 && !loading && (
              <View className="bg-white rounded-lg p-8 text-center">
                <Building2 size={48} color="#9ca3af" />
                <Text className="text-gray-500 text-lg mt-4">No suppliers found</Text>
                <Text className="text-gray-400 text-sm mt-2">
                  {searchQuery ? 'Try adjusting your search' : 'Add your first supplier to get started'}
                </Text>
              </View>
            )}
          </ScrollView>
        );

      case 'tags':
        return (
          <ScrollView className="flex-1 px-6 py-4">
            <TagManagement
              tags={filteredTags}
              materials={materials}
              onCreateTag={handleCreateTag}
              onDeleteTag={handleDeleteTag}
            />
          </ScrollView>
        );

      case 'settings':
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
                    <Text className="text-2xl font-bold text-blue-600">{materials.length}</Text>
                    <Text className="text-sm text-blue-800">Total Materials</Text>
                  </View>
                  <View className="bg-green-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-green-600">{materials.reduce((sum, m) => sum + (m.material_variants?.length || 0), 0)}</Text>
                    <Text className="text-sm text-green-800">Total Variants</Text>
                  </View>
                  <View className="bg-orange-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-orange-600">{suppliers.length}</Text>
                    <Text className="text-sm text-orange-800">Total Suppliers</Text>
                  </View>
                  <View className="bg-purple-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-purple-600">{tags.length}</Text>
                    <Text className="text-sm text-purple-800">Total Tags</Text>
                  </View>
                </View>
              </View>

              {/* Units of Measure */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-3">
                  Units of Measure ({units.length})
                </Text>
                <View className="bg-gray-50 p-4 rounded-lg">
                  <View className="flex-row justify-end mb-3">
                    <TouchableOpacity
                      onPress={() => setShowUnitModal(true)}
                      className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
                    >
                      <Plus size={16} color="white" />
                      <Text className="ml-1 text-white font-medium">Add Unit</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row flex-wrap">
                    {units.map((unit) => (
                      <View key={unit.id} className="bg-white px-3 py-1 rounded-full mr-2 mb-2">
                        <Text className="text-sm text-gray-700">{unit.name}</Text>
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
                    <Text className="text-yellow-800 font-medium">Configure Price Age Alerts</Text>
                    <Text className="text-yellow-700 text-sm mt-1">
                      Set thresholds for price age warnings
                    </Text>
                    <View className="flex-row mt-2">
                      <View className="bg-yellow-100 px-2 py-1 rounded mr-2">
                        <Text className="text-xs text-yellow-800">Warning: {priceSettings.warning_days}d</Text>
                      </View>
                      <View className="bg-red-100 px-2 py-1 rounded">
                        <Text className="text-xs text-red-800">Alert: {priceSettings.alert_days}d</Text>
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
                  <Text className="ml-3 text-blue-700 font-medium">Refresh All Data</Text>
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
            className={`px-4 py-2 rounded-lg flex-row items-center ${refreshing ? 'bg-gray-300' : 'bg-blue-500'}`}
          >
            <Text className="text-white font-medium">{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>

        {/* Top Tabs */}
        <TopTabs
          tabs={tabs.map(t => ({ key: t.key, label: t.label, count: t.count }))}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as any)}
        />

        {/* Summary Card under Tabs (show only for the active tab) */}
        <View className="mb-4 mt-3">
          {activeTab === 'materials' && (
            <View className="bg-blue-50 p-3 rounded-lg">
              <Text className="text-sm text-blue-600 font-medium">Materials</Text>
              <Text className="text-lg font-bold text-blue-900">{materials.length}</Text>
            </View>
          )}
          {activeTab === 'suppliers' && (
            <View className="bg-green-50 p-3 rounded-lg">
              <Text className="text-sm text-green-600 font-medium">Suppliers</Text>
              <Text className="text-lg font-bold text-green-900">{suppliers.length}</Text>
            </View>
          )}
          {activeTab === 'tags' && (
            <View className="bg-purple-50 p-3 rounded-lg">
              <Text className="text-sm text-purple-600 font-medium">Tags</Text>
              <Text className="text-lg font-bold text-purple-900">{tags.length}</Text>
            </View>
          )}
        </View>

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
        {activeTab === 'materials' && (
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Filter by Tag</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2">
              <View className="flex-row px-2">
                <TouchableOpacity
                  onPress={() => setSelectedTagFilter('all')}
                  className={`mr-3 px-3 py-2 rounded-lg ${
                    selectedTagFilter === 'all'
                      ? 'bg-purple-500'
                      : 'bg-gray-200'
                  }`}
                >
                  <Text className={`text-sm font-medium ${
                    selectedTagFilter === 'all'
                      ? 'text-white'
                      : 'text-gray-700'
                  }`}>
                    All Materials ({materials.length})
                  </Text>
                </TouchableOpacity>
                {tags.map((tag) => {
                  const materialCount = materials.filter(m => 
                    m.material_tags && m.material_tags.some(mt => mt.tag_id === tag.id)
                  ).length;
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      onPress={() => setSelectedTagFilter(tag.id)}
                      className={`mr-3 px-3 py-2 rounded-lg flex-row items-center ${
                        selectedTagFilter === tag.id
                          ? 'bg-purple-500'
                          : 'bg-gray-200'
                      }`}
                    >
                      <TagIcon size={14} color={selectedTagFilter === tag.id ? '#ffffff' : '#6b7280'} />
                      <Text className={`ml-1 text-sm font-medium ${
                        selectedTagFilter === tag.id
                          ? 'text-white'
                          : 'text-gray-700'
                      }`}>
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
      <Modal visible={showMaterialForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1">
          <MaterialForm
            material={selectedMaterial || undefined}
            units={units}
            tags={tags}
            onSave={selectedMaterial ? handleUpdateMaterial : handleCreateMaterial}
            onCancel={() => {
              setShowMaterialForm(false);
              setSelectedMaterial(null);
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* Supplier Form Modal */}
      <Modal visible={showSupplierForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1">
          <SupplierForm
            supplier={selectedSupplier || undefined}
            onSave={selectedSupplier ? handleUpdateSupplier : handleCreateSupplier}
            onCancel={() => {
              setShowSupplierForm(false);
              setSelectedSupplier(null);
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* Variant Management Modal */}
      <Modal visible={showVariantManagement} animationType="slide" presentationStyle="pageSheet">
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
      {/* Supplier Product Modal */}
      {showSupplierProducts && selectedSupplier && (
        <SupplierProductModal
          visible={showSupplierProducts}
          supplier={selectedSupplier}
          allMaterials={materials}
          allUnits={units}
          onClose={() => {
            setShowSupplierProducts(false);
            setSelectedSupplier(null);
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
                    setPriceSettings(prev => ({ ...prev, warning_days: num }));
                  }}
                  keyboardType="number-pad"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
                />
                <View className="ml-3 bg-yellow-100 px-3 py-2 rounded-lg">
                  <Text className="text-yellow-700 text-sm">⚠️ Warning</Text>
                </View>
              </View>
              <Text className="text-xs text-gray-500 mt-1">
                Show warning icon when price is older than {priceSettings.warning_days} days
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
                    setPriceSettings(prev => ({ ...prev, alert_days: num }));
                  }}
                  keyboardType="number-pad"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
                />
                <View className="ml-3 bg-red-100 px-3 py-2 rounded-lg">
                  <Text className="text-red-700 text-sm">🚨 Alert</Text>
                </View>
              </View>
              <Text className="text-xs text-gray-500 mt-1">
                Show alert icon when price is older than {priceSettings.alert_days} days
              </Text>
            </View>

            {/* Enable/Disable Toggle */}
            <TouchableOpacity
              onPress={() => setPriceSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className="flex-row items-center justify-between mb-6 p-3 bg-gray-50 rounded-lg"
            >
              <Text className="text-gray-700 font-medium">Enable Price Alerts</Text>
              <View className={`w-12 h-6 rounded-full ${
                priceSettings.enabled ? 'bg-blue-500' : 'bg-gray-300'
              }`}>
                <View className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-all ${
                  priceSettings.enabled ? 'ml-6' : 'ml-0.5'
                }`} />
              </View>
            </TouchableOpacity>

            {/* Status Indicators Preview */}
            <View className="bg-gray-50 rounded-lg p-4 mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-3">Status Indicators:</Text>
              <View className="space-y-2">
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-green-500 rounded-full mr-2" />
                  <Text className="text-sm text-gray-600">Good - Price updated within {priceSettings.warning_days} days</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-yellow-500 rounded-full mr-2" />
                  <Text className="text-sm text-gray-600">Warning - Price {priceSettings.warning_days}-{priceSettings.alert_days} days old</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-red-500 rounded-full mr-2" />
                  <Text className="text-sm text-gray-600">Alert - Price older than {priceSettings.alert_days} days</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowPriceAlerts(false)}
                className="flex-1 bg-gray-100 py-3 rounded-lg"
              >
                <Text className="text-center text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={savePriceSettings}
                disabled={loading}
                className="flex-1 bg-blue-500 py-3 rounded-lg flex-row items-center justify-center"
              >
                <Save size={16} color="white" />
                <Text className="text-center text-white font-medium ml-2">
                  {loading ? 'Saving...' : 'Save Settings'}
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
                <Text className="text-xl font-bold text-gray-900">Add Unit of Measure</Text>
                <Text className="text-sm text-gray-600 mt-1">Provide a name and optional description</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUnitModal(false)} className="p-2 rounded-full bg-gray-100">
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Unit Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Name *</Text>
              <TextInput
                value={newUnitName}
                onChangeText={setNewUnitName}
                placeholder="e.g., Kg, Ltr, Pcs"
                className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
              />
            </View>

            {/* Description */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">Description (optional)</Text>
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
                <Text className="text-center text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateUnit}
                disabled={savingUnit}
                className="flex-1 bg-blue-500 py-3 rounded-lg flex-row items-center justify-center"
              >
                <Save size={16} color="white" />
                <Text className="text-center text-white font-medium ml-2">{savingUnit ? 'Saving...' : 'Save Unit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Delete Material Modal */}
      <ConfirmModal
        visible={confirmDelete.visible}
        title="Delete Material"
        description={`Are you sure you want to delete "${confirmDelete.material?.name ?? ''}"? This will remove its variants, tags and supplier pricing.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={confirmDelete.loading}
        onCancel={() => setConfirmDelete({ visible: false, material: null, loading: false })}
        onConfirm={confirmDeleteMaterial}
      />
    </SafeAreaView>
  );
}
