import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Package } from 'lucide-react-native';
import { MaterialCard } from '../../../inventory/InventoryComponents';
import { Material, Supplier, UnitOfMeasure, Tag } from '../../../../utils/api/inventory';

interface MaterialsTabProps {
  filteredMaterials: Material[];
  suppliers: Supplier[];
  units: UnitOfMeasure[];
  tags: Tag[];
  selectedTagFilter: string;
  searchQuery: string;
  loading: boolean;
  onEditMaterial: (material: Material) => void;
  onDeleteMaterial: (material: Material) => void;
  onManageVariants: (material: Material) => void;
  onClearFilters: () => void;
}

export function MaterialsTab({
  filteredMaterials,
  suppliers,
  units,
  tags,
  selectedTagFilter,
  searchQuery,
  loading,
  onEditMaterial,
  onDeleteMaterial,
  onManageVariants,
  onClearFilters,
}: MaterialsTabProps) {
  return (
    <ScrollView className="flex-1 px-6 py-4">
      {/* Materials List */}
      {filteredMaterials.map((material) => (
        <MaterialCard
          key={material.id}
          material={material}
          suppliers={suppliers}
          units={units}
          onEdit={onEditMaterial}
          onDelete={onDeleteMaterial}
          onManageVariants={onManageVariants}
        />
      ))}

      {/* Results info */}
      {filteredMaterials.length > 0 && (
        <View className="bg-white rounded-lg p-3 mb-4 flex-row items-center justify-between">
          <Text className="text-sm font-medium text-gray-700">
            {filteredMaterials.length} material
            {filteredMaterials.length !== 1 ? "s" : ""} found
            {selectedTagFilter !== "all" && (
              <Text className="text-purple-600">
                {" "}
                in "{tags.find((t) => t.id === selectedTagFilter)?.name}"
              </Text>
            )}
          </Text>
          {selectedTagFilter !== "all" && (
            <TouchableOpacity
              onPress={() => onClearFilters()}
              className="bg-gray-100 px-3 py-1 rounded-lg"
            >
              <Text className="text-xs text-gray-600">Clear filter</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {filteredMaterials.length === 0 && !loading && (
        <View className="bg-white rounded-lg p-8 text-center">
          <Package size={48} color="#9ca3af" />
          <Text className="text-gray-500 text-lg mt-4">
            No materials found
          </Text>
          <Text className="text-gray-400 text-sm mt-2">
            {searchQuery || selectedTagFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Add your first material to get started"}
          </Text>
          {(searchQuery || selectedTagFilter !== "all") && (
            <TouchableOpacity
              onPress={onClearFilters}
              className="bg-blue-50 px-4 py-2 rounded-lg mt-3"
            >
              <Text className="text-blue-600 font-medium">
                Clear all filters
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}