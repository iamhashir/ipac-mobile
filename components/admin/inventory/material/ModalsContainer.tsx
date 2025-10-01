import React from 'react';
import { View, Text, Modal, SafeAreaView, TouchableOpacity, TextInput } from 'react-native';
import { X, Save } from 'lucide-react-native';
import { MaterialForm, VariantManagement } from '../../../inventory/InventoryComponents';
import { SupplierForm } from '../../../inventory/InventoryForms';
import { SupplierProductsModal, AddSupplierProductModal } from '../../inventory/supplier';
import { ConfirmModal } from '../../../ui/ConfirmModal';
import { Material, Supplier, UnitOfMeasure, Tag } from '../../../../utils/api/inventory';

interface ModalsContainerProps {
  // Modal visibility states
  showMaterialForm: boolean;
  showSupplierForm: boolean;
  showVariantManagement: boolean;
  showSupplierProducts: boolean;
  showAddSupplierProduct: boolean;
  showPriceAlerts: boolean;
  showUnitModal: boolean;
  confirmDelete: {
    visible: boolean;
    material: Material | null;
    loading: boolean;
  };

  // Selected items
  selectedMaterial: Material | null;
  selectedSupplier: Supplier | null;

  // Data arrays
  materials: Material[];
  suppliers: Supplier[];
  units: UnitOfMeasure[];
  tags: Tag[];

  // Form state
  newUnitName: string;
  newUnitDescription: string;
  savingUnit: boolean;
  priceSettings: {
    warning_days: number;
    alert_days: number;
    enabled: boolean;
  };
  loading: boolean;

  // Event handlers
  onCreateMaterial: (materialData: any) => void;
  onUpdateMaterial: (materialData: any) => void;
  onCreateSupplier: (supplierData: any) => void;
  onUpdateSupplier: (supplierData: any) => void;
  onCreateUnit: () => void;
  onSavePriceSettings: () => void;
  onConfirmDeleteMaterial: () => void;
  onUpdateData: () => void;

  // State setters
  setShowMaterialForm: (show: boolean) => void;
  setSelectedMaterial: (material: Material | null) => void;
  setShowSupplierForm: (show: boolean) => void;
  setSelectedSupplier: (supplier: Supplier | null) => void;
  setShowVariantManagement: (show: boolean) => void;
  setShowSupplierProducts: (show: boolean) => void;
  setShowAddSupplierProduct: (show: boolean) => void;
  setShowPriceAlerts: (show: boolean) => void;
  setShowUnitModal: (show: boolean) => void;
  setNewUnitName: (name: string) => void;
  setNewUnitDescription: (description: string) => void;
  setPriceSettings: (settings: any) => void;
  setConfirmDelete: (state: any) => void;
}

export function ModalsContainer({
  // Modal visibility states
  showMaterialForm,
  showSupplierForm,
  showVariantManagement,
  showSupplierProducts,
  showAddSupplierProduct,
  showPriceAlerts,
  showUnitModal,
  confirmDelete,

  // Selected items
  selectedMaterial,
  selectedSupplier,

  // Data arrays
  materials,
  suppliers,
  units,
  tags,

  // Form state
  newUnitName,
  newUnitDescription,
  savingUnit,
  priceSettings,
  loading,

  // Event handlers
  onCreateMaterial,
  onUpdateMaterial,
  onCreateSupplier,
  onUpdateSupplier,
  onCreateUnit,
  onSavePriceSettings,
  onConfirmDeleteMaterial,
  onUpdateData,

  // State setters
  setShowMaterialForm,
  setSelectedMaterial,
  setShowSupplierForm,
  setSelectedSupplier,
  setShowVariantManagement,
  setShowSupplierProducts,
  setShowAddSupplierProduct,
  setShowPriceAlerts,
  setShowUnitModal,
  setNewUnitName,
  setNewUnitDescription,
  setPriceSettings,
  setConfirmDelete,
}: ModalsContainerProps) {
  return (
    <>
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
            onSave={selectedMaterial ? onUpdateMaterial : onCreateMaterial}
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
            onSave={selectedSupplier ? onUpdateSupplier : onCreateSupplier}
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
          onUpdate={() => onUpdateData()}
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
            onUpdateData();
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
                    setPriceSettings((prev: any) => ({
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
                    setPriceSettings((prev: any) => ({ ...prev, alert_days: num }));
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
                setPriceSettings((prev: any) => ({
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
                onPress={onSavePriceSettings}
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
                onPress={onCreateUnit}
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
        onConfirm={onConfirmDeleteMaterial}
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
    </>
  );
}