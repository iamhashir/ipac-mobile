import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { db } from '../../../../utils/api/supabase';

interface PackingItemRow {
  order_package_id: string;
  designation: string | null;
  quantity: number | null;
}

interface OrderPackingItemsProps {
  orderPackageId: string;
  onAttachPics?: (item: PackingItemRow) => void;
  editable?: boolean;
}

const OrderPackingItems: React.FC<OrderPackingItemsProps> = ({ orderPackageId, onAttachPics }) => {
  const [items, setItems] = useState<PackingItemRow[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCameraPress = async (item: PackingItemRow) => {
    Alert.alert('Attach image', 'Choose source', [
      { text: 'Gallery', onPress: () => pickFromGallery(item) },
      { text: 'Camera', onPress: () => takePhoto(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromGallery = async (item: PackingItemRow) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Media library access is needed.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.8 
    });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri, item);
    }
  };

  const takePhoto = async (item: PackingItemRow) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri, item);
    }
  };

  const uploadAsset = async (uri: string, item: PackingItemRow) => {
    try {
      const notes = `Item: ${item.designation || 'N/A'} (Qty: ${item.quantity || 0})`;
      const { data, error } = await db.uploadMediaToStorage(orderPackageId, uri, 'item', notes);
      if (error) {
        Alert.alert('Upload failed', 'Could not upload image to storage.');
      } else {
        Alert.alert('Uploaded', 'Image uploaded successfully.');
      }
    } catch (e) {
      Alert.alert('Upload error', 'Unexpected error while uploading.');
    }
  };

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
                    onPress={() => handleCameraPress(it)}
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
