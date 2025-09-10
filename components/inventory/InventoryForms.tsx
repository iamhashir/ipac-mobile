import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Plus, Minus, X } from 'lucide-react-native';

import {
  Material,
  MaterialVariant,
  Supplier,
  UnitOfMeasure,
  variantOperations,
  supplierOperations,
  pricingOperations
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
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            {supplier ? 'Edit Supplier' : 'Add New Supplier'}
          </Text>
          <Text className="text-gray-600">
            {supplier ? 'Update supplier information' : 'Create a new supplier entry'}
          </Text>
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
  onSave, 
  onCancel 
}: {
  material: Material;
  variant?: MaterialVariant;
  onSave: (variantData: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    variant_name: variant?.variant_name || '',
    material_id: material.id,
  });
  
  const [attributes, setAttributes] = useState<{key: string, value: string}[]>(
    variant?.attributes 
      ? Object.entries(variant.attributes).map(([key, value]) => ({ key, value: String(value) }))
      : [{ key: '', value: '' }]
  );

  const handleSave = () => {
    if (!formData.variant_name.trim()) {
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

    onSave({
      ...formData,
      attributes: Object.keys(attributesObj).length > 0 ? attributesObj : null
    });
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
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            {variant ? 'Edit Variant' : 'Add New Variant'}
          </Text>
          <Text className="text-gray-600">
            Material: {material.name}
          </Text>
        </View>

        {/* Variant Name */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Variant Name *
          </Text>
          <TextInput
            value={formData.variant_name}
            onChangeText={(text) => setFormData(prev => ({ ...prev, variant_name: text }))}
            placeholder="e.g., Plywood - 12mm Marine"
            className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          />
        </View>

        {/* Attributes */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-sm font-medium text-gray-700">
              Attributes
            </Text>
            <TouchableOpacity
              onPress={addAttribute}
              className="bg-blue-50 px-3 py-1 rounded-lg flex-row items-center"
            >
              <Plus size={16} color="#3b82f6" />
              <Text className="ml-1 text-blue-600 text-sm font-medium">Add</Text>
            </TouchableOpacity>
          </View>

          {attributes.map((attr, index) => (
            <View key={index} className="flex-row mb-3 space-x-2">
              <View className="flex-1">
                <TextInput
                  value={attr.key}
                  onChangeText={(text) => updateAttribute(index, 'key', text)}
                  placeholder="Property (e.g., thickness_mm)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                />
              </View>
              <View className="flex-1">
                <TextInput
                  value={attr.value}
                  onChangeText={(text) => updateAttribute(index, 'value', text)}
                  placeholder="Value (e.g., 12)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                />
              </View>
              {attributes.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeAttribute(index)}
                  className="bg-red-50 p-2 rounded-lg justify-center"
                >
                  <Minus size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
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
              {variant ? 'Update' : 'Create'} Variant
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// Supplier Pricing Form
export function SupplierPricingForm({ 
  variant,
  suppliers,
  units,
  pricing,
  onSave, 
  onCancel 
}: {
  variant: MaterialVariant;
  suppliers: Supplier[];
  units: UnitOfMeasure[];
  pricing?: any;
  onSave: (pricingData: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    supplier_id: pricing?.supplier_id || '',
    price: pricing?.price ? String(pricing.price) : '',
    unit_id: pricing?.unit_id || '',
    stock_level: pricing?.stock_level ? String(pricing.stock_level) : '',
    material_variant_id: variant.id,
  });

  const handleSave = () => {
    if (!formData.supplier_id) {
      Alert.alert('Error', 'Please select a supplier');
      return;
    }
    if (!formData.price.trim() || isNaN(Number(formData.price))) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    if (!formData.unit_id) {
      Alert.alert('Error', 'Please select a unit of measure');
      return;
    }

    const pricingData = {
      ...formData,
      price: Number(formData.price),
      stock_level: formData.stock_level ? Number(formData.stock_level) : null,
    };

    onSave(pricingData);
  };

  return (
    <View className="bg-white rounded-lg p-6">
      <View className="mb-6">
        <Text className="text-xl font-bold text-gray-900 mb-2">
          {pricing ? 'Edit Pricing' : 'Add Supplier Pricing'}
        </Text>
        <Text className="text-gray-600">
          Variant: {variant.variant_name}
        </Text>
      </View>

      {/* Supplier Selection */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Supplier *
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {suppliers.map((supplier) => (
              <TouchableOpacity
                key={supplier.id}
                onPress={() => setFormData(prev => ({ ...prev, supplier_id: supplier.id }))}
                className={`px-4 py-2 rounded-lg mr-2 border ${
                  formData.supplier_id === supplier.id 
                    ? 'bg-blue-100 border-blue-300' 
                    : 'bg-gray-100 border-gray-300'
                }`}
              >
                <Text className={`text-sm ${
                  formData.supplier_id === supplier.id ? 'text-blue-800 font-medium' : 'text-gray-700'
                }`}>
                  {supplier.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Price */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Price (AED) *
        </Text>
        <TextInput
          value={formData.price}
          onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
          placeholder="Enter price"
          keyboardType="decimal-pad"
          className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
        />
      </View>

      {/* Unit of Measure */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Unit of Measure *
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {units.map((unit) => (
              <TouchableOpacity
                key={unit.id}
                onPress={() => setFormData(prev => ({ ...prev, unit_id: unit.id }))}
                className={`px-4 py-2 rounded-lg mr-2 border ${
                  formData.unit_id === unit.id 
                    ? 'bg-blue-100 border-blue-300' 
                    : 'bg-gray-100 border-gray-300'
                }`}
              >
                <Text className={`text-sm ${
                  formData.unit_id === unit.id ? 'text-blue-800 font-medium' : 'text-gray-700'
                }`}>
                  {unit.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Stock Level */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Stock Level (Optional)
        </Text>
        <TextInput
          value={formData.stock_level}
          onChangeText={(text) => setFormData(prev => ({ ...prev, stock_level: text }))}
          placeholder="Enter current stock level"
          keyboardType="number-pad"
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
            {pricing ? 'Update' : 'Add'} Pricing
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
