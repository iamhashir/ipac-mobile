import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Plus, Minus, X, Tag, ChevronDown } from 'lucide-react-native';

import {
  Material,
  MaterialVariant,
  Supplier,
  UnitOfMeasure,
  Tag as TagType,
  variantOperations,
  supplierOperations,
  pricingOperations,
  tagOperations
} from '../../utils/api/inventory';

// Supplier Form Component
export function SupplierForm({ 
  supplier, 
  onSave, 
  onCancel 
}: {
  supplier?: Supplier;
  onSave: (supplierData: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    contact_person: supplier?.contact_person || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    other_info: supplier?.other_info || '',
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Supplier name is required');
      return;
    }

    onSave(formData);
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        <View className="mb-6">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-2xl font-bold text-gray-900 mb-2">
                {supplier ? 'Edit Supplier' : 'Add New Supplier'}
              </Text>
              <Text className="text-gray-600">
                {supplier ? 'Update supplier information' : 'Create a new supplier entry'}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} className="p-2 rounded-full bg-gray-100">
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Supplier Name */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Supplier Name *
          </Text>
          <TextInput
            value={formData.name}
            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            placeholder="Enter supplier name"
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          />
        </View>

        {/* Contact Person */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Contact Person
          </Text>
          <TextInput
            value={formData.contact_person}
            onChangeText={(text) => setFormData(prev => ({ ...prev, contact_person: text }))}
            placeholder="Enter contact person name"
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          />
        </View>

        {/* Email */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Email Address
          </Text>
          <TextInput
            value={formData.email}
            onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          />
        </View>

        {/* Phone */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </Text>
          <TextInput
            value={formData.phone}
            onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          />
        </View>

        {/* Address */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Address
          </Text>
          <TextInput
            value={formData.address}
            onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
            placeholder="Enter address"
            multiline
            numberOfLines={3}
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          />
        </View>

        {/* Other Info */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Additional Information
          </Text>
          <TextInput
            value={formData.other_info}
            onChangeText={(text) => setFormData(prev => ({ ...prev, other_info: text }))}
            placeholder="Enter additional information"
            multiline
            numberOfLines={3}
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          />
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
              {supplier ? 'Update' : 'Create'} Supplier
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// Variant Form Component
export function VariantForm({ 
  material,
  variant,
  suppliers,
  units,
  onSave, 
  onCancel 
}: {
  material: Material;
  variant?: MaterialVariant;
  suppliers?: Supplier[];
  units?: UnitOfMeasure[];
  onSave: (variantData: any) => void;
  onCancel: () => void;
}) {
  // Pre-fill with material name for new variants
  const [namePrefix] = useState(material.name);
  const [nameSuffix, setNameSuffix] = useState(
    variant ? variant.variant_name.replace(material.name, '').trim() : ''
  );
  
  const [formData, setFormData] = useState({
    variant_name: variant?.variant_name || material.name,
    description: variant?.description || '',
    material_id: material.id,
    length: variant?.length ? String(variant.length) : '',
    width: variant?.width ? String(variant.width) : '',
    thickness: variant?.thickness ? String(variant.thickness) : '',
    weight_per_unit: variant?.weight_per_unit ? String(variant.weight_per_unit) : '',
  });
  
  const [attributes, setAttributes] = useState<{key: string, value: string}[]>(
    variant?.attributes 
      ? Object.entries(variant.attributes).map(([key, value]) => ({ key, value: String(value) }))
      : [{ key: '', value: '' }]
  );

  // Tags state
  const [availableTags, setAvailableTags] = useState<TagType[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [loadingTags, setLoadingTags] = useState(true);

  // Load available tags and current variant tags
  useEffect(() => {
    loadTags();
    if (variant?.id) {
      loadVariantTags();
    }
  }, [variant?.id]);

  const loadTags = async () => {
    try {
      const { data, error } = await tagOperations.getAll();
      if (error) {
        console.error('Error loading tags:', error);
      } else {
        setAvailableTags(data || []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  const loadVariantTags = async () => {
    if (!variant?.id) return;
    try {
      const { data, error } = await variantOperations.getWithTags(variant.id);
      if (data?.material_variant_tags) {
        const tagIds = data.material_variant_tags.map((vt: any) => vt.tag_id);
        setSelectedTags(tagIds);
      }
    } catch (error) {
      console.error('Error loading variant tags:', error);
    }
  };

  const handleSave = async () => {
    // Combine material name with suffix
    const fullVariantName = nameSuffix.trim() 
      ? `${namePrefix} ${nameSuffix.trim()}` 
      : namePrefix;
    
    if (!fullVariantName.trim()) {
      Alert.alert('Error', 'Variant name is required');
      return;
    }

    // Convert attributes array to object
    const attributesObj = attributes.reduce((acc, attr) => {
      if (attr.key.trim() && attr.value.trim()) {
        acc[attr.key.trim()] = attr.value.trim();
      }
      return acc;
    }, {} as Record<string, string>);

    const variantData = {
      ...formData,
      variant_name: fullVariantName,
      attributes: Object.keys(attributesObj).length > 0 ? attributesObj : null,
      length: formData.length ? parseFloat(formData.length) : null,
      width: formData.width ? parseFloat(formData.width) : null,
      thickness: formData.thickness ? parseFloat(formData.thickness) : null,
      weight_per_unit: formData.weight_per_unit ? parseFloat(formData.weight_per_unit) : null,
    };

    // Save the variant data and handle tags
    onSave({ 
      ...variantData, 
      tags: selectedTags // Pass selected tags to be handled by parent component
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

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
        setAvailableTags(prev => [...prev, data as TagType]);
        setSelectedTags(prev => [...prev, (data as TagType).id]);
        setNewTagName('');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create tag');
    }
  };

  const addAttribute = () => {
    setAttributes(prev => [...prev, { key: '', value: '' }]);
  };

  const removeAttribute = (index: number) => {
    if (attributes.length > 1) {
      setAttributes(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateAttribute = (index: number, field: 'key' | 'value', value: string) => {
    setAttributes(prev => prev.map((attr, i) => 
      i === index ? { ...attr, [field]: value } : attr
    ));
  };

  return (
    <View className="flex-1 bg-white rounded-2xl overflow-hidden">
      <View className="p-6">
        <View className="mb-4">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-xl font-bold text-gray-900 mb-1">
                {variant ? 'Edit Variant' : 'Add New Variant'}
              </Text>
              <Text className="text-sm text-gray-600">
                Material: {material.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} className="p-2 rounded-full bg-gray-100">
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Variant Name with Material Prefix */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Variant Name *
          </Text>
          <View className="flex-row items-center border border-gray-300 rounded-lg">
            <View className="bg-gray-100 px-4 py-3 border-r border-gray-300">
              <Text className="text-gray-700 font-medium">{namePrefix}</Text>
            </View>
            <TextInput
              value={nameSuffix}
              onChangeText={setNameSuffix}
              placeholder="e.g., 12mm Marine"
              className="flex-1 px-4 py-3 text-gray-900"
            />
          </View>
          <Text className="text-xs text-gray-500 mt-1">
            Full name: {nameSuffix.trim() ? `${namePrefix} ${nameSuffix.trim()}` : namePrefix}
          </Text>
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Description
          </Text>
          <TextInput
            value={formData.description}
            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
            placeholder="Describe this variant (optional)"
            multiline
            numberOfLines={2}
            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 text-sm"
          />
        </View>

        {/* Dimensions */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Dimensions
          </Text>
          <View className="flex-row space-x-2 mb-2">
            <View className="flex-1">
              <Text className="text-xs text-gray-600 mb-1">Length</Text>
              <TextInput
                value={formData.length}
                onChangeText={(text) => setFormData(prev => ({ ...prev, length: text }))}
                placeholder="Length"
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-2 py-1 text-gray-900 text-sm"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-600 mb-1">Width</Text>
              <TextInput
                value={formData.width}
                onChangeText={(text) => setFormData(prev => ({ ...prev, width: text }))}
                placeholder="Width"
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-2 py-1 text-gray-900 text-sm"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-600 mb-1">Thickness</Text>
              <TextInput
                value={formData.thickness}
                onChangeText={(text) => setFormData(prev => ({ ...prev, thickness: text }))}
                placeholder="Thickness"
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-2 py-1 text-gray-900 text-sm"
              />
            </View>
          </View>
          <View className="mt-2">
            <Text className="text-xs text-gray-600 mb-1">Weight Per Unit</Text>
            <TextInput
              value={formData.weight_per_unit}
              onChangeText={(text) => setFormData(prev => ({ ...prev, weight_per_unit: text }))}
              placeholder="Weight per unit (optional)"
              keyboardType="decimal-pad"
              className="border border-gray-300 rounded-lg px-2 py-1 text-gray-900 text-sm"
            />
          </View>
        </View>

        {/* Attributes */}
        <View className="mb-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm font-medium text-gray-700">
              Attributes
            </Text>
            <TouchableOpacity
              onPress={addAttribute}
              className="bg-blue-50 px-2 py-1 rounded-lg flex-row items-center"
            >
              <Plus size={14} color="#3b82f6" />
              <Text className="ml-1 text-blue-600 text-xs font-medium">Add</Text>
            </TouchableOpacity>
          </View>

          <View className="max-h-24">
            <ScrollView showsVerticalScrollIndicator={false}>
              {attributes.map((attr, index) => (
                <View key={index} className="flex-row mb-2 space-x-1">
                  <View className="flex-1">
                    <TextInput
                      value={attr.key}
                      onChangeText={(text) => updateAttribute(index, 'key', text)}
                      placeholder="Property"
                      className="border border-gray-300 rounded-lg px-2 py-1 text-gray-900 text-sm"
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput
                      value={attr.value}
                      onChangeText={(text) => updateAttribute(index, 'value', text)}
                      placeholder="Value"
                      className="border border-gray-300 rounded-lg px-2 py-1 text-gray-900 text-sm"
                    />
                  </View>
                  {attributes.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeAttribute(index)}
                      className="bg-red-50 p-1 rounded-lg justify-center"
                    >
                      <Minus size={14} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Tags */}
        <View className="mb-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm font-medium text-gray-700">
              Tags
            </Text>
            <View className="flex-row items-center">
              <Text className="text-xs text-gray-500 mr-2">({selectedTags.length} selected)</Text>
              <Tag size={14} color="#6b7280" />
            </View>
          </View>

          {/* Quick add tag */}
          <View className="mb-2 flex-row items-center">
            <TextInput
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="New tag name"
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-gray-900 text-sm"
            />
            <TouchableOpacity
              onPress={handleAddTag}
              className="ml-1 bg-green-50 px-2 py-1 rounded-lg"
            >
              <Text className="text-green-600 font-medium text-xs">Add</Text>
            </TouchableOpacity>
          </View>

          {/* Available tags */}
          <View className="max-h-20">
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap">
                {availableTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => toggleTag(tag.id)}
                    className={`px-2 py-1 rounded-lg mr-1 mb-1 border ${
                      selectedTags.includes(tag.id)
                        ? 'bg-blue-100 border-blue-300'
                        : 'bg-gray-100 border-gray-300'
                    }`}
                  >
                    <Text className={`text-xs ${
                      selectedTags.includes(tag.id) ? 'text-blue-800 font-medium' : 'text-gray-700'
                    }`}>
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {availableTags.length === 0 && !loadingTags && (
                  <Text className="text-xs text-gray-500 p-2">No tags available. Create one above.</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row space-x-2 mt-2">
          <TouchableOpacity
            onPress={onCancel}
            className="flex-1 bg-gray-100 py-2 rounded-lg"
          >
            <Text className="text-center text-gray-700 font-medium text-sm">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            className="flex-1 bg-blue-500 py-2 rounded-lg"
          >
            <Text className="text-center text-white font-medium text-sm">
              {variant ? 'Update' : 'Create'} Variant
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Supplier Pricing Form
export function SupplierPricingForm({ 
  variant,
  suppliers,
  units,
  pricing,
  onSave, 
  onCancel,
  defaultUnitId,
}: {
  variant: MaterialVariant;
  suppliers: Supplier[];
  units: UnitOfMeasure[];
  pricing?: any;
  onSave: (pricingData: any) => void;
  onCancel: () => void;
  defaultUnitId?: string;
}) {
const [formData, setFormData] = useState({
    supplier_id: pricing?.supplier_id || '',
    price: pricing?.price ? String(pricing.price) : '',
    price_per_unit: pricing?.price_per_unit ? String(pricing.price_per_unit) : '',
    supplier_quantity: pricing?.supplier_quantity ? String(pricing.supplier_quantity) : '',
    material_variant_id: variant.id,
  });
const [errors, setErrors] = useState<{ supplier_id?: string; price?: string; price_per_unit?: string; supplier_quantity?: string }>({});
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState('');

  const handleSave = () => {
    const errs: any = {};
    if (!formData.supplier_id) errs.supplier_id = 'Please select a supplier';
    if (!formData.price.trim() || isNaN(Number(formData.price))) errs.price = 'Please enter a valid price';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const pricingData = {
      ...formData,
      price: Number(formData.price),
      price_per_unit: formData.price_per_unit ? Number(formData.price_per_unit) : Number(formData.price),
      supplier_quantity: formData.supplier_quantity ? Number(formData.supplier_quantity) : 1,
    };

    onSave(pricingData);
  };

  return (
    <View className="bg-white rounded-lg p-6 max-w-2xl w-full">
      <View className="mb-6">
        <Text className="text-xl font-bold text-gray-900 mb-2">
          {pricing ? 'Edit Pricing' : 'Add Supplier Pricing'}
        </Text>
        <Text className="text-gray-600">
          Variant: {variant.variant_name}
        </Text>
      </View>

      {/* Supplier Selection (dropdown with search) */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">Supplier *</Text>
        <View>
          <TouchableOpacity
            onPress={() => setSupplierOpen(prev => !prev)}
            className="border border-gray-300 rounded-lg px-4 py-3 flex-row items-center justify-between"
          >
            <Text className="text-gray-900">
              {suppliers.find(s => s.id === formData.supplier_id)?.name || 'Select supplier'}
            </Text>
            <ChevronDown size={16} color="#6b7280" />
          </TouchableOpacity>
          {supplierOpen && (
            <View className="mt-2 bg-white border border-gray-300 rounded-lg max-h-64">
              {/* search box */}
              <View className="p-2 border-b border-gray-200">
                <TextInput
                  value={supplierQuery}
                  onChangeText={setSupplierQuery}
                  placeholder="Type to filter suppliers..."
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                  autoFocus
                />
              </View>
              <ScrollView>
                {suppliers
                  .filter(s => !supplierQuery.trim() || s.name.toLowerCase().includes(supplierQuery.toLowerCase()))
                  .map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => { setFormData(prev => ({ ...prev, supplier_id: s.id })); setSupplierOpen(false); }}
                    className="p-3 border-b border-gray-100"
                  >
                    <Text className="text-sm text-gray-900">{s.name}</Text>
                    {(s as any).contact_person || (s as any).phone ? (
                      <Text className="text-xs text-gray-500">{(s as any).contact_person || ''}{(s as any).phone ? ` • ${(s as any).phone}` : ''}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        {errors.supplier_id && <Text className="text-xs text-red-600 mt-1">{errors.supplier_id}</Text>}
      </View>

      {/* Price */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Price (AED) *
        </Text>
        <TextInput
          value={formData.price}
          onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
          placeholder="Enter total price"
          keyboardType="decimal-pad"
          className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
        />
        {errors.price && <Text className="text-xs text-red-600 mt-1">{errors.price}</Text>}
      </View>

      {/* Price Per Unit */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Price Per Unit
        </Text>
        <TextInput
          value={formData.price_per_unit}
          onChangeText={(text) => setFormData(prev => ({ ...prev, price_per_unit: text }))}
          placeholder="Enter price per unit (optional)"
          keyboardType="decimal-pad"
          className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
        />
        <Text className="text-xs text-gray-500 mt-1">Leave empty to use total price</Text>
      </View>

      {/* Supplier Quantity */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Supplier Quantity
        </Text>
        <TextInput
          value={formData.supplier_quantity}
          onChangeText={(text) => setFormData(prev => ({ ...prev, supplier_quantity: text }))}
          placeholder="Quantity from supplier"
          keyboardType="decimal-pad"
          className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
        />
        <Text className="text-xs text-gray-500 mt-1">E.g., for plywood: unit is m² but supplier provides 29m² sheets</Text>
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
            {pricing ? 'Update' : 'Add'} Pricing
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
