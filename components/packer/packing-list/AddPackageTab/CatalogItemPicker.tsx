import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Search, PackagePlus, CheckCircle2, MinusCircle, X } from 'lucide-react-native';
import { db } from '../../../../utils/api/supabase';

interface CatalogItem {
  id: string;
  item_num: string | number | null;
  description: string | null;
  reference: string | null;
  expected_qty: number | null;
  packed_qty: number | null;
  warehouse_location: string | null;
  category_id: string | null;
}

interface AddedItem {
  catalogItem: CatalogItem;
  quantity: number;
}

interface CatalogItemPickerProps {
  orderId: string;
  clientId: string;
  orderPackageId: string;
  instanceId: string;
  overrideCategoryId?: string | null;
  /** Called with the primary item after items are confirmed (used for IPAC ref generation) */
  onItemsConfirmed: (primaryItem: CatalogItem | null) => void;
}

const isFullyPacked = (item: CatalogItem) => {
  if (item.expected_qty == null || item.expected_qty <= 0) return false;
  return Number(item.packed_qty ?? 0) >= Number(item.expected_qty);
};

const remainingQty = (item: CatalogItem) => {
  if (item.expected_qty == null) return null;
  const rem = Number(item.expected_qty) - Number(item.packed_qty ?? 0);
  return Math.max(0, rem);
};

export default function CatalogItemPicker({
  orderId,
  clientId,
  orderPackageId,
  instanceId,
  overrideCategoryId,
  onItemsConfirmed,
}: CatalogItemPickerProps) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedItems, setAddedItems] = useState<AddedItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});

  const loadItems = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      const { data, error } = await db.getUnassignedCatalogItems(
        clientId,
        orderId,
        searchTerm.trim() || undefined,
        overrideCategoryId ?? null
      );
      if (error) {
        console.warn('[CatalogItemPicker] load error:', error);
        setItems([]);
      } else {
        setItems((data as any[]) || []);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId, orderId, overrideCategoryId]);

  useEffect(() => {
    loadItems('');
  }, [loadItems]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => loadItems(search), 400);
    return () => clearTimeout(t);
  }, [search, loadItems]);

  const handleAddItem = (item: CatalogItem) => {
    if (addedItems.find((a) => a.catalogItem.id === item.id)) return;
    const rem = remainingQty(item);
    const defaultQty = rem != null ? Math.min(rem, 1) : 1;
    setAddedItems((prev) => [...prev, { catalogItem: item, quantity: defaultQty }]);
    setQtyInputs((prev) => ({ ...prev, [item.id]: String(defaultQty) }));
  };

  const handleRemoveItem = (itemId: string) => {
    setAddedItems((prev) => prev.filter((a) => a.catalogItem.id !== itemId));
    setQtyInputs((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleQtyChange = (itemId: string, val: string) => {
    setQtyInputs((prev) => ({ ...prev, [itemId]: val }));
    const parsed = parseInt(val, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      setAddedItems((prev) =>
        prev.map((a) => a.catalogItem.id === itemId ? { ...a, quantity: parsed } : a)
      );
    }
  };

  const handleConfirm = async () => {
    if (addedItems.length === 0) {
      // Skip with no items — still valid (some boxes may have no items in DB)
      onItemsConfirmed(null);
      return;
    }

    setSaving(true);
    try {
      for (const { catalogItem, quantity } of addedItems) {
        const { error } = await db.assignItemToPackage(
          catalogItem.id,
          orderPackageId,
          quantity,
          instanceId
        );
        if (error) throw new Error(error.message || 'Failed to add item to box');
      }
      // Primary item = first added (used for IPAC reference item_num)
      onItemsConfirmed(addedItems[0]?.catalogItem ?? null);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save items');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: CatalogItem }) => {
    const packed = isFullyPacked(item);
    const rem = remainingQty(item);
    const isAdded = addedItems.some((a) => a.catalogItem.id === item.id);

    return (
      <TouchableOpacity
        onPress={() => !packed && !isAdded && handleAddItem(item)}
        disabled={packed || isAdded}
        className={`mx-3 mb-2 rounded-xl border p-3 flex-row items-center justify-between ${
          packed
            ? 'bg-gray-50 border-gray-200 opacity-50'
            : isAdded
            ? 'bg-blue-50 border-blue-300'
            : 'bg-white border-gray-300'
        }`}
      >
        <View style={{ flex: 1 }}>
          <View className="flex-row items-center">
            <Text className="text-xs font-bold text-blue-800 mr-2">
              #{item.item_num ?? '—'}
            </Text>
            {item.warehouse_location ? (
              <Text className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {item.warehouse_location}
              </Text>
            ) : null}
          </View>
          <Text className="text-sm text-gray-800 mt-0.5" numberOfLines={2}>
            {item.description || item.reference || '—'}
          </Text>
          {item.expected_qty != null && (
            <Text className={`text-xs mt-0.5 ${packed ? 'text-gray-400' : 'text-emerald-700'}`}>
              {packed
                ? 'Fully packed'
                : rem != null
                ? `Remaining: ${rem} / ${item.expected_qty}`
                : `Qty: ${item.expected_qty}`}
            </Text>
          )}
        </View>

        <View className="ml-3 items-center">
          {isAdded ? (
            <CheckCircle2 size={22} color="#2563eb" />
          ) : packed ? (
            <CheckCircle2 size={22} color="#9ca3af" />
          ) : (
            <PackagePlus size={22} color="#0284c7" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1">
      {/* Search bar */}
      <View className="mx-3 mt-3 mb-2 flex-row items-center bg-white border border-gray-300 rounded-xl px-3">
        <Search size={16} color="#6b7280" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by item no., description, reference…"
          className="flex-1 ml-2 py-2.5 text-sm text-gray-800"
          placeholderTextColor="#9ca3af"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={14} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Added items summary */}
      {addedItems.length > 0 && (
        <View className="mx-3 mb-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <Text className="text-xs font-bold text-blue-800 mb-2">
            Items to add ({addedItems.length})
          </Text>
          {addedItems.map(({ catalogItem, quantity }) => (
            <View key={catalogItem.id} className="flex-row items-center mb-1.5">
              <Text className="text-xs text-blue-900 flex-1" numberOfLines={1}>
                #{catalogItem.item_num} — {catalogItem.description || catalogItem.reference}
              </Text>
              <View className="flex-row items-center ml-2">
                <Text className="text-xs text-blue-700 mr-1">Qty:</Text>
                <TextInput
                  value={qtyInputs[catalogItem.id] ?? String(quantity)}
                  onChangeText={(v) => handleQtyChange(catalogItem.id, v)}
                  keyboardType="numeric"
                  className="w-10 text-xs border border-blue-300 rounded px-1 py-0.5 text-center bg-white text-blue-900"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveItem(catalogItem.id)}
                  className="ml-1.5"
                >
                  <MinusCircle size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Item list */}
      {loading ? (
        <View className="flex-1 items-center justify-center py-10">
          <ActivityIndicator color="#0284c7" />
          <Text className="text-gray-500 text-sm mt-2">Loading catalog…</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center py-10 px-6">
          <PackagePlus size={40} color="#d1d5db" />
          <Text className="text-gray-400 text-sm mt-3 text-center">
            {search
              ? 'No items match your search.'
              : 'No catalog items available for this category.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Confirm button */}
      <View className="mx-3 mt-2 mb-4">
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={saving}
          className={`p-4 rounded-xl items-center ${saving ? 'bg-blue-300' : 'bg-blue-600'}`}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">
              {addedItems.length > 0
                ? `Confirm ${addedItems.length} Item${addedItems.length > 1 ? 's' : ''} & Create Box`
                : 'Create Box Without Items'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
