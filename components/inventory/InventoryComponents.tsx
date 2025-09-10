import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Package, 
  Tag as TagIcon, 
  Building2, 
  DollarSign, 
  X,
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react-native';

// Import our API functions
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

// Import forms
import { VariantForm, SupplierPricingForm } from './InventoryForms';

// Enhanced Material Card Component
export function MaterialCard({ material, onEdit, onDelete, onManageVariants }: {
  material: Material;
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
  onManageVariants: (material: Material) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
      {/* Main Material Info */}
      <View className="p-4">
        <View className="flex-row justify-between items-start">
          <TouchableOpacity 
            className="flex-1"
            onPress={() => setExpanded(!expanded)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center mb-2">
              <Package size={20} color="#6366f1" />
              <Text className="text-lg font-semibold text-gray-900 ml-2 flex-1">
                {material.name}
              </Text>
              {expanded ? (
                <ChevronDown size={20} color="#6b7280" className="ml-2" />
              ) : (
                <ChevronRight size={20} color="#6b7280" className="ml-2" />
              )}
            </View>
            
            {material.description && (
              <Text className="text-sm text-gray-600 mb-2">
                {material.description}
              </Text>
            )}
            
            <View className="flex-row items-center mb-2">
              <Text className="text-sm text-gray-500">
                Unit: {material.unit?.name || 'No unit specified'}
              </Text>
            </View>

            {/* Tags */}
            {material.material_tags && material.material_tags.length > 0 && (
              <View className="flex-row flex-wrap">
                {material.material_tags.map((materialTag, index) => (
                  <View 
                    key={index}
                    className="bg-blue-100 px-2 py-1 rounded-full mr-2 mb-2"
                  >
                    <Text className="text-xs text-blue-800">
                      {materialTag.tags?.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
          
          {/* Always visible action buttons */}
          <View className="flex-row items-center ml-2">
            <TouchableOpacity 
              className="bg-blue-50 p-2 rounded-lg mr-2"
              onPress={() => {
                onEdit(material);
              }}
            >
              <Edit3 size={16} color="#3b82f6" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-red-50 p-2 rounded-lg"
              onPress={() => {
                if (onDelete) {
                  onDelete(material);
                }
              }}
            >
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Expanded Content */}
      {expanded && (
        <View className="border-t border-gray-100">
          {/* Variants Section */}
          <View className="p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-md font-medium text-gray-900">
                Variants ({material.material_variants?.length || 0})
              </Text>
              <TouchableOpacity
                onPress={() => onManageVariants(material)}
                className="bg-green-50 px-3 py-1 rounded-lg"
              >
                <Text className="text-green-600 text-sm font-medium">
                  Manage
                </Text>
              </TouchableOpacity>
            </View>

            {material.material_variants && material.material_variants.length > 0 ? (
              <View>
                {material.material_variants.slice(0, 3).map((variant, index) => (
                  <View key={index} className="bg-gray-50 p-3 rounded-md mb-2">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-gray-900">
                          {variant.variant_name}
                        </Text>
                        {variant.attributes && (
                          <Text className="text-xs text-gray-600 mt-1">
                            {Object.entries(variant.attributes).map(([key, value]) => 
                              `${key}: ${value}`
                            ).join(' • ')}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {/* Supplier Pricing Preview */}
                    {variant.supplier_pricing && variant.supplier_pricing.length > 0 && (
                      <View className="mt-2 pt-2 border-t border-gray-200">
                        <Text className="text-xs text-gray-500 mb-1">Suppliers:</Text>
                        <View className="flex-row flex-wrap">
                          {variant.supplier_pricing.slice(0, 2).map((pricing, pIndex) => (
                            <View key={pIndex} className="bg-green-100 px-2 py-1 rounded mr-2 mb-1">
                              <Text className="text-xs text-green-800 font-medium">
                                {pricing.suppliers?.name}
                              </Text>
                              <Text className="text-xs text-green-700">
                                AED {pricing.price}/{pricing.units_of_measure?.name}
                              </Text>
                            </View>
                          ))}
                          {variant.supplier_pricing.length > 2 && (
                            <View className="bg-gray-100 px-2 py-1 rounded">
                              <Text className="text-xs text-gray-600">
                                +{variant.supplier_pricing.length - 2} more
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                    
                    {/* No pricing info */}
                    {(!variant.supplier_pricing || variant.supplier_pricing.length === 0) && (
                      <View className="mt-2 pt-2 border-t border-gray-200">
                        <Text className="text-xs text-amber-600">No pricing set</Text>
                      </View>
                    )}
                  </View>
                ))}
                {material.material_variants.length > 3 && (
                  <Text className="text-sm text-gray-500 text-center">
                    +{material.material_variants.length - 3} more variants
                  </Text>
                )}
              </View>
            ) : (
              <Text className="text-sm text-gray-500 text-center py-4">
                No variants added yet
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-row p-4 border-t border-gray-100 space-x-2">
            <TouchableOpacity 
              className="flex-1 bg-blue-50 py-3 px-4 rounded-lg flex-row items-center justify-center"
              onPress={() => onEdit(material)}
            >
              <Edit3 size={16} color="#3b82f6" />
              <Text className="ml-2 text-blue-600 font-medium">Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 bg-green-50 py-3 px-4 rounded-lg flex-row items-center justify-center"
              onPress={() => onManageVariants(material)}
            >
              <Package size={16} color="#10b981" />
              <Text className="ml-2 text-green-600 font-medium">Variants</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-red-50 py-3 px-4 rounded-lg"
              onPress={() => onDelete(material)}
            >
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Material Form Component
export function MaterialForm({ 
  material, 
  units, 
  tags, 
  onSave, 
  onCancel 
}: {
  material?: Material;
  units: UnitOfMeasure[];
  tags: Tag[];
  onSave: (materialData: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: material?.name || '',
    description: material?.description || '',
    unit_id: material?.unit_id || '',
  });
  const [availableTags, setAvailableTags] = useState<Tag[]>(tags);
  const [newTagName, setNewTagName] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    material?.material_tags?.map(mt => mt.tag_id) || []
  );

  const handleSave = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Material name is required');
      return;
    }

    onSave({
      ...formData,
      tags: selectedTags
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Create a new tag inline and add it to local list
  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const { data, error } = await tagOperations.create(name);
      if (error) {
        Alert.alert('Error', 'Failed to create tag');
        return;
      }
      if (data) {
        setAvailableTags(prev => [...prev, data as Tag]);
        setSelectedTags(prev => [...prev, (data as Tag).id]);
        setNewTagName('');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create tag');
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            {material ? 'Edit Material' : 'Add New Material'}
          </Text>
          <Text className="text-gray-600">
            {material ? 'Update material information' : 'Create a new material entry'}
          </Text>
        </View>

        {/* Material Name */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Material Name *
          </Text>
          <TextInput
            value={formData.name}
            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            placeholder="Enter material name"
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          />
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Description
          </Text>
          <TextInput
            value={formData.description}
            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
            placeholder="Enter description (optional)"
            multiline
            numberOfLines={3}
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          />
        </View>

        {/* Unit of Measure */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Default Unit of Measure
          </Text>
          <View className="border border-gray-300 rounded-lg">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row p-2">
                <TouchableOpacity
                  onPress={() => setFormData(prev => ({ ...prev, unit_id: '' }))}
                  className={`px-4 py-2 rounded-lg mr-2 ${
                    !formData.unit_id ? 'bg-gray-200' : 'bg-gray-100'
                  }`}
                >
                  <Text className={`text-sm ${
                    !formData.unit_id ? 'font-medium' : ''
                  }`}>
                    No Unit
                  </Text>
                </TouchableOpacity>
                {units.map((unit) => (
                  <TouchableOpacity
                    key={unit.id}
                    onPress={() => setFormData(prev => ({ ...prev, unit_id: unit.id }))}
                    className={`px-4 py-2 rounded-lg mr-2 ${
                      formData.unit_id === unit.id ? 'bg-blue-200' : 'bg-gray-100'
                    }`}
                  >
                    <Text className={`text-sm ${
                      formData.unit_id === unit.id ? 'font-medium text-blue-800' : ''
                    }`}>
                      {unit.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Tags */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Tags
          </Text>

          {/* Quick add tag */}
          <View className="mb-3 flex-row items-center">
            <TextInput
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="New tag name"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
            <TouchableOpacity
              onPress={handleAddTag}
              className="ml-2 bg-blue-500 px-3 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">Add</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap">
            {availableTags.map((tag) => (
              <TouchableOpacity
                key={tag.id}
                onPress={() => toggleTag(tag.id)}
                className={`px-3 py-2 rounded-lg mr-2 mb-2 border ${
                  selectedTags.includes(tag.id)
                    ? 'bg-blue-100 border-blue-300'
                    : 'bg-gray-100 border-gray-300'
                }`}
              >
                <Text className={`text-sm ${
                  selectedTags.includes(tag.id) ? 'text-blue-800' : 'text-gray-700'
                }`}>
                  {tag.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={onCancel}
            className="flex-1 bg-gray-100 py-3 rounded-lg"
          >
            <Text className="text-center text-gray-700 font-medium">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            className="flex-1 bg-blue-500 py-3 rounded-lg"
          >
            <Text className="text-center text-white font-medium">
              {material ? 'Update' : 'Create'} Material
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// Variant Management Component
export function VariantManagement({ 
  material, 
  suppliers, 
  units,
  onClose 
}: {
  material: Material;
  suppliers: Supplier[];
  units: UnitOfMeasure[];
  onClose: () => void;
}) {
  const [variants, setVariants] = useState<MaterialVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<MaterialVariant | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  const loadVariants = async () => {
    setLoading(true);
    const { data, error } = await variantOperations.getByMaterialId(material.id);
    if (error) {
      Alert.alert('Error', 'Failed to load variants');
    } else {
      setVariants(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVariants();
  }, [material.id]);

  const handleCreateVariant = async (variantData: any) => {
    try {
      const { error } = await variantOperations.create(variantData);
      if (error) {
        Alert.alert('Error', 'Failed to create variant');
        return;
      }
      Alert.alert('Success', 'Variant created successfully');
      setShowAddForm(false);
      loadVariants();
    } catch (error) {
      Alert.alert('Error', 'Failed to create variant');
      console.error('Error creating variant:', error);
    }
  };

  const handleUpdateVariant = async (variantData: any) => {
    if (!selectedVariant) return;
    
    try {
      const { error } = await variantOperations.update(selectedVariant.id, variantData);
      if (error) {
        Alert.alert('Error', 'Failed to update variant');
        return;
      }
      Alert.alert('Success', 'Variant updated successfully');
      setShowEditForm(false);
      setSelectedVariant(null);
      loadVariants();
    } catch (error) {
      Alert.alert('Error', 'Failed to update variant');
      console.error('Error updating variant:', error);
    }
  };

  const handleDeleteVariant = async (variant: MaterialVariant) => {
    Alert.alert(
      'Delete Variant',
      `Are you sure you want to delete "${variant.variant_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await variantOperations.delete(variant.id);
              if (error) {
                Alert.alert('Error', 'Failed to delete variant');
                return;
              }
              Alert.alert('Success', 'Variant deleted successfully');
              loadVariants();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete variant');
              console.error('Error deleting variant:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-xl font-bold text-gray-900">
              {material.name} Variants
            </Text>
            <Text className="text-sm text-gray-600">
              Manage variants and supplier pricing
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="p-2 rounded-full bg-gray-100"
          >
            <X size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {/* Add Variant Button */}
        <TouchableOpacity
          onPress={() => setShowAddForm(true)}
          className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4 flex-row items-center justify-center"
        >
          <Plus size={20} color="#6b7280" />
          <Text className="ml-2 text-gray-600 font-medium">Add New Variant</Text>
        </TouchableOpacity>

        {/* Variants List */}
        {variants.map((variant) => (
          <VariantCard 
            key={variant.id} 
            variant={variant}
            suppliers={suppliers}
            units={units}
            onUpdate={loadVariants}
            onEdit={(v) => {
              setSelectedVariant(v);
              setShowEditForm(true);
            }}
            onDelete={handleDeleteVariant}
          />
        ))}

        {variants.length === 0 && !loading && (
          <View className="bg-white rounded-lg p-8 text-center">
            <Package size={48} color="#9ca3af" />
            <Text className="text-gray-500 text-lg mt-4">No variants yet</Text>
            <Text className="text-gray-400 text-sm mt-2">
              Add variants to track different specifications
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Variant Modal */}
      {showAddForm && (
        <View className="absolute inset-0 bg-black bg-opacity-50 justify-center items-center">
          <View className="bg-white rounded-lg m-6 max-h-96 w-full">
            <VariantForm
              material={material}
              onSave={handleCreateVariant}
              onCancel={() => setShowAddForm(false)}
            />
          </View>
        </View>
      )}

      {/* Edit Variant Modal */}
      {showEditForm && selectedVariant && (
        <View className="absolute inset-0 bg-black bg-opacity-50 justify-center items-center">
          <View className="bg-white rounded-lg m-6 max-h-96 w-full">
            <VariantForm
              material={material}
              variant={selectedVariant}
              onSave={handleUpdateVariant}
              onCancel={() => {
                setShowEditForm(false);
                setSelectedVariant(null);
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// Individual Variant Card
function VariantCard({ 
  variant, 
  suppliers, 
  units, 
  onUpdate,
  onEdit,
  onDelete
}: {
  variant: MaterialVariant;
  suppliers: Supplier[];
  units: UnitOfMeasure[];
  onUpdate: () => void;
  onEdit?: (variant: MaterialVariant) => void;
  onDelete?: (variant: MaterialVariant) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPricingForm, setShowPricingForm] = useState(false);

  const handleAddPricing = async (pricingData: any) => {
    try {
      const { error } = await pricingOperations.create(pricingData);
      if (error) {
        Alert.alert('Error', 'Failed to add pricing');
        return;
      }
      Alert.alert('Success', 'Pricing added successfully');
      setShowPricingForm(false);
      onUpdate();
    } catch (error) {
      console.error('Error adding pricing:', error);
      Alert.alert('Error', 'Failed to add pricing');
    }
  };

  return (
    <View className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
      <TouchableOpacity 
        className="p-4"
        onPress={() => setExpanded(!expanded)}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-gray-900 mb-1">
              {variant.variant_name}
            </Text>
            {variant.attributes && (
              <Text className="text-sm text-gray-600">
                {Object.entries(variant.attributes).map(([key, value]) => 
                  `${key}: ${value}`
                ).join(' • ')}
              </Text>
            )}
          </View>
          {expanded ? (
            <ChevronDown size={20} color="#6b7280" />
          ) : (
            <ChevronRight size={20} color="#6b7280" />
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View className="border-t border-gray-100">
          <View className="p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-md font-medium text-gray-900">
                Supplier Pricing ({variant.supplier_pricing?.length || 0})
              </Text>
              <TouchableOpacity
                onPress={() => setShowPricingForm(true)}
                className="bg-green-50 px-3 py-1 rounded-lg"
              >
                <Text className="text-green-600 text-sm font-medium">
                  Add Price
                </Text>
              </TouchableOpacity>
            </View>

            {/* Pricing List */}
            {variant.supplier_pricing && variant.supplier_pricing.length > 0 ? (
              <View>
                {variant.supplier_pricing
                  .sort((a, b) => a.price - b.price) // Sort by price (lowest first)
                  .map((pricing, index) => (
                  <View key={index} className="bg-gray-50 p-3 rounded-md mb-2">
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className="text-sm font-medium text-gray-900">
                            {pricing.suppliers?.name}
                          </Text>
                          {index === 0 && (
                            <View className="bg-green-500 px-2 py-1 rounded">
                              <Text className="text-xs text-white font-medium">Best Price</Text>
                            </View>
                          )}
                        </View>
                        
                        <View className="flex-row items-center justify-between">
                          <View>
                            <Text className="text-lg font-bold text-green-600">
                              AED {pricing.price.toFixed(2)}
                            </Text>
                            <Text className="text-xs text-gray-500">
                              per {pricing.units_of_measure?.name}
                            </Text>
                          </View>
                          
                          <View className="items-end">
                            {pricing.stock_level !== null && pricing.stock_level !== undefined ? (
                              <View className="flex-row items-center">
                                <View className={`w-2 h-2 rounded-full mr-1 ${
                                  pricing.stock_level > 10 
                                    ? 'bg-green-500' 
                                    : pricing.stock_level > 0 
                                    ? 'bg-yellow-500' 
                                    : 'bg-red-500'
                                }`} />
                                <Text className={`text-xs font-medium ${
                                  pricing.stock_level > 10 
                                    ? 'text-green-600' 
                                    : pricing.stock_level > 0 
                                    ? 'text-yellow-600' 
                                    : 'text-red-600'
                                }`}>
                                  Stock: {pricing.stock_level}
                                </Text>
                              </View>
                            ) : (
                              <Text className="text-xs text-gray-400">Stock: N/A</Text>
                            )}
                            
                            {pricing.updated_at && (
                              <Text className="text-xs text-gray-400 mt-1">
                                Updated: {new Date(pricing.updated_at).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                        </View>
                        
                        {/* Contact info preview */}
                        {pricing.suppliers?.contact_person && (
                          <Text className="text-xs text-gray-500 mt-1">
                            Contact: {pricing.suppliers.contact_person}
                            {pricing.suppliers.phone && ` • ${pricing.suppliers.phone}`}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {/* Action buttons for pricing */}
                    <View className="flex-row mt-2 space-x-2">
                      <TouchableOpacity 
                        className="flex-1 bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center"
                        onPress={() => {/* TODO: Edit pricing */}}
                      >
                        <Edit3 size={12} color="#3b82f6" />
                        <Text className="ml-1 text-blue-600 text-xs font-medium">Edit Price</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        className="bg-red-50 py-2 px-3 rounded-lg flex-row items-center justify-center"
                        onPress={() => {/* TODO: Delete pricing */}}
                      >
                        <Trash2 size={12} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                
                {/* Price comparison summary */}
                {variant.supplier_pricing.length > 1 && (
                  <View className="bg-blue-50 p-3 rounded-md mt-2">
                    <Text className="text-sm font-medium text-blue-800 mb-1">
                      Price Comparison
                    </Text>
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-blue-700">
                        Lowest: AED {Math.min(...variant.supplier_pricing.map(p => p.price)).toFixed(2)}
                      </Text>
                      <Text className="text-xs text-blue-700">
                        Highest: AED {Math.max(...variant.supplier_pricing.map(p => p.price)).toFixed(2)}
                      </Text>
                      <Text className="text-xs text-blue-700">
                        Avg: AED {(variant.supplier_pricing.reduce((sum, p) => sum + p.price, 0) / variant.supplier_pricing.length).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <Text className="text-sm text-gray-500 text-center py-4">
                No pricing information yet
              </Text>
            )}

            {/* Variant Action Buttons */}
            {(onEdit || onDelete) && (
              <View className="flex-row mt-4 space-x-2">
                {onEdit && (
                  <TouchableOpacity 
                    className="flex-1 bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center"
                    onPress={() => onEdit(variant)}
                  >
                    <Edit3 size={16} color="#3b82f6" />
                    <Text className="ml-2 text-blue-600 font-medium">Edit</Text>
                  </TouchableOpacity>
                )}
                
                {onDelete && (
                  <TouchableOpacity 
                    className="bg-red-50 py-2 px-3 rounded-lg"
                    onPress={() => onDelete(variant)}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      )}
      
      {/* Supplier Pricing Form Modal */}
      {showPricingForm && (
        <View className="absolute inset-0 bg-black bg-opacity-50 justify-center items-center z-50">
          <View className="bg-white rounded-lg m-6 max-h-96 w-full">
            <SupplierPricingForm
              variant={variant}
              suppliers={suppliers}
              units={units}
              onSave={handleAddPricing}
              onCancel={() => setShowPricingForm(false)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// Supplier Card Component
export function SupplierCard({ 
  supplier, 
  onEdit, 
  onDelete 
}: {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}) {
  return (
    <View className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <Building2 size={20} color="#f59e0b" />
            <Text className="text-lg font-semibold text-gray-900 ml-2">
              {supplier.name}
            </Text>
          </View>
          
          {supplier.contact_person && (
            <Text className="text-sm text-gray-600 mb-1">
              Contact: {supplier.contact_person}
            </Text>
          )}
          
          {supplier.email && (
            <Text className="text-sm text-gray-600 mb-1">
              Email: {supplier.email}
            </Text>
          )}
          
          {supplier.phone && (
            <Text className="text-sm text-gray-600 mb-1">
              Phone: {supplier.phone}
            </Text>
          )}
          
          {supplier.address && (
            <Text className="text-sm text-gray-600">
              {supplier.address}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row mt-4 space-x-2">
        <TouchableOpacity 
          className="flex-1 bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center"
          onPress={() => onEdit(supplier)}
        >
          <Edit3 size={16} color="#3b82f6" />
          <Text className="ml-2 text-blue-600 font-medium">Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="bg-red-50 py-2 px-3 rounded-lg"
          onPress={() => onDelete(supplier)}
        >
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Tag Management Component
export function TagManagement({ 
  tags, 
  materials,
  onCreateTag, 
  onDeleteTag 
}: {
  tags: Tag[];
  materials: Material[];
  onCreateTag: (name: string) => void;
  onDeleteTag: (tag: Tag) => void;
}) {
  const [newTagName, setNewTagName] = useState('');

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      Alert.alert('Error', 'Tag name is required');
      return;
    }
    onCreateTag(newTagName.trim());
    setNewTagName('');
  };

  const [confirm, setConfirm] = React.useState<{visible: boolean; tag: Tag | null}>({visible: false, tag: null});

  const countForTag = (tagId: string) =>
    materials.filter(m => m.material_tags && m.material_tags.some(mt => mt.tag_id === tagId)).length;

  return (
    <View className="bg-white rounded-lg p-4 mb-4">
      <Text className="text-lg font-semibold text-gray-900 mb-4">
        Manage Tags
      </Text>
      
      {/* Add New Tag */}
      <View className="flex-row mb-4">
        <TextInput
          value={newTagName}
          onChangeText={setNewTagName}
          placeholder="Enter tag name"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 mr-2"
        />
        <TouchableOpacity
          onPress={handleCreateTag}
          className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
        >
          <Plus size={16} color="white" />
          <Text className="ml-1 text-white font-medium">Add</Text>
        </TouchableOpacity>
      </View>
      
      {/* Tags List as cards */}
      <View>
        {tags.map((tag) => (
          <View key={tag.id} className="border border-gray-200 rounded-lg p-3 mb-2 bg-gray-50">
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">{tag.name}</Text>
                <Text className="text-xs text-gray-600 mt-1">Materials using this tag: {countForTag(tag.id)}</Text>
              </View>
              <TouchableOpacity
                className="bg-red-100 px-3 py-1 rounded"
                onPress={() => setConfirm({visible: true, tag})}
              >
                <Text className="text-red-700 text-sm font-medium">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Confirm delete modal */}
      <Modal visible={confirm.visible} transparent animationType="fade" onRequestClose={() => setConfirm({visible:false, tag:null})}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white rounded-xl w-full max-w-md">
            <View className="p-5 border-b border-gray-200">
              <Text className="text-lg font-bold text-gray-900">Delete Tag</Text>
              <Text className="text-gray-600 mt-2">Are you sure you want to delete "{confirm.tag?.name}"? This will detach it from materials.</Text>
            </View>
            <View className="flex-row p-4 justify-end space-x-3">
              <TouchableOpacity className="bg-gray-100 px-4 py-2 rounded" onPress={() => setConfirm({visible:false, tag:null})}>
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-red-600 px-4 py-2 rounded" onPress={() => { if (confirm.tag) onDeleteTag(confirm.tag); setConfirm({visible:false, tag:null}); }}>
                <Text className="text-white font-medium">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
