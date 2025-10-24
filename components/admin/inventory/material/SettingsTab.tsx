import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Plus, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Material, Supplier, Tag, UnitOfMeasure } from '../../../../utils/api/inventory';

interface SettingsTabProps {
  materials: Material[];
  suppliers: Supplier[];
  tags: Tag[];
  units: UnitOfMeasure[];
  priceSettings: {
    warning_days: number;
    alert_days: number;
    enabled: boolean;
  };
  onShowUnitModal: () => void;
  onShowPriceAlerts: () => void;
  onRefreshData: () => void;
}

export function SettingsTab({
  materials,
  suppliers,
  tags,
  units,
  priceSettings,
  onShowUnitModal,
  onShowPriceAlerts,
  onRefreshData,
}: SettingsTabProps) {
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);

  return (
    <ScrollView className="flex-1 px-6 py-4">
      <View className="bg-white rounded-lg p-6">
        <Text className="text-xl font-bold text-gray-900 mb-6">
          Inventory Settings
        </Text>

        {/* System Statistics */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            System Overview
          </Text>
          <View className="grid grid-cols-2 gap-3">
            <View className="bg-blue-50 p-4 rounded-lg">
              <Text className="text-2xl font-bold text-blue-600">
                {materials.length}
              </Text>
              <Text className="text-sm text-blue-800">
                Total Materials
              </Text>
            </View>
            <View className="bg-green-50 p-4 rounded-lg">
              <Text className="text-2xl font-bold text-green-600">
                {materials.reduce(
                  (sum, m) => sum + (m.material_variants?.length || 0),
                  0
                )}
              </Text>
              <Text className="text-sm text-green-800">
                Total Variants
              </Text>
            </View>
            <View className="bg-orange-50 p-4 rounded-lg">
              <Text className="text-2xl font-bold text-orange-600">
                {suppliers.length}
              </Text>
              <Text className="text-sm text-orange-800">
                Total Suppliers
              </Text>
            </View>
            <View className="bg-purple-50 p-4 rounded-lg">
              <Text className="text-2xl font-bold text-purple-600">
                {tags.length}
              </Text>
              <Text className="text-sm text-purple-800">Total Tags</Text>
            </View>
          </View>
        </View>

        {/* Units of Measure */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-gray-900">
              Units of Measure ({units.length})
            </Text>
            <TouchableOpacity
              onPress={onShowUnitModal}
              className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
            >
              <Plus size={16} color="white" />
              <Text className="ml-1 text-white font-medium">
                Add Unit
              </Text>
            </TouchableOpacity>
          </View>
          <View className="bg-gray-50 p-4 rounded-lg">
            <View className="flex-row flex-wrap">
              {units.map((unit) => (
                <View key={unit.id} className="relative mr-2 mb-2">
                  <Pressable
                    onHoverIn={() => setHoveredUnitId(unit.id)}
                    onHoverOut={() => setHoveredUnitId(null)}
                    className="bg-white px-3 py-1 rounded-full border border-gray-200"
                  >
                    <Text className="text-sm text-gray-700">
                      {unit.name}
                    </Text>
                  </Pressable>
                  {hoveredUnitId === unit.id && !!unit.description && (
                    <View className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 bg-black px-2 py-1 rounded shadow-lg z-10">
                      <Text className="text-[10px] text-white max-w-xs">
                        {unit.description}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Price Alert Configuration */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Price Alert Configuration
          </Text>
          <TouchableOpacity
            onPress={onShowPriceAlerts}
            className="bg-yellow-50 p-4 rounded-lg flex-row items-center border border-yellow-200"
          >
            <AlertTriangle size={20} color="#f59e0b" />
            <View className="ml-3 flex-1">
              <Text className="text-yellow-800 font-medium">
                Configure Price Age Alerts
              </Text>
              <Text className="text-yellow-700 text-sm mt-1">
                Set thresholds for price age warnings
              </Text>
              <View className="flex-row mt-2">
                <View className="bg-yellow-100 px-2 py-1 rounded mr-2">
                  <Text className="text-xs text-yellow-800">
                    Warning: {priceSettings.warning_days}d
                  </Text>
                </View>
                <View className="bg-red-100 px-2 py-1 rounded">
                  <Text className="text-xs text-red-800">
                    Alert: {priceSettings.alert_days}d
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View className="space-y-3">
          <TouchableOpacity
            onPress={onRefreshData}
            className="bg-blue-50 p-4 rounded-lg flex-row items-center"
          >
            <RefreshCw size={20} color="#3b82f6" />
            <Text className="ml-3 text-blue-700 font-medium">
              Refresh All Data
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}