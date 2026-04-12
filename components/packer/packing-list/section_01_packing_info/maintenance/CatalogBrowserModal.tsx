import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, FlatList, TextInput, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Search, Package, Plus } from 'lucide-react-native';
import { db } from '../../../../../utils/api/supabase';

interface CatalogBrowserModalProps {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  orderPackageId: string;
  onAssigned: () => void;
}

const CatalogBrowserModal: React.FC<CatalogBrowserModalProps> = ({
  visible,
  onClose,
  clientId,
  orderPackageId,
  onAssigned
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');

  const loadItems = useCallback(async () => {
    if (!visible || !clientId) return;
    
    setLoading(true);
    try {
      const { data, error } = await db.getUnassignedCatalogItems(clientId);
      if (error) {
        console.error('Error fetching catalog items:', error);
        Alert.alert('Error', 'Failed to load catalog items');
      } else {
        setItems(data || []);
      }
    } catch (e) {
      console.error('Unexpected error loading catalog items:', e);
    } finally {
      setLoading(false);
    }
  }, [visible, clientId]);

  useEffect(() => {
    if (visible) {
      loadItems();
      setSearchQuery('');
      setSelectedItem(null);
      setQuantityInput('1');
    }
  }, [visible, loadItems]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    
    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const itemNum = (item.item_num || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const ref = (item.reference || '').toLowerCase();
      
      return itemNum.includes(query) || desc.includes(query) || ref.includes(query);
    });
  }, [items, searchQuery]);

  const handleAssignItem = async (maintenanceDbId: string, quantity: number) => {
    try {
      setAssigningId(maintenanceDbId);
      const { error } = await db.assignItemToPackage(maintenanceDbId, orderPackageId, quantity);
      
      if (error) {
        Alert.alert('Error', 'Failed to assign item to package');
      } else {
        setSelectedItem(null);
        setQuantityInput('1');
        // Success
        onAssigned();
        onClose();
      }
    } catch (e) {
      console.error('Error assigning item:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAssigningId(null);
    }
  };

  const openQuantityModal = (item: any) => {
    const suggestedQty = Number(item.expected_qty ?? 1);
    const safeQty = Number.isFinite(suggestedQty) && suggestedQty > 0 ? suggestedQty : 1;
    setSelectedItem(item);
    setQuantityInput(String(safeQty));
  };

  const confirmAssignSelectedItem = async () => {
    if (!selectedItem) return;
    const qty = Number(quantityInput);

    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Validation', 'Please enter a quantity greater than 0.');
      return;
    }

    await handleAssignItem(selectedItem.id, qty);
  };

  const renderItem = ({ item }: { item: any }) => {
    const isAssigning = assigningId === item.id;
    const categoryLabel = item.maintenance_package_categories?.label;
    const defaultQty = item.expected_qty ?? 1;

    return (
      <TouchableOpacity 
        className={`bg-white p-4 border-b border-gray-100 flex-row items-center justify-between ${isAssigning ? 'opacity-50' : ''}`}
        onPress={() => openQuantityModal(item)}
        disabled={isAssigning || !!assigningId}
      >
        <View className="flex-1 pr-4">
          <View className="flex-row items-center mb-1">
            <Text className="font-semibold text-slate-800 text-base" numberOfLines={1}>
              {item.description || "Unknown Item"}
            </Text>
            {categoryLabel && (
              <View className="ml-2 bg-blue-100 px-1.5 py-0.5 rounded">
                <Text className="text-blue-800 text-[10px] font-medium">{categoryLabel}</Text>
              </View>
            )}
          </View>
          
          <View className="flex-row items-center mt-1">
            <Text className="text-sm text-gray-600 mr-3">
              <Text className="font-medium text-gray-500">Item #:</Text> {item.item_num || "N/A"}
            </Text>
            <Text className="text-sm text-gray-600 mr-3">
              <Text className="font-medium text-gray-500">Ref:</Text> {item.reference || "N/A"}
            </Text>
            <Text className="text-sm text-gray-600">
              <Text className="font-medium text-gray-500">Default Qty:</Text> {defaultQty}
            </Text>
          </View>
          
          {item.ipac_comments && (
            <Text className="text-xs text-orange-600 mt-1 italic" numberOfLines={1}>
              {item.ipac_comments}
            </Text>
          )}
        </View>

        <View className={`w-8 h-8 rounded-full items-center justify-center ${isAssigning ? 'bg-gray-100' : 'bg-blue-50'}`}>
          {isAssigning ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <Plus size={18} color="#2563eb" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-gray-50">
        <KeyboardAvoidingView 
          className="flex-1" 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Package size={20} color="#0f172a" className="mr-2" />
              <Text className="text-lg font-bold text-slate-900">Item Catalog</Text>
            </View>
            <TouchableOpacity 
              onPress={onClose}
              className="p-2 bg-gray-100 rounded-full"
            >
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="bg-white px-4 py-3 border-b border-gray-200">
            <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
              <Search size={18} color="#94a3b8" />
              <TextInput
                className="flex-1 ml-2 text-base text-slate-800"
                placeholder="Search description, item #, or ref..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
            <Text className="text-xs text-gray-500 mt-2 ml-1">
              Showing {filteredItems.length} catalog items
            </Text>
          </View>

          {/* List */}
          {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0ea5e9" />
              <Text className="text-gray-500 mt-4 text-sm font-medium">Loading catalog...</Text>
            </View>
          ) : items.length === 0 ? (
            <View className="flex-1 justify-center items-center px-6">
              <Package size={48} color="#cbd5e1" />
              <Text className="text-gray-500 mt-4 text-center font-medium">No catalog items found.</Text>
              <Text className="text-gray-400 mt-2 text-center text-sm">
                No maintenance catalog items are available for this client yet.
              </Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View className="flex-1 justify-center items-center px-6">
              <Search size={48} color="#cbd5e1" />
              <Text className="text-gray-500 mt-4 text-center font-medium">No results found for "{searchQuery}"</Text>
              <TouchableOpacity
                className="mt-4 px-4 py-2 bg-blue-100 rounded border border-blue-200"
                onPress={() => setSearchQuery('')}
              >
                <Text className="text-blue-700 font-medium">Clear Search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={!!selectedItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View className="bg-white rounded-xl p-4">
            <Text className="text-base font-bold text-slate-900">Assign Item Quantity</Text>
            <Text className="text-sm text-gray-500 mt-1" numberOfLines={2}>
              {selectedItem?.description || selectedItem?.reference || 'Selected item'}
            </Text>

            <View className="mt-4">
              <Text className="text-xs text-gray-600 mb-1 font-medium">Quantity for this box</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2 text-slate-900"
                value={quantityInput}
                onChangeText={setQuantityInput}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#94a3b8"
                editable={!assigningId}
              />
            </View>

            <View className="mt-4 flex-row justify-end">
              <TouchableOpacity
                onPress={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-md bg-gray-100 mr-2"
                disabled={!!assigningId}
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmAssignSelectedItem}
                className="px-4 py-2 rounded-md bg-blue-600"
                disabled={!!assigningId}
              >
                {assigningId ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white font-medium">Assign to Box</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

export default CatalogBrowserModal;
