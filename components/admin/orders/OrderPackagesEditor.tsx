import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Plus, Package } from 'lucide-react-native';
import { db, supabase } from '../../../utils/api/supabase';
import PackageForm from './PackageForm';
import PackageItemsEditor from './PackageItemsEditor';
import OrderSecuringSection from '../../packing/OrderSecuringSection';
import { X } from 'lucide-react-native';

interface OrderPackagesEditorProps {
  orderId: string;
  onDone: () => void;
}

interface OrderPackageRow {
  id: string;
  order_id: string;
  package_number: number;
  description: string | null;
  status: string | null;
  original_pkg_info: string | null;
  final_pkg_info: string | null;
  created_at?: string;
}

const OrderPackagesEditor: React.FC<OrderPackagesEditorProps> = ({ orderId, onDone }) => {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<OrderPackageRow[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [activeItemsFor, setActiveItemsFor] = useState<{ id: string; number: number } | null>(null);
  const [activeSecuringFor, setActiveSecuringFor] = useState<{ id: string; number: number } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await db.getOrderPackages(orderId);
      if (error) throw error;
      const list = (data || []).sort((a: any, b: any) => (a.package_number || 0) - (b.package_number || 0));
      setPackages(list as any);
    } catch (e) {
      console.error('Failed to load order packages', e);
      Alert.alert('Error', 'Failed to load boxes for this order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [orderId]);

  const nextPackageNumber = useMemo(() => {
    if (!packages || packages.length === 0) return 1;
    return Math.max(...packages.map((p) => p.package_number || 0)) + 1;
  }, [packages]);

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-semibold text-gray-900">Boxes for this order</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => setShowAdd(true)} className="bg-blue-600 px-3 py-2 rounded-lg flex-row items-center">
            <Plus size={16} color="#fff" />
            <Text className="text-white font-medium ml-1">Add Box</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDone} className="bg-gray-100 px-3 py-2 rounded-lg">
            <Text className="text-gray-800 font-medium">Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center py-10">
          <ActivityIndicator />
          <Text className="text-gray-600 mt-2">Loading boxes...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1">
          {packages.length === 0 ? (
            <View className="bg-white rounded-lg border border-gray-200 p-6 items-center">
              <Package size={40} color="#9ca3af" />
              <Text className="text-gray-600 mt-3">No boxes yet. Click "Add Box" to create the first one.</Text>
            </View>
          ) : (
            <View className="space-y-3">
              {packages.map((p) => (
                <View key={p.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-base font-semibold text-gray-900">Box #{p.package_number}</Text>
                      {p.description ? (
                        <Text className="text-sm text-gray-600">{p.description}</Text>
                      ) : null}
                      <Text className="text-xs text-gray-500 mt-1">Status: {p.status || '—'}</Text>
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        className="bg-green-50 px-3 py-2 rounded-lg border border-green-200"
                        onPress={() => setActiveItemsFor({ id: p.id, number: p.package_number })}
                      >
                        <Text className="text-green-700 font-medium">Add Items</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="ml-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200"
                        onPress={async () => {
                          try {
                            await db.ensureFinalSecuringForPackage(p.id);
                          } catch (_) { /* noop */ }
                          setActiveSecuringFor({ id: p.id, number: p.package_number });
                        }}
                      >
                        <Text className="text-blue-700 font-medium">Securing</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Box Modal */}
      {showAdd && (
        <PackageForm
          orderId={orderId}
          nextPackageNumber={nextPackageNumber}
          onCancel={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await load();
          }}
        />
      )}

      {/* Items Editor */}
      {activeItemsFor && (
        <PackageItemsEditor
          orderPackageId={activeItemsFor.id}
          packageNumber={activeItemsFor.number}
          onClose={() => setActiveItemsFor(null)}
        />
      )}

      {/* Securing Editor */}
      {activeSecuringFor && (
        <View className="absolute inset-0 z-50">
          <TouchableOpacity className="absolute inset-0 bg-black bg-opacity-50" activeOpacity={1} onPress={() => setActiveSecuringFor(null)} />
          <View className="flex-1 justify-center items-center p-6">
            <View className="bg-white rounded-xl w-full" style={{ maxWidth: 1100, width: '90vw', maxHeight: '85vh' }}>
              <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                <Text className="text-lg font-bold text-gray-900">Securing for Box #{activeSecuringFor.number}</Text>
                <TouchableOpacity onPress={() => setActiveSecuringFor(null)} className="p-2">
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <ScrollView className="p-2">
                <OrderSecuringSection orderPackageId={activeSecuringFor.id} editTarget="original" editable={true} />
              </ScrollView>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default OrderPackagesEditor;
