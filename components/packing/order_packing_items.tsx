import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Camera } from 'lucide-react-native';
import { db } from '../../utils/api/supabase';

interface PackingItemRow {
  order_package_id: string;
  designation: string | null;
  quantity: number | null;
}

interface OrderPackingItemsProps {
  orderPackageId: string;
  onAttachPics?: (item: PackingItemRow) => void;
}

const OrderPackingItems: React.FC<OrderPackingItemsProps> = ({ orderPackageId, onAttachPics }) => {
  const [items, setItems] = useState<PackingItemRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await db.getPackageItemsByOrderPackageIds([orderPackageId]);
        const rows: PackingItemRow[] = (data || []).filter((d: any) => d.order_package_id === orderPackageId);
        setItems(rows);
      } catch (e) {
        console.error('Failed to load packing items', e);
      } finally {
        setLoading(false);
      }
    };
    if (orderPackageId) load();
  }, [orderPackageId]);

  return (
    <View className="m-1 bg-white rounded-xl border border-gray-500">
      <View className="px-4 py-2 border-gray-200 rounded-t-xl">
        <Text className="text-blue-800 font-semibold">Packing Items</Text>
      </View>

      {loading ? (
        <View className="p-4">
          <Text className="text-gray-600">Loading items...</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 260 }}>
          {items.length === 0 ? (
            <View className="p-4">
              <Text className="text-gray-500">No items found for this box.</Text>
            </View>
          ) : (
            <View className="p-2">
              {items.map((it, idx) => (
                <View
                  key={`${it.designation || 'item'}-${idx}`}
                  className={`flex-row items-center justify-between p-3 rounded-lg border ${idx % 2 === 0 ? 'bg-white border-gray-400' : 'bg-slate-50 border-gray-400'} mb-2`}
                >
                  <View className="flex-row items-baseline">
                    <Text className="text-gray-700 font-semibold mr-2">Item;</Text>
                    <Text className="text-gray-800 mr-2">{it.quantity ?? '—'}</Text>
                    <Text className="text-gray-700">{it.designation || '—'}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onAttachPics?.(it)}
                    className="px-3 py-1 rounded bg-primary-600"
                    activeOpacity={0.8}
                    accessibilityLabel="Attach images"
                  >
                    <Camera size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default OrderPackingItems;
