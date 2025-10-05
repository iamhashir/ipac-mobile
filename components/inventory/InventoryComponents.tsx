import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Pressable } from 'react-native';
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
  ChevronRight,
  Save
} from 'lucide-react-native';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Alert as UIAlert } from '../ui/Alert';

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
export function MaterialCard({ material, onEdit, onDelete, onManageVariants, suppliers = [], units = [] }: {
  material: Material;
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
  onManageVariants?: (material: Material) => void;
  suppliers?: Supplier[];
  units?: UnitOfMeasure[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [variants, setVariants] = useState<MaterialVariant[]>(material.material_variants || []);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [showEditVariant, setShowEditVariant] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<MaterialVariant | null>(null);
  const [showPricingForm, setShowPricingForm] = useState(false);
  const [pricingVariant, setPricingVariant] = useState<MaterialVariant | null>(null);
  const [editPricing, setEditPricing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{visible: boolean; variant: MaterialVariant | null; loading: boolean}>({ visible: false, variant: null, loading: false });
  const [banner, setBanner] = useState<{type: 'success'|'error'|'warning'|'info'; message: string} | null>(null);

  const loadVariants = async () => {
    try {
      const { data, error } = await variantOperations.getByMaterialId(material.id);
      if (!error) setVariants(data || []);
    } catch (e) {
      // noop
    }
  };

  useEffect(() => {
    setVariants(material.material_variants || []);
  }, [material.material_variants]);

  return (
    <View className="relative bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
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
            {banner && (
              <UIAlert type={banner.type} message={banner.message} onClose={() => setBanner(null)} />
            )}
            <View className="flex-row items-center mb-2">
              <Text className="text-sm text-gray-500">
                Unit: {(() => {
                  const unitName = material.unit?.name;
                  return unitName && unitName.trim() && unitName.trim() !== '.' ? unitName : 'No unit specified';
                })()}
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
              className="bg-blue-50 p-2 rounded-lg mr-2 border border-blue-300"
              onPress={() => {
                onEdit(material);
              }}
            >
              <Edit3 size={16} color="#3b82f6" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-red-50 p-2 rounded-lg border border-red-300"
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
                Variants ({variants.length})
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddVariant(true)}
                className="bg-green-50 px-3 py-1 rounded-lg border border-green-300"
              >
                <Text className="text-green-600 text-sm font-medium">
                  Add Variant
                </Text>
              </TouchableOpacity>
            </View>

            {variants && variants.length > 0 ? (
              <View className="flex-row flex-wrap -mx-2">
                {variants.map((variant, index) => (
                  <View key={(variant as any).id || index} className="w-1/2 px-2 mb-3">
                    <View className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-1 pr-2">
                          <Text className="text-base font-semibold text-gray-900 mb-1">
                            {variant.variant_name}
                          </Text>
                          {variant.attributes && (
                            <Text className="text-sm text-gray-600">
                              {Object.entries(variant.attributes).map(([key, value]) => 
                                `${key}: ${value}`
                              ).join(' • ')}
                            </Text>
                          )}
                          {variant.description ? (
                            <Text className="text-sm text-gray-700 mt-1">
                              {variant.description}
                            </Text>
                          ) : null}
                        </View>
                        <View className="flex-row items-center">
                          <TouchableOpacity 
                            className="bg-green-50 p-2 rounded-lg ml-2 border border-green-300"
                            onPress={() => {
                              setPricingVariant(variant);
                              setShowPricingForm(true);
                            }}
                          >
                            <DollarSign size={14} color="#10b981" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            className="bg-blue-50 p-2 rounded-lg ml-2 border border-blue-300"
                            onPress={() => {
                              setSelectedVariant(variant);
                              setShowEditVariant(true);
                            }}
                          >
                            <Edit3 size={14} color="#3b82f6" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            className="bg-red-50 p-2 rounded-lg ml-2"
                            onPress={() => {
                              setConfirmDelete({ visible: true, variant, loading: false });
                            }}
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Supplier Pricing Display */}
                      {variant.supplier_pricing && variant.supplier_pricing.length > 0 ? (
                        <View className="border-t border-gray-300 pt-3">
                          <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-sm font-medium text-gray-700">Supplier Pricing</Text>
                            <Text className="text-xs text-gray-500">{variant.supplier_pricing.length} supplier(s)</Text>
                          </View>
                          <View className="space-y-2">
                            {[...(variant.supplier_pricing || [])]
                              .sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))
                              .map((pricing, pIndex) => {
                              // Calculate price age
                              const getPriceAge = () => {
                                if (!pricing.updated_at) return null;
                                const updated = new Date(pricing.updated_at);
                                const now = new Date();
                                const diffTime = Math.abs(now.getTime() - updated.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                return diffDays;
                              };
                              
                              const getPriceStatus = (days: number | null) => {
                                if (days === null) return { color: 'bg-gray-500', status: 'Unknown', icon: '?' };
                                if (days <= 90) return { color: 'bg-green-500', status: 'Good', icon: '✓' };
                                if (days <= 180) return { color: 'bg-yellow-500', status: 'Warning', icon: '⚠' };
                                return { color: 'bg-red-500', status: 'Alert', icon: '!' };
                              };
                              
                              const formatLastUpdated = (dateStr: string) => {
                                if (!dateStr) return 'Never updated';
                                const date = new Date(dateStr);
                                const now = new Date();
                                const diffTime = Math.abs(now.getTime() - date.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                
                                if (diffDays === 0) return 'Today';
                                if (diffDays === 1) return 'Yesterday';
                                if (diffDays < 7) return `${diffDays} days ago`;
                                if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
                                if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
                                return `${Math.floor(diffDays / 365)} years ago`;
                              };
                              
                              const priceAge = getPriceAge();
                              const priceStatus = getPriceStatus(priceAge);
                              
                              return (
                                <View key={pIndex} className="bg-white border border-gray-200 rounded-lg p-3">
                                  <View className="flex-row justify-between items-start">
                                    <View className="flex-1">
                                      <View className="flex-row items-center justify-between">
                                        <Text className="text-sm font-semibold text-gray-900">
                                          {pricing.suppliers?.name || 'Unknown Supplier'}
                                        </Text>
                                        <View className="flex-row items-center">
                                          <View className={`w-3 h-3 rounded-full mr-1 ${priceStatus.color}`} />
                                          <Text className="text-xs text-gray-500">{priceStatus.status}</Text>
                                        </View>
                                      </View>
                                      
                                      <View className="flex-row items-center mt-1">
                                        <Text className="text-lg font-bold text-green-600 mr-2">
                                          AED {pricing.price?.toFixed(2) || '0.00'}
                                        </Text>
                                        <Text className="text-xs text-gray-500">
                                          {(() => {
                                            const unitName = pricing.units_of_measure?.name;
                                            return unitName && unitName.trim() && unitName.trim() !== '.' ? `per ${unitName}` : 'per unit';
                                          })()}
                                        </Text>
                                      </View>
                                      
                                      <Text className="text-xs text-gray-400 mt-1">
                                        Updated: {formatLastUpdated(pricing.updated_at)}
                                      </Text>
                                      
                                      {pricing.stock_level !== null && pricing.stock_level !== undefined && (
                                        <View className="flex-row items-center mt-1">
                                          <View className={`w-2 h-2 rounded-full mr-1 ${
                                            pricing.stock_level > 10 ? 'bg-green-500' : 
                                            pricing.stock_level > 0 ? 'bg-yellow-500' : 'bg-red-500'
                                          }`} />
                                          <Text className="text-xs text-gray-500">
                                            Stock: {pricing.stock_level}
                                          </Text>
                                        </View>
                                      )}
                                      {/* Action buttons */}
                                      <View className="flex-row mt-2">
                                        <TouchableOpacity
                                          className="bg-blue-50 py-1 px-2 rounded-lg flex-row items-center justify-center mr-2"
                                          onPress={() => setEditPricing({ ...pricing, material_variant: variant })}
                                        >
                                          <Edit3 size={14} color="#3b82f6" />
                                          <Text className="ml-1 text-blue-600 text-xs font-medium">Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          className="bg-red-50 py-1 px-2 rounded-lg flex-row items-center justify-center"
                                          onPress={() => {
                                            Alert.alert(
                                              'Delete Pricing',
                                              'Are you sure you want to delete this supplier price?',
                                              [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                  text: 'Delete',
                                                  style: 'destructive',
                                                  onPress: async () => {
                                                    try {
                                                      const { error } = await pricingOperations.delete((pricing as any).id);
                                                      if (error) {
                                                        Alert.alert('Error', 'Failed to delete pricing');
                                                        return;
                                                      }
                                                      await loadVariants();
                                                    } catch (e) {
                                                      Alert.alert('Error', 'Failed to delete pricing');
                                                    }
                                                  }
                                                }
                                              ]
                                            );
                                          }}
                                        >
                                          <Trash2 size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                    {pIndex === 0 && variant.supplier_pricing.length > 1 && (
                                      <View className="bg-green-500 px-2 py-1 rounded-full ml-2">
                                        <Text className="text-xs text-white font-medium">Best Price</Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ) : (
                        <View className="border-t border-gray-300 pt-3">
                          <View className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                            <Text className="text-sm text-amber-700">No pricing information available</Text>
                            <Text className="text-xs text-amber-600 mt-1">Contact suppliers for quotes</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-sm text-gray-500 text-center py-4">
                No variants added yet
              </Text>
            )}
          </View>
        </View>
      )}
      {/* Add Variant Modal */}
      <Modal visible={showAddVariant} animationType="fade" transparent>
        <View className="flex-1">
          <Pressable className="absolute inset-0 bg-black bg-opacity-50" onPress={() => setShowAddVariant(false)} />
          <View className="flex-1 justify-center items-center p-6">
            <View className="bg-white rounded-2xl w-full max-w-2xl">
              <VariantForm
                material={material}
                suppliers={suppliers}
                units={units}
                onSave={async (variantData: any) => {
                  try {
                    const { tags, ...variantOnly } = variantData;
                    const { data, error } = await variantOperations.create(variantOnly);
                    if (error) {
                      setBanner({ type: 'error', message: 'Failed to create variant' });
                      return;
                    }
                    
                    // Handle tags if any were selected
                    if (data?.id && tags && tags.length > 0) {
                      await variantOperations.addTags(data.id, tags);
                    }
                    
                    setShowAddVariant(false);
                    setBanner({ type: 'success', message: 'Variant created successfully' });
                    await loadVariants();
                  } catch (e) {
                    setBanner({ type: 'error', message: 'Failed to create variant' });
                  }
                }}
                onCancel={() => setShowAddVariant(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Variant Modal */}
      <Modal visible={showEditVariant && !!selectedVariant} animationType="fade" transparent>
        <View className="flex-1">
          <Pressable
            className="absolute inset-0 bg-black bg-opacity-50"
            onPress={() => {
              setShowEditVariant(false);
              setSelectedVariant(null);
            }}
          />
          <View className="flex-1 justify-center items-center p-6">
            <View className="bg-white rounded-2xl w-full max-w-2xl">
              {selectedVariant && (
                <VariantForm
                  material={material}
                  variant={selectedVariant}
                  suppliers={suppliers}
                  units={units}
                  onSave={async (variantData: any) => {
                    try {
                      const { tags, ...variantOnly } = variantData;
                      const { error } = await variantOperations.update(selectedVariant.id, variantOnly);
                      if (error) {
                        setBanner({ type: 'error', message: 'Failed to update variant' });
                        return;
                      }
                      
                      // Handle tags update
                      if (tags !== undefined) {
                        await variantOperations.updateTags(selectedVariant.id, tags);
                      }
                      
                      setShowEditVariant(false);
                      setSelectedVariant(null);
                      setBanner({ type: 'success', message: 'Variant updated successfully' });
                      await loadVariants();
                    } catch (e) {
                      setBanner({ type: 'error', message: 'Failed to update variant' });
                    }
                  }}
                  onCancel={() => {
                    setShowEditVariant(false);
                    setSelectedVariant(null);
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Supplier Pricing Modal */}
      <Modal visible={showPricingForm && !!pricingVariant} animationType="fade" transparent>
        <View className="flex-1">
          <Pressable
            className="absolute inset-0 bg-black bg-opacity-50"
            onPress={() => {
              setShowPricingForm(false);
              setPricingVariant(null);
            }}
          />
          <View className="flex-1 justify-center items-center p-6">
            <View className="bg-white rounded-2xl w-full max-w-2xl">
              {pricingVariant && (
                <SupplierPricingForm
                  variant={pricingVariant}
                  suppliers={suppliers}
                  units={units}
                  defaultUnitId={(material as any)?.unit_id || ''}
                  onSave={async (pricingData: any) => {
                    try {
                      const payload = {
                        material_variant_id: pricingVariant.id,
                        supplier_id: pricingData.supplier_id,
                        price: pricingData.price,
                        unit_id: pricingData.unit_id,
                      };
                      const { error } = await pricingOperations.create(payload as any);
                      if (error) {
                        setBanner({ type: 'error', message: 'Failed to add pricing' });
                        return;
                      }
                      setShowPricingForm(false);
                      setPricingVariant(null);
                      setBanner({ type: 'success', message: 'Pricing added successfully' });
                      await loadVariants();
                    } catch (e) {
                      setBanner({ type: 'error', message: 'Failed to add pricing' });
                    }
                  }}
                  onCancel={() => {
                    setShowPricingForm(false);
                    setPricingVariant(null);
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Supplier Pricing Modal */}
      <Modal visible={!!editPricing} animationType="fade" transparent>
        <View className="flex-1">
          <Pressable className="absolute inset-0 bg-black bg-opacity-50" onPress={() => setEditPricing(null)} />
          <View className="flex-1 justify-center items-center p-6">
            <View className="bg-white rounded-2xl w-full max-w-2xl">
              {editPricing && (
                <SupplierPricingForm
                  variant={selectedVariant || pricingVariant || material.material_variants?.[0] || ({} as any)}
                  suppliers={suppliers}
                  units={units}
                  pricing={{ supplier_id: editPricing.supplier_id || editPricing.suppliers?.id, price: editPricing.price, unit_id: editPricing.unit_id || editPricing.units_of_measure?.id }}
                  defaultUnitId={(material as any)?.unit_id || ''}
                  onSave={async (newData: any) => {
                    try {
                      const { error } = await pricingOperations.update(editPricing.id, {
                        price: newData.price,
                        unit_id: newData.unit_id,
                        supplier_id: newData.supplier_id,
                      });
                      if (error) {
                        setBanner({ type: 'error', message: 'Failed to update pricing' });
                        return;
                      }
                      setEditPricing(null);
                      setBanner({ type: 'success', message: 'Pricing updated successfully' });
                      await loadVariants();
                    } catch (e) {
                      setBanner({ type: 'error', message: 'Failed to update pricing' });
                    }
                  }}
                  onCancel={() => setEditPricing(null)}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Delete Variant */}
      <ConfirmModal
        visible={confirmDelete.visible}
        title="Delete Variant"
        description={`Are you sure you want to delete "${confirmDelete.variant?.variant_name || ''}"? This will also remove any supplier pricing for it.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={confirmDelete.loading}
        onCancel={() => setConfirmDelete({ visible: false, variant: null, loading: false })}
        onConfirm={async () => {
          const target = confirmDelete.variant;
          if (!target) return;
          try {
            setConfirmDelete(prev => ({ ...prev, loading: true }));
            const id = (target as any).id;
            const { error } = await variantOperations.delete(id);
            if (error) {
              setBanner({ type: 'error', message: 'Failed to delete variant' });
            } else {
              setVariants(prev => prev.filter(v => (v as any).id !== id));
              setBanner({ type: 'success', message: 'Variant deleted successfully' });
            }
            await loadVariants();
          } catch (e) {
            setBanner({ type: 'error', message: 'Failed to delete variant' });
          } finally {
            setConfirmDelete({ visible: false, variant: null, loading: false });
          }
        }}
      />
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
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [unitQuery, setUnitQuery] = useState('');
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
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-2xl font-bold text-gray-900 mb-2">
                {material ? 'Edit Material' : 'Add New Material'}
              </Text>
              <Text className="text-gray-600">
                {material ? 'Update material information' : 'Create a new material entry'}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} className="p-2 rounded-full bg-gray-100">
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
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

        {/* Unit of Measure - dropdown */}
        <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">Default Unit of Measure</Text>
          <View>
            <TouchableOpacity
              onPress={() => setUnitDropdownOpen(prev => !prev)}
              className="border border-gray-300 rounded-lg px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-gray-900">
                {(() => {
                  const unit = units.find(u => u.id === formData.unit_id);
                  const unitName = unit?.name;
                  return unitName && unitName.trim() && unitName.trim() !== '.' ? unitName : 'Select unit';
                })()}
              </Text>
              <ChevronDown size={16} color="#6b7280" />
            </TouchableOpacity>
            {unitDropdownOpen && (
              <View className="mt-2 bg-white border border-gray-300 rounded-lg max-h-64">
                {/* search input */}
                <View className="p-2 border-b border-gray-200">
                  <TextInput
                    value={unitQuery}
                    onChangeText={setUnitQuery}
                    placeholder="Type to filter units..."
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </View>
                <ScrollView>
                  <TouchableOpacity
                    onPress={() => { setFormData(prev => ({ ...prev, unit_id: '' })); setUnitDropdownOpen(false); setUnitQuery(''); }}
                    className="p-3 border-b border-gray-100"
                  >
                    <Text className="text-sm text-gray-700">No Unit</Text>
                  </TouchableOpacity>
                  {units
                    .filter(u => !unitQuery.trim() || u.name.toLowerCase().includes(unitQuery.toLowerCase()))
                    .map((unit) => (
                    <TouchableOpacity
                      key={unit.id}
                      onPress={() => { setFormData(prev => ({ ...prev, unit_id: unit.id })); setUnitDropdownOpen(false); }}
                      className="p-3 border-b border-gray-100"
                    >
                      <Text className="text-sm text-gray-900">{unit.name}</Text>
                      {unit.description ? (
                        <Text className="text-xs text-gray-500">{unit.description}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
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

  const [confirmDelete, setConfirmDelete] = useState<{visible:boolean; variant: MaterialVariant | null; loading: boolean}>({visible:false, variant:null, loading:false});
  const [banner, setBanner] = useState<{type: 'success'|'error'|'warning'|'info'; message: string} | null>(null);

  const handleDeleteVariant = async (variant: MaterialVariant) => {
    setConfirmDelete({ visible: true, variant, loading: false });
  };

  return (
    <View className="flex-1 bg-gray-50 relative">
      {banner && (
        <UIAlert type={banner.type} message={banner.message} onClose={() => setBanner(null)} />
      )}
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
        <View className="absolute inset-0 z-50">
          <Pressable
            className="absolute inset-0 bg-black bg-opacity-50"
            onPress={() => setShowAddForm(false)}
          />
          <View className="flex-1 justify-center items-center p-6">
            <View className="bg-white rounded-lg m-6 max-h-96 w-full">
              <VariantForm
                material={material}
                onSave={handleCreateVariant}
                onCancel={() => setShowAddForm(false)}
              />
            </View>
          </View>
        </View>
      )}

      {/* Edit Variant Modal */}
      {showEditForm && selectedVariant && (
        <View className="absolute inset-0 z-50">
          <Pressable
            className="absolute inset-0 bg-black bg-opacity-50"
            onPress={() => {
              setShowEditForm(false);
              setSelectedVariant(null);
            }}
          />
          <View className="flex-1 justify-center items-center p-6">
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
        </View>
      )}
    {/* Confirm delete variant modal for management view */}
    <ConfirmModal
      visible={confirmDelete.visible}
      title="Delete Variant"
      description={`Are you sure you want to delete "${confirmDelete.variant?.variant_name || ''}"? This will also remove any supplier pricing for it.`}
      confirmText="Delete"
      cancelText="Cancel"
      variant="danger"
      loading={confirmDelete.loading}
      onCancel={() => setConfirmDelete({ visible: false, variant: null, loading: false })}
      onConfirm={async () => {
        const target = confirmDelete.variant;
        if (!target) return;
        try {
          setConfirmDelete(prev => ({ ...prev, loading: true }));
          const { error } = await variantOperations.delete(target.id);
          if (error) {
            setBanner({ type: 'error', message: 'Failed to delete variant' });
          } else {
            setVariants(prev => prev.filter(v => v.id !== target.id));
            setBanner({ type: 'success', message: 'Variant deleted successfully' });
          }
          await loadVariants();
        } catch (e) {
          setBanner({ type: 'error', message: 'Failed to delete variant' });
        } finally {
          setConfirmDelete({ visible: false, variant: null, loading: false });
        }
      }}
    />
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
          <View className="">
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
            {variant.description ? (
              <Text className="text-sm text-gray-700 mt-1">
                {variant.description}
              </Text>
            ) : null}
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
                              per {(() => {
                                const unitName = pricing.units_of_measure?.name;
                                return unitName && unitName.trim() && unitName.trim() !== '.' ? unitName : 'unit';
                              })()}
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
        <View className="absolute inset-0 z-50">
          <TouchableOpacity 
            className="absolute inset-0 bg-black bg-opacity-50" 
            activeOpacity={1}
            onPress={() => setShowPricingForm(false)}
          >
            <View className="flex-1 justify-center items-center p-6">
              <TouchableOpacity 
                className="bg-white rounded-2xl w-full max-w-2xl"
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
<SupplierPricingForm
                  variant={variant}
                  suppliers={suppliers}
                  units={units}
                  defaultUnitId={(variant as any)?.materials?.unit_id || (variant as any)?.material?.unit_id || ''}
                  onSave={handleAddPricing}
                  onCancel={() => setShowPricingForm(false)}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Supplier Card Component
export function SupplierCard({ 
  supplier, 
  onEdit, 
  onDelete,
  onViewProducts 
}: {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onViewProducts?: (supplier: Supplier) => void;
}) {
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  
  useEffect(() => {
    loadProductOverview();
  }, [supplier.id]);
  
  const loadProductOverview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supplierOperations.getSupplierVariants(supplier.id);
      if (!error && data) {
        setProductCount(data.length);
        // Get top 3 products for preview
        setTopProducts(data.slice(0, 3));
      }
    } catch (e) {
      console.error('Error loading supplier products:', e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <View className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <Text className="text-lg font-semibold text-gray-900">
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

      {/* Product Overview */}
      <View className="mt-3 pt-3 border-t border-gray-100">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-medium text-gray-700">
            Products: {loading ? '...' : productCount}
          </Text>
          {productCount > 3 && (
            <Text className="text-xs text-blue-600">
              +{productCount - 3} more
            </Text>
          )}
        </View>
        
        {topProducts.length > 0 && (
          <View>
            {topProducts.map((item, index) => (
              <View key={index} className="flex-row items-center mb-1">
                <View className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
                <Text className="text-xs text-gray-600 flex-1" numberOfLines={1}>
                  {item.material_variants?.materials?.name} - {item.material_variants?.variant_name}
                </Text>
                <Text className="text-xs text-green-600 font-medium ml-2">{`$${item.price}`}</Text>
              </View>
            ))}
          </View>
        )}
        
        {productCount === 0 && !loading && (
          <Text className="text-xs text-gray-500 italic">
            No products added yet
          </Text>
        )}
      </View>

      <View className="flex-row mt-4">
        {onViewProducts && (
          <TouchableOpacity 
            className="flex-1 bg-green-50 py-2 px-3 rounded-lg flex-row items-center justify-center mr-2"
            onPress={() => onViewProducts(supplier)}
          >
            <Package size={16} color="#10b981" />
            <Text className="ml-2 text-green-600 font-medium">View Products</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          className="bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center mr-2"
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
  onDeleteTag,
  onUpdateTag 
}: {
  tags: Tag[];
  materials: Material[];
  onCreateTag: (name: string) => void;
  onDeleteTag: (tag: Tag) => void;
  onUpdateTag?: (tag: Tag, newName: string) => void;
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
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

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
              <View className="flex-1 pr-2">
                {editingTagId === tag.id ? (
                  <View className="flex-row items-center">
                    <TextInput
                      value={editingName}
                      onChangeText={setEditingName}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1 mr-2"
                      placeholder="Tag name"
                    />
                    <TouchableOpacity
                      className="bg-green-600 px-3 py-1 rounded flex-row items-center mr-2"
                      onPress={() => {
                        const name = editingName.trim();
                        if (!name) return;
                        if (onUpdateTag) onUpdateTag(tag, name);
                        setEditingTagId(null);
                        setEditingName('');
                      }}
                    >
                      <Save size={14} color="#fff" />
                      <Text className="text-white text-sm font-medium ml-1">Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="bg-gray-200 px-3 py-1 rounded"
                      onPress={() => {
                        setEditingTagId(null);
                        setEditingName('');
                      }}
                    >
                      <Text className="text-gray-700 text-sm font-medium">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text className="text-base font-semibold text-gray-900">{tag.name}</Text>
                    <Text className="text-xs text-gray-600 mt-1">Materials using this tag: {countForTag(tag.id)}</Text>
                  </>
                )}
              </View>
              {editingTagId !== tag.id && (
                <View className="flex-row space-x-2">
                  <TouchableOpacity
                    className="bg-blue-100 px-3 py-1 rounded mr-2"
                    onPress={() => { setEditingTagId(tag.id); setEditingName(tag.name); }}
                  >
                    <Text className="text-blue-700 text-sm font-medium">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-red-100 px-3 py-1 rounded"
                    onPress={() => setConfirm({visible: true, tag})}
                  >
                    <Text className="text-red-700 text-sm font-medium">Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Confirm delete modal */}
      <Modal visible={confirm.visible} transparent animationType="fade" onRequestClose={() => setConfirm({visible:false, tag:null})}>
        <TouchableOpacity 
          className="flex-1 bg-black/50 justify-center items-center p-4"
          activeOpacity={1}
          onPress={() => setConfirm({visible:false, tag:null})}
        >
          <TouchableOpacity 
            className="bg-white rounded-xl w-full max-w-md"
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Supplier Product Modal Component
export function SupplierProductModal({
  visible,
  supplier,
  onClose,
  allMaterials,
  allUnits
}: {
  visible: boolean;
  supplier: Supplier;
  onClose: () => void;
  allMaterials: Material[];
  allUnits: UnitOfMeasure[];
}) {
  const [supplierVariants, setSupplierVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVariantManager, setShowVariantManager] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [addMode, setAddMode] = useState<'existing' | 'new_variant' | 'new_material' | null>(null);

  useEffect(() => {
    if (visible && supplier.id) {
      loadSupplierVariants();
    }
  }, [visible, supplier.id]);

  const loadSupplierVariants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supplierOperations.getSupplierVariants(supplier.id);
      if (error) {
        Alert.alert('Error', 'Failed to load supplier products');
      } else {
        setSupplierVariants(data || []);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load supplier products');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black bg-opacity-50 justify-center items-center p-4">
        {/* backdrop click to close */}
        <TouchableOpacity className="absolute inset-0" onPress={onClose} />
        <View className="bg-white rounded-2xl w-full max-w-5xl max-h-[85%] overflow-hidden">
          {/* Header */}
          <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {supplier.name} Products
              </Text>
              <Text className="text-sm text-gray-600 mt-1">
                {supplierVariants.length} product{supplierVariants.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View className="flex-row items-center">
              <TouchableOpacity
                className="bg-blue-600 px-4 py-2 rounded-lg mr-2 flex-row items-center"
                onPress={() => setShowAddOptions(!showAddOptions)}
              >
                <Plus size={16} color="white" />
                <Text className="text-white font-medium ml-1">Add Product</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-gray-100 p-2 rounded-lg"
                onPress={onClose}
              >
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Add Options */}
          {showAddOptions && (
            <View className="bg-gray-50 p-4 border-b border-gray-200">
              <Text className="text-sm font-medium text-gray-700 mb-3">Choose how to add a product:</Text>
              <View>
                <TouchableOpacity
                  className="bg-white p-3 rounded-lg border border-gray-200 flex-row items-center mb-2"
                  onPress={() => {
                    setAddMode('existing');
                    setShowVariantManager(true);
                    setShowAddOptions(false);
                  }}
                >
                  <Package size={20} color="#3b82f6" />
                  <View className="ml-3 flex-1">
                    <Text className="font-medium text-gray-900">Add pricing for existing product</Text>
                    <Text className="text-xs text-gray-600">Select from existing materials and variants</Text>
                  </View>
                  <ChevronRight size={20} color="#6b7280" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  className="bg-white p-3 rounded-lg border border-gray-200 flex-row items-center mb-2"
                  onPress={() => {
                    setAddMode('new_variant');
                    setShowVariantManager(true);
                    setShowAddOptions(false);
                  }}
                >
                  <TagIcon size={20} color="#10b981" />
                  <View className="ml-3 flex-1">
                    <Text className="font-medium text-gray-900">Create new variant</Text>
                    <Text className="text-xs text-gray-600">Add a new variant to an existing material</Text>
                  </View>
                  <ChevronRight size={20} color="#6b7280" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  className="bg-white p-3 rounded-lg border border-gray-200 flex-row items-center"
                  onPress={() => {
                    setAddMode('new_material');
                    setShowVariantManager(true);
                    setShowAddOptions(false);
                  }}
                >
                  <Plus size={20} color="#f59e0b" />
                  <View className="ml-3 flex-1">
                    <Text className="font-medium text-gray-900">Create new material</Text>
                    <Text className="text-xs text-gray-600">Add a completely new material with variants</Text>
                  </View>
                  <ChevronRight size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Content */}
          <ScrollView className="flex-1 p-4">
            {loading ? (
              <View className="flex-1 justify-center items-center py-8">
                <Text className="text-gray-600">Loading products...</Text>
              </View>
            ) : supplierVariants.length === 0 ? (
              <View className="flex-1 justify-center items-center py-8">
                <Package size={48} color="#d1d5db" />
                <Text className="text-gray-600 mt-4 text-center">
                  No products found for this supplier.
                </Text>
                <TouchableOpacity
                  className="bg-blue-600 px-4 py-2 rounded-lg mt-4 flex-row items-center"
                  onPress={() => setShowAddOptions(true)}
                >
                  <Plus size={16} color="white" />
                  <Text className="text-white font-medium ml-1">Add First Product</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {supplierVariants.map((item, index) => (
                  <View key={index} className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1">
                        <Text className="text-lg font-semibold text-gray-900">
                          {item.material_variants?.materials?.name}
                        </Text>
                        <Text className="text-base text-gray-700 mt-1">
                          {item.material_variants?.variant_name}
                        </Text>
                        {item.material_variants?.description && (
                          <Text className="text-sm text-gray-600 mt-1">
                            {item.material_variants.description}
                          </Text>
                        )}
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-bold text-green-600">
                          {formatPrice(item.price)}
                        </Text>
                        <Text className="text-sm text-gray-600">
                          per {(() => {
                            const unitName = item.units_of_measure?.name;
                            return unitName && unitName.trim() && unitName.trim() !== '.' ? unitName : 'unit';
                          })()}
                        </Text>
                        {item.stock_level !== null && (
                          <Text className="text-sm text-blue-600 mt-1">
                            Stock: {item.stock_level}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {item.material_variants?.attributes && (
                      <View className="border-t border-gray-200 pt-2 mt-2">
                        <Text className="text-sm text-gray-600">
                          {Object.entries(item.material_variants.attributes).map(([key, value]) => 
                            `${key}: ${value}`
                          ).join(' • ')}
                        </Text>
                      </View>
                    )}
                    
                    {item.updated_at && (
                      <View className="flex-row items-center mt-2">
                        <Text className="text-xs text-gray-500">
                          Last updated: {new Date(item.updated_at).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
        
        {/* Variant Manager Modal */}
        {showVariantManager && (
          <SupplierVariantManager
            visible={showVariantManager}
            supplier={supplier}
            allMaterials={allMaterials}
            allUnits={allUnits}
            onClose={() => {
              setShowVariantManager(false);
              setAddMode(null);
            }}
            onUpdate={loadSupplierVariants}
            mode={addMode || 'existing'}
          />
        )}
      </View>
    </Modal>
  );
}

// Supplier Variant Manager Component
export function SupplierVariantManager({
  visible,
  supplier,
  allMaterials,
  allUnits,
  onClose,
  onUpdate,
  mode = 'existing'
}: {
  visible: boolean;
  supplier: Supplier;
  allMaterials: Material[];
  allUnits: UnitOfMeasure[];
  onClose: () => void;
  onUpdate: () => void;
  mode?: 'existing' | 'new_variant' | 'new_material';
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MaterialVariant | null>(null);
  const [price, setPrice] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitOfMeasure | null>(null);
  const [stockLevel, setStockLevel] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>(allMaterials);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New material/variant form states
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialDescription, setNewMaterialDescription] = useState('');
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantDescription, setNewVariantDescription] = useState('');
  const [showNewMaterialForm, setShowNewMaterialForm] = useState(false);
  const [showNewVariantForm, setShowNewVariantForm] = useState(false);
  
  // Filter materials based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMaterials(allMaterials);
    } else {
      const filtered = allMaterials.filter(material =>
        material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (material.description && material.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (material.material_variants && material.material_variants.some(variant =>
          variant.variant_name.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      );
      setFilteredMaterials(filtered);
    }
  }, [searchQuery, allMaterials]);

  const resetForm = () => {
    setSearchQuery('');
    setSelectedMaterial(null);
    setSelectedVariant(null);
    setPrice('');
    setSelectedUnit(null);
    setStockLevel('');
    setShowDropdown(false);
  };

  const handleSelectMaterial = (material: Material) => {
    setSelectedMaterial(material);
    setSelectedVariant(null);
    setShowDropdown(false);
    setSearchQuery(`${material.name}`);
  };

  const handleSelectVariant = (variant: MaterialVariant) => {
    setSelectedVariant(variant);
    setSearchQuery(`${selectedMaterial?.name} - ${variant.variant_name}`);
  };

  const handleAddPricing = async () => {
    if (!selectedVariant || !price || !selectedUnit) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const pricingData = {
        material_variant_id: selectedVariant.id,
        supplier_id: supplier.id,
        price: parseFloat(price),
        unit_id: selectedUnit.id,
        stock_level: stockLevel ? parseInt(stockLevel) : null
      };

      const { error } = await pricingOperations.create(pricingData);
      if (error) {
        Alert.alert('Error', 'Failed to add supplier pricing');
      } else {
        Alert.alert('Success', 'Supplier pricing added successfully');
        resetForm();
        onUpdate();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to add supplier pricing');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCreateVariantWithPricing = async () => {
    if (!selectedMaterial || !newVariantName || !price || !selectedUnit) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the variant
      const variantData = {
        material_id: selectedMaterial.id,
        variant_name: newVariantName,
        description: newVariantDescription || null,
        attributes: {}
      };

      const { data: newVariant, error: variantError } = await variantOperations.create(variantData);
      if (variantError || !newVariant) {
        Alert.alert('Error', 'Failed to create variant');
        return;
      }

      // Create the supplier pricing
      const pricingData = {
        material_variant_id: newVariant.id,
        supplier_id: supplier.id,
        price: parseFloat(price),
        unit_id: selectedUnit.id,
        stock_level: stockLevel ? parseInt(stockLevel) : null
      };

      const { error: pricingError } = await pricingOperations.create(pricingData);
      if (pricingError) {
        Alert.alert('Error', 'Variant created but failed to add pricing');
      } else {
        Alert.alert('Success', 'Variant and pricing added successfully');
        resetForm();
        setNewVariantName('');
        setNewVariantDescription('');
        onUpdate();
        onClose();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create variant');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCreateMaterialWithVariantAndPricing = async () => {
    if (!newMaterialName || !newVariantName || !price || !selectedUnit) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the material
      const materialData = {
        name: newMaterialName,
        description: newMaterialDescription || null,
        unit_id: selectedUnit.id
      };

      const { data: newMaterial, error: materialError } = await materialOperations.create(materialData);
      if (materialError || !newMaterial) {
        Alert.alert('Error', 'Failed to create material');
        return;
      }

      // Create the variant
      const variantData = {
        material_id: newMaterial.id,
        variant_name: newVariantName,
        description: newVariantDescription || null,
        attributes: {}
      };

      const { data: newVariant, error: variantError } = await variantOperations.create(variantData);
      if (variantError || !newVariant) {
        Alert.alert('Error', 'Material created but failed to create variant');
        return;
      }

      // Create the supplier pricing
      const pricingData = {
        material_variant_id: newVariant.id,
        supplier_id: supplier.id,
        price: parseFloat(price),
        unit_id: selectedUnit.id,
        stock_level: stockLevel ? parseInt(stockLevel) : null
      };

      const { error: pricingError } = await pricingOperations.create(pricingData);
      if (pricingError) {
        Alert.alert('Error', 'Material and variant created but failed to add pricing');
      } else {
        Alert.alert('Success', 'Material, variant and pricing created successfully');
        resetForm();
        setNewMaterialName('');
        setNewMaterialDescription('');
        setNewVariantName('');
        setNewVariantDescription('');
        onUpdate();
        onClose();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create material');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black bg-opacity-50 justify-center items-center p-4">
        {/* backdrop */}
        <TouchableOpacity className="absolute inset-0" onPress={onClose} />
        <View className="bg-white rounded-2xl w-full max-w-4xl max-h-[90%] overflow-hidden">
          {/* Header */}
          <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
            <View>
              <Text className="text-xl font-bold text-gray-900">
                {mode === 'new_material' ? 'Create New Material' : 
                 mode === 'new_variant' ? 'Create New Variant' : 
                 'Add Product'} for {supplier.name}
              </Text>
              <Text className="text-sm text-gray-600 mt-1">
                {mode === 'new_material' ? 'Add a new material with variants and pricing' : 
                 mode === 'new_variant' ? 'Add a new variant to an existing material' : 
                 'Add pricing for existing products'}
              </Text>
            </View>
            <TouchableOpacity
              className="bg-gray-100 p-2 rounded-lg"
              onPress={onClose}
            >
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            {/* New Material Form */}
            {mode === 'new_material' && (
              <>
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-900 mb-2">
                    Material Name *
                  </Text>
                  <TextInput
                    value={newMaterialName}
                    onChangeText={setNewMaterialName}
                    placeholder="Enter material name"
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                </View>
                
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-900 mb-2">
                    Material Description
                  </Text>
                  <TextInput
                    value={newMaterialDescription}
                    onChangeText={setNewMaterialDescription}
                    placeholder="Enter material description"
                    multiline
                    numberOfLines={3}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                </View>
                
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-900 mb-2">
                    Variant Name *
                  </Text>
                  <TextInput
                    value={newVariantName}
                    onChangeText={setNewVariantName}
                    placeholder="Enter variant name (e.g., Standard, Large, Red)"
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                </View>
                
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-900 mb-2">
                    Variant Description
                  </Text>
                  <TextInput
                    value={newVariantDescription}
                    onChangeText={setNewVariantDescription}
                    placeholder="Enter variant description"
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                </View>
              </>
            )}
            
            {/* New Variant Form (for existing material) */}
            {mode === 'new_variant' && (
              <>
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-900 mb-2">
                    Select Material *
                  </Text>
                  <View className="relative">
                    <TextInput
                      value={searchQuery}
                      onChangeText={(text) => {
                        setSearchQuery(text);
                        setShowDropdown(true);
                        if (!text) {
                          setSelectedMaterial(null);
                        }
                      }}
                      placeholder="Search for material..."
                      className="border border-gray-300 rounded-lg px-3 py-2 pr-10"
                      onFocus={() => setShowDropdown(true)}
                    />
                    <TouchableOpacity 
                      className="absolute right-3 top-2"
                      onPress={() => setShowDropdown(!showDropdown)}
                    >
                      <Search size={20} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Material Dropdown */}
                  {showDropdown && (
                    <View className="absolute top-20 left-0 right-0 bg-white border border-gray-300 rounded-lg max-h-64 z-10">
                      <ScrollView>
                        {filteredMaterials.map((material) => (
                          <TouchableOpacity
                            key={material.id}
                            className="p-3 border-b border-gray-100"
                            onPress={() => {
                              handleSelectMaterial(material);
                              setShowDropdown(false);
                            }}
                          >
                            <Text className="font-medium text-gray-900">
                              {material.name}
                            </Text>
                            {material.description && (
                              <Text className="text-sm text-gray-600">
                                {material.description}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                
                {selectedMaterial && (
                  <>
                    <View className="mb-4">
                      <Text className="text-base font-medium text-gray-900 mb-2">
                        Variant Name *
                      </Text>
                      <TextInput
                        value={newVariantName}
                        onChangeText={setNewVariantName}
                        placeholder="Enter variant name"
                        className="border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </View>
                    
                    <View className="mb-4">
                      <Text className="text-base font-medium text-gray-900 mb-2">
                        Variant Description
                      </Text>
                      <TextInput
                        value={newVariantDescription}
                        onChangeText={setNewVariantDescription}
                        placeholder="Enter variant description"
                        className="border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </View>
                  </>
                )}
              </>
            )}
            
            {/* Existing Product Selection */}
            {mode === 'existing' && (
              <View className="mb-4">
                <Text className="text-base font-medium text-gray-900 mb-2">
                  Search Materials/Variants *
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
                    }
                  }}
                  placeholder="Search for materials or variants..."
                  className="border border-gray-300 rounded-lg px-3 py-2 pr-10"
                  onFocus={() => setShowDropdown(true)}
                />
                <TouchableOpacity 
                  className="absolute right-3 top-2"
                  onPress={() => setShowDropdown(!showDropdown)}
                >
                  <Search size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              
              {/* Dropdown */}
              {showDropdown && (
                <View className="absolute top-20 left-0 right-0 bg-white border border-gray-300 rounded-lg max-h-64 z-10">
                  <ScrollView>
                    {filteredMaterials.map((material) => (
                      <View key={material.id}>
                        <TouchableOpacity
                          className="p-3 border-b border-gray-100"
                          onPress={() => handleSelectMaterial(material)}
                        >
                          <Text className="font-medium text-gray-900">
                            {material.name}
                          </Text>
                          {material.description && (
                            <Text className="text-sm text-gray-600">
                              {material.description}
                            </Text>
                          )}
                        </TouchableOpacity>
                        
                        {/* Show variants if material is selected or matches search */}
                        {material.material_variants && material.material_variants.map((variant) => (
                          <TouchableOpacity
                            key={variant.id}
                            className="p-3 pl-6 border-b border-gray-50 bg-gray-50"
                            onPress={() => {
                              handleSelectMaterial(material);
                              handleSelectVariant(variant);
                            }}
                          >
                            <Text className="text-gray-900">
                              {variant.variant_name}
                            </Text>
                            {variant.description && (
                              <Text className="text-sm text-gray-600">
                                {variant.description}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
			)}
			
			{/* Variant Selection for existing material */}
            {selectedMaterial && selectedMaterial.material_variants && selectedMaterial.material_variants.length > 0 && !selectedVariant && (
              <View className="mb-4">
                <Text className="text-base font-medium text-gray-900 mb-2">
                  Select Variant *
                </Text>
                <View className="flex-wrap">
                  {selectedMaterial.material_variants.map((variant) => (
                    <TouchableOpacity
                      key={variant.id}
                      className={`border rounded-lg p-3 mr-2 mb-2 ${selectedVariant?.id === variant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                      onPress={() => handleSelectVariant(variant)}
                    >
                      <Text className={`${selectedVariant?.id === variant.id ? 'text-blue-900' : 'text-gray-900'} font-medium`}>
                        {variant.variant_name}
                      </Text>
                      {variant.description && (
                        <Text className={`text-sm ${selectedVariant?.id === variant.id ? 'text-blue-700' : 'text-gray-600'}`}>
                          {variant.description}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Price Input - show for all modes when appropriate */}
            {(mode === 'existing' ? selectedVariant : (mode === 'new_variant' ? (selectedMaterial && newVariantName) : (newMaterialName && newVariantName))) && (
              <>
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-900 mb-2">
                    Price *
                  </Text>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    placeholder="0.00"
                    keyboardType="numeric"
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                </View>

                {/* Unit Selection */}
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-900 mb-2">
                    Unit of Measure *
                  </Text>
                  <View className="flex-row flex-wrap">
                    {allUnits.map((unit) => (
                      <TouchableOpacity
                        key={unit.id}
                        className={`border rounded-lg px-3 py-2 mr-2 mb-2 ${
                          selectedUnit?.id === unit.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-300'
                        }`}
                        onPress={() => setSelectedUnit(unit)}
                      >
                        <Text className={`${
                          selectedUnit?.id === unit.id 
                            ? 'text-blue-900' 
                            : 'text-gray-900'
                        }`}>
                          {unit.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Stock Level (Optional) */}
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-900 mb-2">
                    Stock Level (Optional)
                  </Text>
                  <TextInput
                    value={stockLevel}
                    onChangeText={setStockLevel}
                    placeholder="0"
                    keyboardType="numeric"
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  className={`rounded-lg py-3 px-4 ${isSubmitting ? 'bg-gray-300' : 'bg-blue-600'}`}
                  onPress={mode === 'new_material' ? handleCreateMaterialWithVariantAndPricing : 
                          mode === 'new_variant' ? handleCreateVariantWithPricing : 
                          handleAddPricing}
                  disabled={isSubmitting}
                >
                  <Text className="text-white font-medium text-center">
                    {isSubmitting ? 'Creating...' : 
                     mode === 'new_material' ? 'Create Material & Add Pricing' : 
                     mode === 'new_variant' ? 'Create Variant & Add Pricing' : 
                     'Add Product'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
