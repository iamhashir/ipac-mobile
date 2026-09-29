import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { X, Plus, Minus, Tag, ChevronDown } from 'lucide-react-native';
import { db } from '../../../../../utils/api/supabase';

export interface PendingVariantSelectionPayload {
  id: string;
  isPending: true;
  label: string;
  unitId: string | null;
}

interface AddPendingMaterialModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (payload: PendingVariantSelectionPayload) => void;
  orderPackageId: string;
  autoTag?: string; // e.g., 'Accessories', 'Securing', 'Gas Packing', 'Vacuum Packing'
  materialType?: string; // The material_type for order_package_materials
}

export const AddPendingMaterialModal: React.FC<AddPendingMaterialModalProps> = ({
  visible,
  onClose,
  onSuccess,
  orderPackageId,
  autoTag,
  materialType,
}) => {
  // Form state
  const [mode, setMode] = useState<'new_material' | 'existing_material'>('existing_material');
  const [existingMaterials, setExistingMaterials] = useState<any[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  
  const [materialName, setMaterialName] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantDescription, setVariantDescription] = useState('');
  
  // Dimensions
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [thickness, setThickness] = useState('');
  const [weightPerUnit, setWeightPerUnit] = useState('');

  // Focus chaining: Length → Width → Thickness → Weight
  const widthInputRef = useRef<TextInput>(null);
  const thicknessInputRef = useRef<TextInput>(null);
  const weightInputRef = useRef<TextInput>(null);
  
  // Attributes
  const [attributes, setAttributes] = useState<{key: string, value: string}[]>([{ key: '', value: '' }]);
  
  // Tags
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  
  // Units
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  
  // Suppliers
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  
  // Pricing
  const [price, setPrice] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [supplierQuantity, setSupplierQuantity] = useState('');
  const [suppliersReference, setSuppliersReference] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (visible) {
      loadData();
      // Auto-select the tag if provided
      if (autoTag) {
        const tag = availableTags.find(t => t.name === autoTag);
        if (tag && !selectedTags.includes(tag.id)) {
          setSelectedTags(prev => [...prev, tag.id]);
        }
      }
    }
  }, [visible, autoTag]);

  const loadData = async () => {
    try {
      const [tagsRes, unitsRes, suppliersRes, materialsRes] = await Promise.all([
        db.query.from('tags').select('*'),
        db.query.from('units_of_measure').select('*'),
        db.query.from('suppliers').select('*'),
        db.query.from('materials').select('id, name, description, unit_id').order('name'),
      ]);
      
      setAvailableTags(tagsRes.data || []);
      setUnits(unitsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setExistingMaterials(materialsRes.data || []);
      
      // Auto-select tag after loading
      if (autoTag && tagsRes.data) {
        const tag = tagsRes.data.find((t: any) => t.name === autoTag);
        if (tag) {
          setSelectedTags(prev => {
            if (!prev.includes(tag.id)) {
              return [...prev, tag.id];
            }
            return prev;
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(
        'Loading failed',
        'Could not load materials, tags or units. Close the dialog and try again.'
      );
    }
  };

  const resetForm = () => {
    setMode('existing_material');
    setSelectedMaterialId(null);
    setMaterialSearchQuery('');
    setMaterialPickerOpen(false);
    setMaterialName('');
    setMaterialDescription('');
    setVariantName('');
    setVariantDescription('');
    setLength('');
    setWidth('');
    setThickness('');
    setWeightPerUnit('');
    setAttributes([{ key: '', value: '' }]);
    setSelectedTags([]);
    setNewTagName('');
    setSelectedUnit(null);
    setSelectedSupplier(null);
    setShowNewSupplierForm(false);
    setNewSupplierName('');
    setNewSupplierContact('');
    setNewSupplierPhone('');
    setPrice('');
    setPricePerUnit('');
    setSupplierQuantity('');
    setSuppliersReference('');
    setErrors({});
    setUnitPickerOpen(false);
    setSupplierPickerOpen(false);
  };

  const validate = () => {
    const errs: any = {};
    if (mode === 'new_material' && !materialName.trim()) errs.materialName = 'Material name is required';
    if (mode === 'existing_material' && !selectedMaterialId) errs.material = 'Please select a material';
    if (!variantName.trim()) errs.variantName = 'Variant name is required';
    if (!selectedUnit) errs.unit = 'Unit is required';
    if (!selectedSupplier) errs.supplier = 'Supplier is required';
    if (!price.trim() || isNaN(Number(price))) errs.price = 'Valid price is required';
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    try {
      setSaving(true);
      
      // Convert attributes array to object
      const attributesObj = attributes.reduce((acc, attr) => {
        if (attr.key.trim() && attr.value.trim()) {
          acc[attr.key.trim()] = attr.value.trim();
        }
        return acc;
      }, {} as Record<string, string>);

      if (selectedTags.length > 0) {
        const selectedTagNames = availableTags
          .filter((tag) => selectedTags.includes(tag.id))
          .map((tag) => tag.name)
          .filter(Boolean);
        (attributesObj as any).__request_tag_ids = selectedTags;
        (attributesObj as any).__request_tag_names = selectedTagNames;
      }
      
      const { data: userData, error: userError } = await db.auth.getUser();
      if (userError) throw userError;
      const requestedBy = userData?.user?.id;
      if (!requestedBy) throw new Error('Unable to identify current user. Please log in again.');

      const requestedAt = new Date().toISOString();

      // Use existing material request chain or create a material request first
      let materialIdForVariant: string | null = null;
      let materialRequestIdForVariant: string | null = null;

      if (mode === 'existing_material' && selectedMaterialId) {
        materialIdForVariant = selectedMaterialId;
      } else {
        const { data: materialReqData, error: materialReqError } = await db.query
          .from('material_requests')
          .insert({
            name: materialName.trim(),
            description: materialDescription.trim() || null,
            unit_id: selectedUnit,
            requested_by: requestedBy,
            requested_at: requestedAt,
            order_package_context: orderPackageId,
          })
          .select()
          .single();

        if (materialReqError) throw materialReqError;
        materialRequestIdForVariant = materialReqData.id;
      }

      // Create pending variant request
      const { data: variantRequestData, error: variantRequestError } = await db.query
        .from('material_variant_requests')
        .insert({
          material_id: materialIdForVariant,
          material_request_id: materialRequestIdForVariant,
          variant_name: variantName.trim(),
          description: variantDescription.trim() || null,
          attributes: Object.keys(attributesObj).length > 0 ? attributesObj : null,
          unit_id: selectedUnit,
          length: length ? parseFloat(length) : null,
          width: width ? parseFloat(width) : null,
          thickness: thickness ? parseFloat(thickness) : null,
          weight_per_unit: weightPerUnit ? parseFloat(weightPerUnit) : null,
          requested_by: requestedBy,
          requested_at: requestedAt,
          order_package_context: orderPackageId,
        })
        .select()
        .single();

      if (variantRequestError) throw variantRequestError;

      // Create pending supplier pricing request linked to pending variant
      const { error: pricingError } = await db.query
        .from('supplier_pricing_requests')
        .insert({
          material_variant_id: null,
          variant_request_id: variantRequestData.id,
          supplier_id: selectedSupplier,
          price: parseFloat(price),
          price_per_unit: pricePerUnit ? parseFloat(pricePerUnit) : parseFloat(price),
          supplier_quantity: supplierQuantity ? parseFloat(supplierQuantity) : 1,
          suppliers_reference: suppliersReference.trim() || null,
          requested_by: requestedBy,
          requested_at: requestedAt,
          order_package_context: orderPackageId,
        });
      
      if (pricingError) throw pricingError;
      
      Alert.alert(
        'Success', 
        'Material request submitted. You can use it right away — an admin will review and approve it in the catalogue later.',
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess({
                id: variantRequestData.id,
                isPending: true,
                label: variantRequestData.variant_name || variantName.trim(),
                unitId: variantRequestData.unit_id || selectedUnit,
              });
              resetForm();
              onClose();
            }
          }
        ]
      );
      
    } catch (error: any) {
      console.error('Error saving pending material:', error);
      Alert.alert('Error', error.message || 'Failed to add material');
    } finally {
      setSaving(false);
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
      const { data, error } = await db.query
        .from('tags')
        .insert({ name })
        .select()
        .single();
      
      if (error) throw error;
      
      setAvailableTags(prev => [...prev, data]);
      setSelectedTags(prev => [...prev, data.id]);
      setNewTagName('');
    } catch (e) {
      Alert.alert('Error', 'Failed to create tag');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-3xl h-5/6">
          <ScrollView className="flex-1">
            <View className="p-6">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className="text-2xl font-bold text-gray-900">Add New Material</Text>
                  <Text className="text-sm text-gray-600 mt-1">
                    Pending admin approval • Usable immediately
                  </Text>
                  {autoTag && (
                    <View className="mt-2 flex-row items-center">
                      <View className="px-2 py-1 rounded bg-blue-100 border border-blue-300">
                        <Text className="text-xs text-blue-800 font-medium">{autoTag}</Text>
                      </View>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-gray-100">
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {/* Mode Selector */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Material</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setMode('existing_material')}
                    className={`flex-1 py-2 rounded-lg border ${
                      mode === 'existing_material'
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-gray-50 border-gray-300'
                    }`}
                  >
                    <Text className={`text-center text-sm font-medium ${
                      mode === 'existing_material' ? 'text-blue-700' : 'text-gray-600'
                    }`}>
                      Use Existing
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setMode('new_material')}
                    className={`flex-1 py-2 rounded-lg border ${
                      mode === 'new_material'
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-gray-50 border-gray-300'
                    }`}
                  >
                    <Text className={`text-center text-sm font-medium ${
                      mode === 'new_material' ? 'text-blue-700' : 'text-gray-600'
                    }`}>
                      Create New
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {mode === 'existing_material' ? (
                /* Select Existing Material */
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-2">Select Material *</Text>
                  <TouchableOpacity
                    onPress={() => setMaterialPickerOpen(v => !v)}
                    className="border border-gray-300 rounded-lg px-4 py-3 flex-row items-center justify-between"
                  >
                    <Text className="text-gray-900">
                      {selectedMaterialId 
                        ? existingMaterials.find(m => m.id === selectedMaterialId)?.name 
                        : 'Select material'}
                    </Text>
                    <ChevronDown size={16} color="#6b7280" />
                  </TouchableOpacity>
                  {errors.material && <Text className="text-xs text-red-600 mt-1">{errors.material}</Text>}
                  
                  {materialPickerOpen && (
                    <View className="mt-2 bg-white border border-gray-300 rounded-lg max-h-60">
                      <View className="p-2 border-b border-gray-200">
                        <TextInput
                          value={materialSearchQuery}
                          onChangeText={setMaterialSearchQuery}
                          placeholder="Type to filter materials..."
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                          autoFocus
                        />
                      </View>
                      <ScrollView>
                        {existingMaterials
                          .filter(m => !materialSearchQuery.trim() || m.name.toLowerCase().includes(materialSearchQuery.toLowerCase()))
                          .map((m) => (
                            <TouchableOpacity
                              key={m.id}
                              onPress={() => { 
                                setSelectedMaterialId(m.id);
                                setSelectedUnit(m.unit_id);
                                setMaterialPickerOpen(false);
                                setErrors((e: any) => ({ ...e, material: undefined, unit: undefined }));
                              }}
                              className="p-3 border-b border-gray-100"
                            >
                              <Text className="text-sm text-gray-900">{m.name}</Text>
                              {m.description && (
                                <Text className="text-xs text-gray-500 mt-1">{m.description}</Text>
                              )}
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              ) : (
                /* Create New Material */
                <>
                  <View className="mb-4">
                    <Text className="text-sm font-medium text-gray-700 mb-2">Material Name *</Text>
                    <TextInput
                      value={materialName}
                      onChangeText={(text) => { setMaterialName(text); setErrors((e: any) => ({ ...e, materialName: undefined })); }}
                      placeholder="e.g., Plywood"
                      className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                    />
                    {errors.materialName && <Text className="text-xs text-red-600 mt-1">{errors.materialName}</Text>}
                  </View>

                  <View className="mb-4">
                    <Text className="text-sm font-medium text-gray-700 mb-2">Material Description</Text>
                    <TextInput
                      value={materialDescription}
                      onChangeText={setMaterialDescription}
                      placeholder="Optional description"
                      multiline
                      numberOfLines={2}
                      className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                    />
                  </View>
                </>
              )}

              {/* Variant Name */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Variant Name *</Text>
                <TextInput
                  value={variantName}
                  onChangeText={(text) => { setVariantName(text); setErrors((e: any) => ({ ...e, variantName: undefined })); }}
                  placeholder="e.g., Plywood 12mm Marine"
                  className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                />
                {errors.variantName && <Text className="text-xs text-red-600 mt-1">{errors.variantName}</Text>}
              </View>

              {/* Variant Description */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Variant Description</Text>
                <TextInput
                  value={variantDescription}
                  onChangeText={setVariantDescription}
                  placeholder="Optional description"
                  multiline
                  numberOfLines={2}
                  className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                />
              </View>

              {/* Unit Selector */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Unit *</Text>
                <TouchableOpacity
                  onPress={() => setUnitPickerOpen(v => !v)}
                  className="border border-gray-300 rounded-lg px-4 py-3 flex-row items-center justify-between"
                >
                  <Text className="text-gray-900">
                    {selectedUnit ? units.find(u => u.id === selectedUnit)?.name : 'Select unit'}
                  </Text>
                  <ChevronDown size={16} color="#6b7280" />
                </TouchableOpacity>
                {errors.unit && <Text className="text-xs text-red-600 mt-1">{errors.unit}</Text>}
                
                {unitPickerOpen && (
                  <View className="mt-2 bg-white border border-gray-300 rounded-lg max-h-60">
                    <View className="p-2 border-b border-gray-200">
                      <TextInput
                        value={unitSearchQuery}
                        onChangeText={setUnitSearchQuery}
                        placeholder="Type to filter units..."
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                        autoFocus
                      />
                    </View>
                    <ScrollView>
                      {units
                        .filter(u => !unitSearchQuery.trim() || u.name.toLowerCase().includes(unitSearchQuery.toLowerCase()))
                        .map((u) => (
                          <TouchableOpacity
                            key={u.id}
                            onPress={() => { 
                              setSelectedUnit(u.id); 
                              setUnitPickerOpen(false); 
                              setErrors((e: any) => ({ ...e, unit: undefined }));
                            }}
                            className="p-3 border-b border-gray-100"
                          >
                            <Text className="text-sm text-gray-900">{u.name}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Dimensions */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Dimensions</Text>
                <View className="flex-row space-x-2 mb-2">
                  <View className="flex-1">
                    <Text className="text-xs text-gray-600 mb-1">Length</Text>
                    <TextInput
                      value={length}
                      onChangeText={setLength}
                      placeholder="Length"
                      keyboardType="decimal-pad"
                      className="border border-gray-300 rounded-lg px-2 py-2 text-gray-900"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => widthInputRef.current?.focus()}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-600 mb-1">Width</Text>
                    <TextInput
                      ref={widthInputRef}
                      value={width}
                      onChangeText={setWidth}
                      placeholder="Width"
                      keyboardType="decimal-pad"
                      className="border border-gray-300 rounded-lg px-2 py-2 text-gray-900"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => thicknessInputRef.current?.focus()}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-600 mb-1">Thickness</Text>
                    <TextInput
                      ref={thicknessInputRef}
                      value={thickness}
                      onChangeText={setThickness}
                      placeholder="Thickness"
                      keyboardType="decimal-pad"
                      className="border border-gray-300 rounded-lg px-2 py-2 text-gray-900"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => weightInputRef.current?.focus()}
                    />
                  </View>
                </View>
                <View>
                  <Text className="text-xs text-gray-600 mb-1">Weight Per Unit</Text>
                  <TextInput
                    ref={weightInputRef}
                    value={weightPerUnit}
                    onChangeText={setWeightPerUnit}
                    placeholder="Weight per unit"
                    keyboardType="decimal-pad"
                    className="border border-gray-300 rounded-lg px-2 py-2 text-gray-900"
                    returnKeyType="done"
                  />
                </View>
              </View>

              {/* Attributes */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-medium text-gray-700">Attributes</Text>
                  <TouchableOpacity
                    onPress={addAttribute}
                    className="bg-blue-50 px-2 py-1 rounded-lg flex-row items-center"
                  >
                    <Plus size={14} color="#3b82f6" />
                    <Text className="ml-1 text-blue-600 text-xs font-medium">Add</Text>
                  </TouchableOpacity>
                </View>
                
                {attributes.map((attr, index) => (
                  <View key={index} className="flex-row mb-2 space-x-1">
                    <View className="flex-1">
                      <TextInput
                        value={attr.key}
                        onChangeText={(text) => updateAttribute(index, 'key', text)}
                        placeholder="Property"
                        className="border border-gray-300 rounded-lg px-2 py-2 text-gray-900"
                      />
                    </View>
                    <View className="flex-1">
                      <TextInput
                        value={attr.value}
                        onChangeText={(text) => updateAttribute(index, 'value', text)}
                        placeholder="Value"
                        className="border border-gray-300 rounded-lg px-2 py-2 text-gray-900"
                      />
                    </View>
                    {attributes.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeAttribute(index)}
                        className="bg-red-50 p-2 rounded-lg justify-center"
                      >
                        <Minus size={14} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Tags */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-medium text-gray-700">Tags</Text>
                  <Text className="text-xs text-gray-500">({selectedTags.length} selected)</Text>
                </View>
                
                {/* Quick add tag */}
                <View className="mb-2 flex-row items-center">
                  <TextInput
                    value={newTagName}
                    onChangeText={setNewTagName}
                    placeholder="New tag name"
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-gray-900"
                  />
                  <TouchableOpacity
                    onPress={handleAddTag}
                    className="ml-2 bg-green-50 px-3 py-2 rounded-lg"
                  >
                    <Text className="text-green-600 font-medium text-sm">Add</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Available tags */}
                <View className="flex-row flex-wrap">
                  {availableTags.map((tag) => (
                    <TouchableOpacity
                      key={tag.id}
                      onPress={() => toggleTag(tag.id)}
                      className={`px-2 py-1 rounded-lg mr-2 mb-2 border ${
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
                </View>
              </View>

              {/* Supplier */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Supplier *</Text>
                <TouchableOpacity
                  onPress={() => setSupplierPickerOpen(v => !v)}
                  className="border border-gray-300 rounded-lg px-4 py-3 flex-row items-center justify-between"
                >
                  <Text className="text-gray-900">
                    {selectedSupplier ? suppliers.find(s => s.id === selectedSupplier)?.name : 'Select supplier'}
                  </Text>
                  <ChevronDown size={16} color="#6b7280" />
                </TouchableOpacity>
                {errors.supplier && <Text className="text-xs text-red-600 mt-1">{errors.supplier}</Text>}
                
                {supplierPickerOpen && (
                  <View className="mt-2 bg-white border border-gray-300 rounded-lg max-h-60">
                    <View className="p-2 border-b border-gray-200">
                      <TextInput
                        value={supplierSearchQuery}
                        onChangeText={setSupplierSearchQuery}
                        placeholder="Type to filter suppliers..."
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                        autoFocus
                      />
                    </View>
                    <ScrollView>
                      {suppliers
                        .filter(s => !supplierSearchQuery.trim() || s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()))
                        .map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            onPress={() => { 
                              setSelectedSupplier(s.id); 
                              setSupplierPickerOpen(false); 
                              setErrors((e: any) => ({ ...e, supplier: undefined }));
                            }}
                            className="p-3 border-b border-gray-100"
                          >
                            <Text className="text-sm text-gray-900">{s.name}</Text>
                            {s.contact_person && (
                              <Text className="text-xs text-gray-500">{s.contact_person}</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {/* Create New Supplier Button */}
                    <View className="p-2 border-t border-gray-300">
                      <TouchableOpacity
                        onPress={() => {
                          setSupplierPickerOpen(false);
                          setShowNewSupplierForm(true);
                        }}
                        className="bg-green-50 border border-green-500 rounded px-3 py-2"
                      >
                        <Text className="text-green-700 text-center font-medium text-sm">
                          + Create New Supplier
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* New Supplier Form Modal */}
              {showNewSupplierForm && (
                <View className="mb-4 p-4 border border-green-300 rounded-lg bg-green-50">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-sm font-semibold text-gray-900">Create New Supplier</Text>
                    <TouchableOpacity onPress={() => setShowNewSupplierForm(false)}>
                      <X size={18} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                  
                  <View className="mb-2">
                    <Text className="text-xs font-medium text-gray-700 mb-1">Supplier Name *</Text>
                    <TextInput
                      value={newSupplierName}
                      onChangeText={setNewSupplierName}
                      placeholder="Enter supplier name"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                    />
                  </View>
                  
                  <View className="mb-2">
                    <Text className="text-xs font-medium text-gray-700 mb-1">Contact Person</Text>
                    <TextInput
                      value={newSupplierContact}
                      onChangeText={setNewSupplierContact}
                      placeholder="Optional"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                    />
                  </View>
                  
                  <View className="mb-3">
                    <Text className="text-xs font-medium text-gray-700 mb-1">Phone</Text>
                    <TextInput
                      value={newSupplierPhone}
                      onChangeText={setNewSupplierPhone}
                      placeholder="Optional"
                      keyboardType="phone-pad"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
                    />
                  </View>
                  
                  <TouchableOpacity
                    onPress={async () => {
                      if (!newSupplierName.trim()) {
                        Alert.alert('Error', 'Supplier name is required');
                        return;
                      }
                      try {
                        const { data, error } = await db.query
                          .from('suppliers')
                          .insert({
                            name: newSupplierName.trim(),
                            contact_person: newSupplierContact.trim() || null,
                            phone: newSupplierPhone.trim() || null,
                          })
                          .select()
                          .single();
                        
                        if (error) throw error;
                        
                        // Add to suppliers list and select it
                        setSuppliers(prev => [...prev, data]);
                        setSelectedSupplier(data.id);
                        setShowNewSupplierForm(false);
                        setNewSupplierName('');
                        setNewSupplierContact('');
                        setNewSupplierPhone('');
                        setErrors((e: any) => ({ ...e, supplier: undefined }));
                        Alert.alert('Success', 'Supplier created successfully');
                      } catch (error: any) {
                        Alert.alert('Error', error.message || 'Failed to create supplier');
                      }
                    }}
                    className="bg-green-600 py-2 rounded-lg"
                  >
                    <Text className="text-white text-center font-medium text-sm">Create Supplier</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Price */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Price (AED) *</Text>
                <TextInput
                  value={price}
                  onChangeText={(text) => { setPrice(text); setErrors((e: any) => ({ ...e, price: undefined })); }}
                  placeholder="Enter total price"
                  keyboardType="decimal-pad"
                  className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                />
                {errors.price && <Text className="text-xs text-red-600 mt-1">{errors.price}</Text>}
              </View>

              {/* Price Per Unit */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Price Per Unit</Text>
                <TextInput
                  value={pricePerUnit}
                  onChangeText={setPricePerUnit}
                  placeholder="Optional (defaults to total price)"
                  keyboardType="decimal-pad"
                  className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                />
              </View>

              {/* Supplier Quantity */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Supplier Quantity</Text>
                <TextInput
                  value={supplierQuantity}
                  onChangeText={setSupplierQuantity}
                  placeholder="Optional (defaults to 1)"
                  keyboardType="decimal-pad"
                  className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                />
                <Text className="text-xs text-gray-500 mt-1">The amount provided by supplier in one order</Text>
              </View>

              {/* Supplier Reference */}
              <View className="mb-6">
                <Text className="text-sm font-medium text-gray-700 mb-2">Supplier Reference</Text>
                <TextInput
                  value={suppliersReference}
                  onChangeText={setSuppliersReference}
                  placeholder="Optional supplier reference number"
                  className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                />
              </View>

              {/* Action Buttons */}
              <View className="flex-row space-x-3 mb-6">
                <TouchableOpacity
                  onPress={() => { resetForm(); onClose(); }}
                  className="flex-1 bg-gray-100 py-3 rounded-lg"
                >
                  <Text className="text-center text-gray-700 font-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  className="flex-1 bg-blue-500 py-3 rounded-lg"
                  disabled={saving}
                >
                  <Text className="text-center text-white font-medium">
                    {saving ? 'Adding...' : 'Add Material'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
