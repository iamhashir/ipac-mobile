import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Search, 
  Plus, 
  Package, 
  Building2, 
  Tag as TagIcon, 
  Settings, 
  Filter,
  RefreshCw,
  AlertTriangle
} from 'lucide-react-native';

// Import our API functions and types
import {
  Material,
  MaterialVariant,
  Supplier,
  Tag,
  UnitOfMeasure,
  materialOperations,
  variantOperations,
  supplierOperations,
  tagOperations,
  unitOperations,
  materialTagOperations,
  pricingOperations
} from '../../utils/api/inventory';

// Import our components
import { 
  MaterialCard, 
  MaterialForm, 
  VariantManagement, 
  SupplierCard, 
  TagManagement 
} from '../../components/inventory/InventoryComponents';
import { 
  SupplierForm, 
  VariantForm, 
  SupplierPricingForm 
} from '../../components/inventory/InventoryForms';

type TabType = 'materials' | 'suppliers' | 'tags' | 'settings';

export default function ComprehensiveInventory() {
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  
  // Modal states
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showVariantManagement, setShowVariantManagement] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Filter states
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');

  // Load initial data
  const loadData = async (showLoader = true) => {
    console.log('🔄 loadData started, showLoader:', showLoader);
    if (showLoader) setLoading(true);
    setRefreshing(true);

    try {
      console.log('📊 Fetching all data...');
      const [materialsRes, suppliersRes, tagsRes, unitsRes] = await Promise.all([
        materialOperations.getAll(),
        supplierOperations.getAll(),
        tagOperations.getAll(),
        unitOperations.getAll()
      ]);
      console.log('📊 All data fetched successfully');

      console.log('🧾 Processing materials...', materialsRes.error ? 'ERROR' : 'OK');
      if (materialsRes.error) {
        console.error('Materials error:', materialsRes.error);
        Alert.alert('Error', 'Failed to load materials');
      } else {
        setMaterials(materialsRes.data || []);
      }

      console.log('🏢 Processing suppliers...', suppliersRes.error ? 'ERROR' : 'OK');
      if (suppliersRes.error) {
        console.error('Suppliers error:', suppliersRes.error);
        Alert.alert('Error', 'Failed to load suppliers');
      } else {
        setSuppliers(suppliersRes.data || []);
      }

      console.log('🏷️ Processing tags...', tagsRes.error ? 'ERROR' : 'OK');
      if (tagsRes.error) {
        console.error('Tags error:', tagsRes.error);
        Alert.alert('Error', 'Failed to load tags');
      } else {
        setTags(tagsRes.data || []);
      }

      console.log('📏 Processing units...', unitsRes.error ? 'ERROR' : 'OK');
      if (unitsRes.error) {
        console.error('Units error:', unitsRes.error);
        Alert.alert('Error', 'Failed to load units');
      } else {
        setUnits(unitsRes.data || []);
      }
      console.log('✅ All data processing complete');
    } catch (error) {
      console.error('💥 Exception in loadData:', error);
      Alert.alert('Error', 'Failed to load data');
      console.error('Error loading data:', error);
    } finally {
      console.log('🏁 loadData finishing - setting loading states to false');
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Material operations
  const handleCreateMaterial = async (materialData: any) => {
    try {
      const { tags: tagIds, ...materialInfo } = materialData;
      
      // Create material
      const { data: newMaterial, error } = await materialOperations.create(materialInfo);
      
      if (error) {
        console.error('Create material error:', error);
        Alert.alert('Error', 'Failed to create material');
        return;
      }

      // Add tags if any
      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await materialTagOperations.addTagToMaterial(newMaterial.id, tagId);
        }
      }

      Alert.alert('Success', 'Material created successfully');
      setShowMaterialForm(false);
      setSelectedMaterial(null);
      loadData(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to create material');
      console.error('Error creating material:', error);
    }
  };

  const handleUpdateMaterial = async (materialData: any) => {
    if (!selectedMaterial) return;

    try {
      const { tags: tagIds, ...materialInfo } = materialData;
      
      // Update material
      const { error } = await materialOperations.update(selectedMaterial.id, materialInfo);
      if (error) {
        Alert.alert('Error', 'Failed to update material');
        return;
      }

      // Update tags - remove existing and add new ones
      if (selectedMaterial.material_tags) {
        for (const materialTag of selectedMaterial.material_tags) {
          await materialTagOperations.removeTagFromMaterial(
            selectedMaterial.id, 
            materialTag.tag_id
          );
        }
      }

      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await materialTagOperations.addTagToMaterial(selectedMaterial.id, tagId);
        }
      }

      Alert.alert('Success', 'Material updated successfully');
      setShowMaterialForm(false);
      setSelectedMaterial(null);
      loadData(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update material');
      console.error('Error updating material:', error);
    }
  };

  const handleDeleteMaterial = async (material: Material) => {
    console.log('🎯 handleDeleteMaterial called with:', material.name, material.id);
    
    // Web-compatible confirmation
    const confirmed = window?.confirm?.(
      `Are you sure you want to delete "${material.name}"? This action cannot be undone.`
    );
    
    if (!confirmed) {
      console.log('🚫 Delete cancelled');
      return;
    }
    
    console.log('✅ Delete confirmed, proceeding...');
    
    console.log('🗑️ Attempting to delete material:', material.id, material.name);
    try {
      const { error } = await materialOperations.delete(material.id);
      console.log('🗑️ Delete result:', { error });
      if (error) {
        console.error('Delete material error:', error);
        alert('Failed to delete material: ' + (error.message || 'Unknown error'));
        return;
      }
      console.log('✅ Material deleted successfully');
      alert('Material deleted successfully');
      loadData(false);
    } catch (error) {
      console.error('💥 Exception deleting material:', error);
      alert('Failed to delete material: ' + (error?.message || 'Unknown error'));
      console.error('Error deleting material:', error);
    }
  };

  // Supplier operations
  const handleCreateSupplier = async (supplierData: any) => {
    try {
      const { error } = await supplierOperations.create(supplierData);
      
      if (error) {
        console.error('Create supplier error:', error);
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
      Alert.alert('Error', 'Failed to update supplier');
      console.error('Error updating supplier:', error);
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
              Alert.alert('Error', 'Failed to delete supplier');
              console.error('Error deleting supplier:', error);
            }
          }
        }
      ]
    );
  };

  // Tag operations
  const handleCreateTag = async (tagName: string) => {
    try {
      const { error } = await tagOperations.create(tagName);
      if (error) {
        Alert.alert('Error', 'Failed to create tag');
        return;
      }
      Alert.alert('Success', 'Tag created successfully');
      loadData(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to create tag');
      console.error('Error creating tag:', error);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    Alert.alert(
      'Delete Tag',
      `Are you sure you want to delete the tag "${tag.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await tagOperations.delete(tag.id);
              if (error) {
                Alert.alert('Error', 'Failed to delete tag');
                return;
              }
              Alert.alert('Success', 'Tag deleted successfully');
              loadData(false);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete tag');
              console.error('Error deleting tag:', error);
            }
          }
        }
      ]
    );
  };

  // Filter materials based on search and tag filter
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = !searchQuery || 
      material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.material_variants?.some(variant => 
        variant.variant_name.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesTag = !selectedTagFilter || 
      material.material_tags?.some(mt => mt.tag_id === selectedTagFilter);

    return matchesSearch && matchesTag;
  });

  const filteredSuppliers = suppliers.filter(supplier =>
    !searchQuery ||
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate statistics
  const stats = {
    totalMaterials: materials.length,
    totalVariants: materials.reduce((sum, m) => sum + (m.material_variants?.length || 0), 0),
    totalSuppliers: suppliers.length,
    totalTags: tags.length,
    materialsWithVariants: materials.filter(m => m.material_variants && m.material_variants.length > 0).length,
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'materials':
        return (
          <View className="flex-1">
            {/* Materials Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-semibold text-gray-900">
                Materials ({filteredMaterials.length})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedMaterial(null);
                  setShowMaterialForm(true);
                }}
                className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
              >
                <Plus size={16} color="white" />
                <Text className="ml-2 text-white font-medium">Add Material</Text>
              </TouchableOpacity>
            </View>

            {/* Tag Filter */}
            {tags.length > 0 && (
              <View className="mb-4">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row">
                    <TouchableOpacity
                      onPress={() => setSelectedTagFilter('')}
                      className={`px-3 py-2 rounded-full mr-2 border ${
                        !selectedTagFilter 
                          ? 'bg-blue-100 border-blue-300' 
                          : 'bg-gray-100 border-gray-300'
                      }`}
                    >
                      <Text className={`text-sm ${
                        !selectedTagFilter ? 'text-blue-800 font-medium' : 'text-gray-700'
                      }`}>
                        All Tags
                      </Text>
                    </TouchableOpacity>
                    {tags.map((tag) => (
                      <TouchableOpacity
                        key={tag.id}
                        onPress={() => setSelectedTagFilter(tag.id)}
                        className={`px-3 py-2 rounded-full mr-2 border ${
                          selectedTagFilter === tag.id 
                            ? 'bg-blue-100 border-blue-300' 
                            : 'bg-gray-100 border-gray-300'
                        }`}
                      >
                        <Text className={`text-sm ${
                          selectedTagFilter === tag.id ? 'text-blue-800 font-medium' : 'text-gray-700'
                        }`}>
                          {tag.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Materials List */}
            {filteredMaterials.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                onEdit={(mat) => {
                  setSelectedMaterial(mat);
                  setShowMaterialForm(true);
                }}
                onDelete={handleDeleteMaterial}
                onManageVariants={(mat) => {
                  setSelectedMaterial(mat);
                  setShowVariantManagement(true);
                }}
              />
            ))}

            {filteredMaterials.length === 0 && !loading && (
              <View className="bg-white rounded-lg p-8 items-center">
                <Package size={48} color="#9ca3af" />
                <Text className="text-gray-500 text-lg mt-4">No materials found</Text>
                <Text className="text-gray-400 text-sm mt-2 text-center">
                  {materials.length === 0 
                    ? 'Start by adding your first material' 
                    : 'Try adjusting your search or filters'
                  }
                </Text>
              </View>
            )}
          </View>
        );

      case 'suppliers':
        return (
          <View className="flex-1">
            {/* Suppliers Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-semibold text-gray-900">
                Suppliers ({filteredSuppliers.length})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedSupplier(null);
                  setShowSupplierForm(true);
                }}
                className="bg-orange-500 px-4 py-2 rounded-lg flex-row items-center"
              >
                <Plus size={16} color="white" />
                <Text className="ml-2 text-white font-medium">Add Supplier</Text>
              </TouchableOpacity>
            </View>

            {/* Suppliers List */}
            {filteredSuppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                onEdit={(sup) => {
                  setSelectedSupplier(sup);
                  setShowSupplierForm(true);
                }}
                onDelete={handleDeleteSupplier}
              />
            ))}

            {filteredSuppliers.length === 0 && !loading && (
              <View className="bg-white rounded-lg p-8 items-center">
                <Building2 size={48} color="#9ca3af" />
                <Text className="text-gray-500 text-lg mt-4">No suppliers found</Text>
                <Text className="text-gray-400 text-sm mt-2 text-center">
                  {suppliers.length === 0 
                    ? 'Start by adding your first supplier' 
                    : 'Try adjusting your search'
                  }
                </Text>
              </View>
            )}
          </View>
        );

      case 'tags':
        return (
          <View className="flex-1">
            <TagManagement 
              tags={tags}
              onCreateTag={handleCreateTag}
              onDeleteTag={handleDeleteTag}
            />
          </View>
        );

      case 'settings':
        return (
          <View className="flex-1">
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
                    <Text className="text-2xl font-bold text-blue-600">{stats.totalMaterials}</Text>
                    <Text className="text-sm text-blue-800">Total Materials</Text>
                  </View>
                  <View className="bg-green-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-green-600">{stats.totalVariants}</Text>
                    <Text className="text-sm text-green-800">Total Variants</Text>
                  </View>
                  <View className="bg-orange-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-orange-600">{stats.totalSuppliers}</Text>
                    <Text className="text-sm text-orange-800">Total Suppliers</Text>
                  </View>
                  <View className="bg-purple-50 p-4 rounded-lg">
                    <Text className="text-2xl font-bold text-purple-600">{stats.totalTags}</Text>
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
                  <View className="flex-row flex-wrap">
                    {units.map((unit) => (
                      <View key={unit.id} className="bg-white px-3 py-1 rounded-full mr-2 mb-2">
                        <Text className="text-sm text-gray-700">{unit.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
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
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <RefreshCw size={48} color="#6b7280" />
        <Text className="text-gray-600 text-lg mt-4">Loading inventory data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            Inventory Management
          </Text>
          <TouchableOpacity
            onPress={() => loadData()}
            disabled={refreshing}
            className={`p-2 rounded-lg ${refreshing ? 'bg-gray-100' : 'bg-blue-50'}`}
          >
            <RefreshCw 
              size={20} 
              color={refreshing ? "#6b7280" : "#3b82f6"} 
              className={refreshing ? 'animate-spin' : ''}
            />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3 mb-4">
          <Search size={20} color="#6b7280" />
          <TextInput
            placeholder="Search materials, suppliers, or variants..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-gray-900"
          />
        </View>

        {/* Tab Navigation */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {[
              { key: 'materials', label: 'Materials', icon: Package, color: '#6366f1' },
              { key: 'suppliers', label: 'Suppliers', icon: Building2, color: '#f59e0b' },
              { key: 'tags', label: 'Tags', icon: TagIcon, color: '#10b981' },
              { key: 'settings', label: 'Settings', icon: Settings, color: '#8b5cf6' }
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key as TabType)}
                className={`mr-3 px-4 py-2 rounded-full flex-row items-center ${
                  activeTab === tab.key
                    ? 'bg-blue-100'
                    : 'bg-gray-100'
                }`}
              >
                <tab.icon 
                  size={16} 
                  color={activeTab === tab.key ? '#3b82f6' : '#6b7280'} 
                />
                <Text className={`ml-2 font-medium ${
                  activeTab === tab.key
                    ? 'text-blue-600'
                    : 'text-gray-700'
                }`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-6 py-4">
        {renderTabContent()}
      </ScrollView>

      {/* Material Form Modal */}
      <Modal
        visible={showMaterialForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
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
      </Modal>

      {/* Supplier Form Modal */}
      <Modal
        visible={showSupplierForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SupplierForm
          supplier={selectedSupplier || undefined}
          onSave={selectedSupplier ? handleUpdateSupplier : handleCreateSupplier}
          onCancel={() => {
            setShowSupplierForm(false);
            setSelectedSupplier(null);
          }}
        />
      </Modal>

      {/* Variant Management Modal */}
      <Modal
        visible={showVariantManagement}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {selectedMaterial && (
          <VariantManagement
            material={selectedMaterial}
            suppliers={suppliers}
            units={units}
            onClose={() => {
              setShowVariantManagement(false);
              setSelectedMaterial(null);
              loadData(false); // Refresh data when closing
            }}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}
