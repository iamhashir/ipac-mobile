import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { SupplierCard } from '../../../admin/inventory/supplier';
import { Supplier } from '../../../../utils/api/inventory';

interface SuppliersTabProps {
  filteredSuppliers: Supplier[];
  searchQuery: string;
  loading: boolean;
  onEditSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplier: Supplier) => void;
  onViewProducts: (supplier: Supplier) => void;
  onAddProducts: (supplier: Supplier) => void;
}

export function SuppliersTab({
  filteredSuppliers,
  searchQuery,
  loading,
  onEditSupplier,
  onDeleteSupplier,
  onViewProducts,
  onAddProducts,
}: SuppliersTabProps) {
  return (
    <ScrollView className="flex-1 px-6 py-4">
      {/* Suppliers List */}
      {filteredSuppliers.map((supplier) => (
        <SupplierCard
          key={supplier.id}
          supplier={supplier}
          onEdit={onEditSupplier}
          onDelete={onDeleteSupplier}
          onViewProducts={onViewProducts}
          onAddProducts={onAddProducts}
        />
      ))}

      {filteredSuppliers.length === 0 && !loading && (
        <View className="bg-white rounded-lg p-8 text-center">
          <Building2 size={48} color="#9ca3af" />
          <Text className="text-gray-500 text-lg mt-4">
            No suppliers found
          </Text>
          <Text className="text-gray-400 text-sm mt-2">
            {searchQuery
              ? "Try adjusting your search"
              : "Add your first supplier to get started"}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}