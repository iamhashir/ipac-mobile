import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Package, X, Edit3, Trash2 } from 'lucide-react-native';
import { Supplier, Material, UnitOfMeasure, MaterialVariant } from '../../../../utils/api/inventory';
import { supplierOperations, pricingOperations } from '../../../../utils/api/inventory';
import { ConfirmModal } from '../../../ui/ConfirmModal';
import { SupplierPricingForm } from '../../../inventory/InventoryForms';

export interface SupplierProductsModalProps {
  visible: boolean;
  supplier: Supplier;
  allUnits: UnitOfMeasure[];
  onUpdate?: () => void;
  onClose: () => void;
}

export default function SupplierProductsModal({ visible, supplier, allUnits, onUpdate, onClose }: SupplierProductsModalProps) {
const [supplierVariants, setSupplierVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editPricing, setEditPricing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; pricing: any | null }>({ visible: false, pricing: null });

  useEffect(() => {
    if (visible) loadSupplierVariants();
  }, [visible, supplier.id]);

  const loadSupplierVariants = async () => {
    setLoading(true);
    try {
      const { data } = await supplierOperations.getSupplierVariants(supplier.id);
      setSupplierVariants(data || []);
    } catch (_) {
      // noop
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED', minimumFractionDigits: 2 }).format(price);
    } catch {
      return `AED ${price?.toFixed?.(2) ?? price}`;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black bg-opacity-50 justify-center items-center p-4">
        <TouchableOpacity className="absolute inset-0" onPress={onClose} />
        <View className="bg-white rounded-2xl w-full max-w-5xl max-h-[85%] overflow-hidden">
          {/* Header */}
          <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
            <View>
              <Text className="text-xl font-bold text-gray-900">{supplier.name} Products</Text>
              <Text className="text-sm text-gray-600 mt-1">{supplierVariants.length} product{supplierVariants.length !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity className="bg-gray-100 p-2 rounded-lg" onPress={onClose}>
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView className="flex-1 p-4 z-0">
            {loading ? (
              <View className="flex-1 justify-center items-center py-8">
                <Text className="text-gray-600">Loading products...</Text>
              </View>
            ) : supplierVariants.length === 0 ? (
              <View className="flex-1 justify-center items-center py-8">
                <Package size={48} color="#d1d5db" />
                <Text className="text-gray-600 mt-4 text-center">No products found for this supplier.</Text>
              </View>
            ) : (
              <View>
{supplierVariants.map((item, index) => (
                  <View key={index} className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 pr-2">
                        <Text className="text-lg font-semibold text-gray-900">{item.material_variants?.materials?.name}</Text>
                        <Text className="text-base text-gray-700 mt-1">{item.material_variants?.variant_name}</Text>
                        {item.material_variants?.description ? (
                          <Text className="text-sm text-gray-600 mt-1">{item.material_variants.description}</Text>
                        ) : null}
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-bold text-green-600">{formatPrice(item.price)}</Text>
                        <Text className="text-sm text-gray-600">
                          per {(() => {
                            const unitName = item.units_of_measure?.name;
                            return unitName && unitName.trim() && unitName.trim() !== '.' ? unitName : 'unit';
                          })()}
                        </Text>
                        {item.stock_level !== null && (
                          <Text className="text-sm text-blue-600 mt-1">Stock: {item.stock_level}</Text>
                        )}
                        {/* Row action buttons */}
                        <View className="flex-row mt-2">
                          <TouchableOpacity
                            className="bg-blue-50 py-1 px-2 rounded-lg flex-row items-center justify-center mr-2"
                            onPress={() => setEditPricing(item)}
                          >
                            <Edit3 size={14} color="#3b82f6" />
                            <Text className="ml-1 text-blue-600 text-xs font-medium">Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            className="bg-red-50 py-1 px-2 rounded-lg flex-row items-center justify-center"
                            onPress={() => setConfirmDelete({ visible: true, pricing: item })}
                          >
                            <Trash2 size={14} color="#ef4444" />
                            <Text className="ml-1 text-red-600 text-xs font-medium">Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {item.material_variants?.attributes && (
                      <View className="border-t border-gray-200 pt-2 mt-2">
                        <Text className="text-sm text-gray-600">
                          {Object.entries(item.material_variants.attributes)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(' • ')}
                        </Text>
                      </View>
                    )}

                    {item.updated_at && (
                      <View className="flex-row items-center mt-2">
                        <Text className="text-xs text-gray-500">Last updated: {new Date(item.updated_at).toLocaleDateString()}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
</ScrollView>

          {/* Edit pricing modal (separate Modal to avoid clipping by parent overflow) */}
          <Modal visible={!!editPricing} transparent animationType="fade">
            <View className="flex-1" style={{ minHeight: 300 }}>
              <TouchableOpacity className="absolute inset-0 bg-black/50" onPress={() => setEditPricing(null)} />
              <View className="flex-1 justify-center items-center p-6">
                <View className="bg-white rounded-2xl w-full max-w-2xl">
                  {editPricing && (
                    <SupplierPricingForm
                      variant={editPricing.material_variants as MaterialVariant}
                      suppliers={[supplier]}
                      units={allUnits}
                      pricing={{ supplier_id: supplier.id, price: editPricing.price, unit_id: editPricing.units_of_measure?.id || editPricing.unit_id }}
                      defaultUnitId={(editPricing.material_variants as MaterialVariant)?.unit_id}
                      onSave={async (data: any) => {
                        try {
                          await pricingOperations.update(editPricing.id, {
                            price: data.price,
                            unit_id: data.unit_id,
                            supplier_id: supplier.id,
                          });
                          setEditPricing(null);
                          await loadSupplierVariants();
                          onUpdate && onUpdate();
                        } catch (e) {
                          // noop
                        }
                      }}
                      onCancel={() => setEditPricing(null)}
                    />
                  )}
                </View>
              </View>
            </View>
          </Modal>

          {/* Confirm delete pricing */}
          <ConfirmModal
            visible={confirmDelete.visible}
            title="Delete Supplier Pricing"
            description="Are you sure you want to delete this supplier pricing?"
            confirmText="Delete"
            cancelText="Cancel"
            variant="danger"
            onCancel={() => setConfirmDelete({ visible: false, pricing: null })}
            onConfirm={async () => {
              const current = confirmDelete.pricing;
              if (!current) return;
              try {
                await pricingOperations.delete(current.id);
                setConfirmDelete({ visible: false, pricing: null });
                await loadSupplierVariants();
                onUpdate && onUpdate();
              } catch (_) {
                setConfirmDelete({ visible: false, pricing: null });
              }
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
