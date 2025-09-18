import React, { useState, useEffect, Suspense } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Package, Building2, Tag as TagIcon, DollarSign, Settings } from 'lucide-react-native';

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

import { MaterialCard, SupplierCard, TagManagement } from '../../components/inventory/InventoryComponents';

// Lazy-load heavy forms/panels used conditionally
const MaterialForm = React.lazy(() => import('../../components/inventory/InventoryComponents').then(m => ({ default: m.MaterialForm })));
const VariantManagement = React.lazy(() => import('../../components/inventory/InventoryComponents').then(m => ({ default: m.VariantManagement })));
const SupplierForm = React.lazy(() => import('../../components/inventory/InventoryForms').then(m => ({ default: m.SupplierForm })));

import { ConfirmModal } from '../../components/ui/ConfirmModal';

// Tab types
type TabType = 'materials' | 'suppliers' | 'tags' | 'settings';

import { TopTabs } from '../../components/inventory/TopTabs';
import { getInventoryCache, setInventoryCache, getStaleInventoryCache } from '../../utils/cache/inventoryCache';

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
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showVariantManagement, setShowVariantManagement] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Confirm delete modal state
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; material: Material | null; loading: boolean }>({
    visible: false,
    material: null,
    loading: false,
  });

  // Load initial data
  useEffect(() => {
    loadData(true, true);
  }, []);

  const loadData = async (showLoader: boolean = false, useCache: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      // Use cached data if available and allowed
      if (useCache) {
        const cached = await getInventoryCache(60000); // 60s TTL
        if (cached) {
          setMaterials(cached.materials);
          setSuppliers(cached.suppliers);
          setTags(cached.tags);
          setUnits(cached.units);
          if (showLoader) setLoading(false); else setRefreshing(false);
          return;
        }
      }

      const [materialsResult, suppliersResult, tagsResult, unitsResult] = await Promise.all([
        materialOperations.getAll(),
        supplierOperations.getAll(),
        tagOperations.getAll(),
        unitOperations.getAll()
      ]);

      if (materialsResult.error || suppliersResult.error || tagsResult.error || unitsResult.error) {
        // Try stale cache instead of bailing
        const stale = await getStaleInventoryCache();
        if (stale) {
          setMaterials(stale.materials || []);
          setSuppliers(stale.suppliers || []);
          setTags(stale.tags || []);
          setUnits(stale.units || []);
        } else {
          Alert.alert('Error', 'Failed to load inventory data');
        }
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

      // update cache
      setInventoryCache({ materials: m, suppliers: s, tags: t, units: u });
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
    { key: 'settings' as TabType, label: 'Settings', icon: Settings, count: 0 }
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
              <Text className="text-lg font-semibold text-gray-900 mb-4">
                Inventory Settings
              </Text>
              <Text className="text-gray-600">
                Settings and configuration options coming soon.
              </Text>
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
            onPress={() => loadData(false, false)}
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

        {/* Summary Cards under Tabs */}
        <View className="flex-row mb-4 space-x-3 mt-3">
          <View className="flex-1 bg-blue-50 p-3 rounded-lg">
            <Text className="text-sm text-blue-600 font-medium">Materials</Text>
            <Text className="text-lg font-bold text-blue-900">{materials.length}</Text>
          </View>
          <View className="flex-1 bg-green-50 p-3 rounded-lg">
            <Text className="text-sm text-green-600 font-medium">Suppliers</Text>
            <Text className="text-lg font-bold text-green-900">{suppliers.length}</Text>
          </View>
          <View className="flex-1 bg-purple-50 p-3 rounded-lg">
            <Text className="text-sm text-purple-600 font-medium">Tags</Text>
            <Text className="text-lg font-bold text-purple-900">{tags.length}</Text>
          </View>
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
          <Suspense fallback={<View className="p-4"><Text>Loading material form...</Text></View>}>
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
          </Suspense>
        </SafeAreaView>
      </Modal>

      {/* Supplier Form Modal */}
      <Modal visible={showSupplierForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1">
          <Suspense fallback={<View className="p-4"><Text>Loading supplier form...</Text></View>}>
            <SupplierForm
              supplier={selectedSupplier || undefined}
              onSave={selectedSupplier ? handleUpdateSupplier : handleCreateSupplier}
              onCancel={() => {
                setShowSupplierForm(false);
                setSelectedSupplier(null);
              }}
            />
          </Suspense>
        </SafeAreaView>
      </Modal>

      {/* Variant Management Modal */}
      <Modal visible={showVariantManagement} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1">
          {selectedMaterial && (
            <Suspense fallback={<View className="p-4"><Text>Loading variants...</Text></View>}>
              <VariantManagement
                material={selectedMaterial}
                suppliers={suppliers}
                units={units}
                onClose={() => {
                  setShowVariantManagement(false);
                  setSelectedMaterial(null);
                }}
              />
            </Suspense>
          )}
        </SafeAreaView>
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
