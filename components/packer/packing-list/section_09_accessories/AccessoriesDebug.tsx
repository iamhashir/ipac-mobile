/**
 * AccessoriesDebug Component
 * 
 * This is a temporary debug component to help diagnose accessories dropdown issues.
 * Add this to your packer portal to see what data is being loaded.
 * 
 * Usage:
 * Import and add to your page:
 * import AccessoriesDebug from '../../components/packer/packing-list/section_09_accessories/AccessoriesDebug';
 * 
 * Then in your JSX:
 * {__DEV__ && <AccessoriesDebug />}
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { db } from '../../../../utils/api/supabase';
import { RefreshCw } from 'lucide-react-native';

export default function AccessoriesDebug() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [
        { data: variants },
        { data: units },
        { data: materials },
        { data: tags },
      ] = await Promise.all([
        db.getMaterialVariantsByTag('accessories'),
        db.getAllUnits(),
        db.getAllMaterials(),
        // Try to get tags - this might fail if no direct method exists
        { data: null, error: null },
      ] as any);

      setData({
        variants: variants || [],
        units: units || [],
        materials: materials || [],
        tags: tags || [],
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to load debug data: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const StatusBadge = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
    <View className={`px-2 py-1 rounded ${ok ? 'bg-green-100' : 'bg-red-100'}`}>
      <Text className={`text-xs font-medium ${ok ? 'text-green-800' : 'text-red-800'}`}>
        {ok ? '✓' : '✗'} {children}
      </Text>
    </View>
  );

  if (!data) {
    return (
      <View className="m-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
        <Text className="text-yellow-800 font-semibold mb-2">🔍 Accessories Debug</Text>
        <Text className="text-yellow-700 text-sm">Loading debug information...</Text>
      </View>
    );
  }

  const hasVariants = data.variants.length > 0;
  const hasUnits = data.units.length > 0;
  const hasMaterials = data.materials.length > 0;

  return (
    <View className="m-4 p-4 bg-white border border-gray-300 rounded-lg">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-gray-900 font-bold text-lg">🔍 Accessories Debug</Text>
        <TouchableOpacity
          onPress={load}
          disabled={loading}
          className="px-3 py-1.5 bg-blue-50 border border-blue-300 rounded flex-row items-center"
        >
          <RefreshCw size={14} color="#2563eb" />
          <Text className="text-blue-700 text-xs ml-1 font-medium">
            {loading ? 'Loading...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Overview */}
      <View className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
        <Text className="text-xs font-semibold text-gray-700 mb-2">Status</Text>
        <View className="flex-row flex-wrap gap-2">
          <StatusBadge ok={hasVariants}>
            {data.variants.length} Accessory Variants
          </StatusBadge>
          <StatusBadge ok={hasUnits}>
            {data.units.length} Units
          </StatusBadge>
          <StatusBadge ok={hasMaterials}>
            {data.materials.length} Total Materials
          </StatusBadge>
        </View>
      </View>

      {/* Issues */}
      {!hasVariants && (
        <View className="mb-3 p-3 bg-red-50 rounded border border-red-200">
          <Text className="text-red-800 font-semibold text-sm mb-1">❌ No Accessories Found</Text>
          <Text className="text-red-700 text-xs mb-2">
            The dropdown will be empty because no materials are tagged with "accessories".
          </Text>
          <Text className="text-red-700 text-xs font-semibold">Fix:</Text>
          <Text className="text-red-700 text-xs">
            1. Go to Admin → Inventory Management{'\n'}
            2. Create a tag called "accessories"{'\n'}
            3. Tag materials with "accessories"{'\n'}
            4. Make sure materials have variants created
          </Text>
        </View>
      )}

      {/* Variants List */}
      {hasVariants && (
        <View className="mb-3">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Accessory Variants ({data.variants.length})
          </Text>
          <ScrollView className="max-h-48 border border-gray-200 rounded bg-gray-50 p-2">
            {data.variants.map((v: any, i: number) => (
              <View key={i} className="mb-2 p-2 bg-white rounded border border-gray-200">
                <Text className="text-xs font-semibold text-gray-900">{v.label}</Text>
                <View className="flex-row mt-1 gap-2">
                  <Text className="text-[10px] text-gray-600">ID: {v.id?.substring(0, 8)}...</Text>
                  {v.unit_name && (
                    <Text className="text-[10px] text-gray-600">Unit: {v.unit_name}</Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Units List */}
      {hasUnits && (
        <View className="mb-3">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Units ({data.units.length})
          </Text>
          <View className="border border-gray-200 rounded bg-gray-50 p-2">
            <View className="flex-row flex-wrap gap-1">
              {data.units.slice(0, 10).map((u: any, i: number) => (
                <View key={i} className="px-2 py-1 bg-white rounded border border-gray-200">
                  <Text className="text-[10px] text-gray-700">{u.name || u.label}</Text>
                </View>
              ))}
              {data.units.length > 10 && (
                <View className="px-2 py-1 bg-gray-100 rounded">
                  <Text className="text-[10px] text-gray-500">
                    +{data.units.length - 10} more
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Timestamp */}
      <Text className="text-[10px] text-gray-400 text-center mt-2">
        Last updated: {new Date(data.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );
}
