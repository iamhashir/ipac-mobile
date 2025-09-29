import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Edit3, Package, Trash2, Plus } from "lucide-react-native";
import { Supplier } from "../../../../utils/api/inventory";
import { supplierOperations } from "../../../../utils/api/inventory";
import { ConfirmModal } from "../../../ui/ConfirmModal";

export interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onViewProducts?: (supplier: Supplier) => void;
  onAddProducts?: (supplier: Supplier) => void;
}

export default function SupplierCard({
  supplier,
  onEdit,
  onDelete,
  onViewProducts,
  onAddProducts,
}: SupplierCardProps) {
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    loadProductOverview();
  }, [supplier]);

  const loadProductOverview = async () => {
    setLoading(true);
    try {
      const { data } = await supplierOperations.getSupplierVariants(
        supplier.id
      );
      if (data) {
        setProductCount(data.length);
        setTopProducts(data.slice(0, data.length));
        // setTopProducts(data.slice(0, 3));
      }
    } catch (_) {
      // noop
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      {/* Top-right delete button */}
      <View className="absolute right-3 top-3 z-10">
        <TouchableOpacity
          className="bg-red-50 p-2 rounded-lg border border-red-300"
          onPress={() => setConfirmDelete(true)}
        >
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
      <View className="flex-row justify-between items-start">
        {/* Left: Supplier details */}
        <View className="flex-1 pr-3 flex-col justify-between h-full">
          <Text className="text-lg font-semibold text-gray-900">
            {supplier.name}
          </Text>
          {supplier.contact_person ? (
            <Text className="text-sm text-gray-600 mt-1">
              Contact: {supplier.contact_person}
            </Text>
          ) : null}
          {supplier.email ? (
            <Text className="text-sm text-gray-600 mt-1">
              Email: {supplier.email}
            </Text>
          ) : null}
          {supplier.phone ? (
            <Text className="text-sm text-gray-600 mt-1">
              Phone: {supplier.phone}
            </Text>
          ) : null}
          {supplier.address ? (
            <Text className="text-sm text-gray-600 mt-1">
              {supplier.address}
            </Text>
          ) : null}

          {/* Edit button in left section */}
          <View className="flex-row mt-3 border-t border-gray-200 pt-3">
            <TouchableOpacity
              className="flex-1 bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center border border-blue-300"
              onPress={() => onEdit(supplier)}
            >
              <Edit3 size={16} color="#3b82f6" />
              <Text className="ml-2 text-blue-600 font-medium">Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right: Product summary and actions */}
        <View className="w-1/2 pl-3 border-l border-gray-200 flex-col justify-between h-full">
          <View className="flex-row items-center justify-between m-2">
            <Text className="text-sm font-medium text-gray-700">
              Products: {loading ? "…" : productCount}
            </Text>
            {/* {productCount > 3 ? (
              <Text className="text-xs text-blue-600">
                +{productCount - 3} more
              </Text>
            ) : null} */}
          </View>

          {topProducts.length > 0 ? (
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {topProducts.map((item, index) => (
                <View key={index} className="flex-row items-center mb-1 ps-2 me-1">
                  <View className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
                  <Text className="text-xs text-gray-600 flex-1" numberOfLines={1}>
                    {item.material_variants?.materials?.name} - {item.material_variants?.variant_name}
                  </Text>
                  <Text className="text-xs text-green-600 font-medium ml-2">{`AED ${item.price}`}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            !loading && (
              <Text className="text-xs text-gray-500 italic">
                No products added yet
              </Text>
            )
          )}

          {/* Bottom action bar */}
          <View className="flex-row mt-4 pt-3 border-t border-gray-200">
            {onViewProducts ? (
              <TouchableOpacity
                className="flex-1 bg-green-50 py-2 px-3 rounded-lg flex-row items-center justify-center mr-2 border border-green-300"
                onPress={() => onViewProducts(supplier)}
              >
                <Package size={16} color="#10b981" />
                <Text className="ml-2 text-green-600 font-medium">
                  View Products
                </Text>
              </TouchableOpacity>
            ) : null}

            {onAddProducts ? (
              <TouchableOpacity
                className="flex-1 bg-blue-50 py-2 px-3 rounded-lg flex-row items-center justify-center border border-blue-300"
                onPress={() => onAddProducts(supplier)}
              >
                <Plus size={16} color="#3b82f6" />
                <Text className="ml-2 text-blue-600 font-medium">
                  Add Products
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {/* Confirm delete supplier */}
      <ConfirmModal
        visible={confirmDelete}
        title="Delete Supplier"
        description={`Are you sure you want to delete "${supplier.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete(supplier);
        }}
      />
    </View>
  );
}
