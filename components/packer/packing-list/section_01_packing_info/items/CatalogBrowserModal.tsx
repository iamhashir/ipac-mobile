import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, FlatList, TextInput, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Animated, Pressable, TouchableWithoutFeedback } from 'react-native';
import { X, Search, Package, Plus } from 'lucide-react-native';
import { db } from '../../../../../utils/api/supabase';
import RequestMoreModal from './RequestMoreModal';
import { getCatalogCache, setCatalogCache } from '../../../../../utils/cache/catalogCache';

interface CatalogBrowserModalProps {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  orderId: string;
  orderPackageId: string;
  orderPkgInstanceId?: string | null;
  onAssigned: () => void;
  destination?: string | null;
  /** Standard box: draw items from the destination allocation pool, not the full catalog. */
  isStandardBox?: boolean;
}

const toFiniteNumberOrNull = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getRemainingExpectedQty = (catalogItem: any): number | null => {
  const expectedQty = toFiniteNumberOrNull(catalogItem?.expected_qty);
  if (expectedQty === null || expectedQty <= 0) return null;

  const packedQty = toFiniteNumberOrNull(catalogItem?.packed_qty) ?? 0;
  const remaining = Math.max(0, expectedQty - packedQty);
  return Math.round(remaining * 100) / 100;
};

const isCatalogItemFullyPacked = (catalogItem: any): boolean => {
  const remaining = getRemainingExpectedQty(catalogItem);
  return remaining !== null && remaining <= 0;
};

const AnimatedItemRow = ({
  item,
  assigningId,
  openQuantityModal,
  openPackedInfoModal,
  destination,
  allocationMode
}: {
  item: any;
  assigningId: string | null;
  openQuantityModal: (item: any) => void;
  openPackedInfoModal: (item: any, locations: string[]) => void;
  destination: string | null;
  allocationMode: boolean;
}) => {
  const isAssigning = assigningId === item.id;
  const categoryLabel = item.pkg_category?.label;
  const defaultQty = item.expected_qty ?? 1;
  const remainingQty = getRemainingExpectedQty(item);
  const isFullyPacked = isCatalogItemFullyPacked(item);

  const destLower = destination?.toLowerCase();
  const locLower = item.warehouse_location?.toLowerCase();
  const hasDest = !!destination;
  const hasLoc = !!item.warehouse_location;

  // In allocation mode every listed item already belongs to this box's destination, so it is
  // a match by construction; otherwise fall back to the (legacy) warehouse_location compare.
  const isMatch = allocationMode
    ? !isFullyPacked
    : !isFullyPacked && hasDest && hasLoc && locLower === destLower;
  const isDiffLoc = allocationMode
    ? false
    : !isFullyPacked && hasDest && locLower !== destLower;

  const pulseAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isMatch || isDiffLoc || isFullyPacked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    }
  }, [isMatch, isDiffLoc, isFullyPacked]);

  const packedLocations = (item.pkd_item || [])
    .map((pkd: any) => {
      const inst = Array.isArray(pkd.instance) ? pkd.instance[0] : pkd.instance;
      if (!inst) return null;

      const pkg = Array.isArray(inst?.package) ? inst.package[0] : inst?.package;
      const order = Array.isArray(pkg?.order) ? pkg.order[0] : pkg?.order;

      const boxNum = pkg?.package_number;
      const orderRef = order?.order_name;

      if (boxNum !== undefined && boxNum !== null) {
        return `Box #${boxNum}${orderRef ? ` (${orderRef})` : ''}`;
      } else if (inst.ipac_reference) {
        return inst.ipac_reference;
      }
      return null;
    })
    .filter(Boolean);

  const handlePress = () => {
    if (isFullyPacked) {
      openPackedInfoModal(item, packedLocations);
    } else {
      openQuantityModal(item);
    }
  };

  // Determine colors based on state
  let borderColorClass = 'border-gray-100';
  let highlightHex = '';
  let rowBg = 'bg-white';

  if (isFullyPacked) {
    borderColorClass = 'border-blue-400 border-l-4';
    highlightHex = '#93c5fd'; // blue-300
    rowBg = 'bg-blue-50/40';
  } else if (isMatch) {
    borderColorClass = 'border-green-500 border-l-4';
    highlightHex = '#86efac'; // green-300
    rowBg = 'bg-green-50/50';
  } else if (isDiffLoc) {
    borderColorClass = 'border-yellow-500 border-l-4';
    highlightHex = '#fde047'; // yellow-300
    rowBg = 'bg-yellow-50/40';
  }

  return (
    <TouchableOpacity
      className={`${rowBg} p-4 border-b ${borderColorClass} flex-row items-center justify-between ${isAssigning ? 'opacity-50' : ''} overflow-hidden`}
      onPress={handlePress}
      disabled={isAssigning || !!assigningId}
    >
      {(isMatch || isDiffLoc || isFullyPacked) && (
        <Animated.View
          style={{
            position: 'absolute',
            top: -50,
            bottom: -50,
            right: -80,
            width: 400,
            backgroundColor: highlightHex,
            transform: [{ rotate: '15deg' }],
            opacity: pulseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 0.3]
            }),
          }}
        />
      )}

      <View className="flex-1 pr-4">
        <View className="flex-row items-center mb-1">
          <Text className={`font-semibold text-base ${isFullyPacked ? 'text-gray-500' : 'text-slate-800'}`} numberOfLines={1}>
            {item.description || "Unknown Item"}
          </Text>
          {categoryLabel && (
            <View className="ml-2 bg-slate-100 px-1.5 py-0.5 rounded">
              <Text className="text-slate-600 text-[10px] font-medium">{categoryLabel}</Text>
            </View>
          )}
          {isFullyPacked && (
            <View className="ml-2 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />
              <Text className="text-blue-800 text-[10px] font-bold" numberOfLines={1}>
                {packedLocations.length > 0 ? `IN ${Array.from(new Set(packedLocations)).join(', ')}`.toUpperCase() : 'PACKED'}
              </Text>
            </View>
          )}
          {isMatch && (
            <View className="ml-2 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
              <Text className="text-green-800 text-[10px] font-bold">MATCH</Text>
            </View>
          )}
          {isDiffLoc && (
            <View className="ml-2 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
              <Text className="text-amber-800 text-[10px] font-bold">DIFF LOC</Text>
            </View>
          )}
        </View>

        <Text className="text-sm text-gray-600 leading-5">
          <Text className="font-medium text-gray-500">Item #:</Text> {item.item_num || "N/A"}{"  "}
          <Text className="font-medium text-gray-500">Ref:</Text> {item.reference || "N/A"}{"  "}
          {!isFullyPacked && (
            <Text><Text className="font-medium text-gray-500">Rem:</Text> {remainingQty} / {defaultQty}{"  "}</Text>
          )}
          <Text className="font-medium text-gray-500">Loc:</Text> {item.warehouse_location || "—"}
          {item.ipac_comments ? (
            <Text className="italic text-orange-600">{"  "}• {item.ipac_comments}</Text>
          ) : null}
        </Text>

      </View>

      <View className={`w-8 h-8 rounded-full items-center justify-center ${isAssigning ? 'bg-gray-50' : isFullyPacked ? 'bg-blue-100' : isMatch ? 'bg-green-100' : isDiffLoc ? 'bg-amber-100' : 'bg-slate-100'}`}>
        {isAssigning ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : isFullyPacked ? (
          <Package size={18} color="#2563eb" />
        ) : (
          <Plus size={18} color={isMatch ? "#16a34a" : isDiffLoc ? "#d97706" : "#475569"} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const CatalogBrowserModal: React.FC<CatalogBrowserModalProps> = ({
  visible,
  onClose,
  clientId,
  orderId,
  orderPackageId,
  orderPkgInstanceId = null,
  onAssigned,
  destination,
  isStandardBox = false
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [hiddenPackedCount, setHiddenPackedCount] = useState(0);
  const [packedInfoModal, setPackedInfoModal] = useState<{ visible: boolean; item: any | null; locations: string[] }>({ visible: false, item: null, locations: [] });
  const [requestVisible, setRequestVisible] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  // Item targeted by a "Request more" raised from the fully-packed info modal (where there
  // is no selectedItem). Falls back to selectedItem for the in-assign-modal request path.
  const [requestItem, setRequestItem] = useState<any | null>(null);

  const selectedItemStatus = useMemo(() => {
    if (!selectedItem) return 'none';
    // Allocation-pool items are all for this destination -> always a match.
    if (isStandardBox) return 'match';
    if (!destination) return 'none';
    const destLower = destination.toLowerCase();
    const locLower = selectedItem.warehouse_location?.toLowerCase();

    // If location is empty or doesn't match, it's a "diff" status
    if (!locLower || locLower !== destLower) return 'diff';

    return 'match';
  }, [selectedItem, destination, isStandardBox]);

  const loadItems = useCallback(async (currentSearch?: string) => {
    if (!visible || !clientId) return;

    // Stale-while-revalidate: paint the cached list instantly on reopen (the catalog
    // re-fetches on every open), then refresh in the background so it stays fresh.
    const cacheKey = `${clientId}|${orderId}|${isStandardBox ? 'sb' : 'm'}|${destination || ''}|${(currentSearch || '').trim().toLowerCase()}`;
    const cachedCatalog = getCatalogCache(cacheKey);
    if (cachedCatalog) {
      setItems(cachedCatalog.items as any[]);
      setHiddenPackedCount(cachedCatalog.hiddenPackedCount);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      // Standard boxes draw from the destination's allocation pool (only the items meant for
      // this order + destination). The pool is small, so search is applied client-side.
      if (isStandardBox && destination) {
        const { data, error } = await db.getStandardBoxAllocationItems(orderId, destination);
        if (error) {
          console.error('Error fetching allocation pool:', error);
          Alert.alert('Error', 'Failed to load destination items');
        } else {
          const mapped = (data || [])
            .map((row: any) => {
              const item = Array.isArray(row.items_db) ? row.items_db[0] : row.items_db;
              return item
                ? { ...item, expected_qty: row.expected_qty, packed_qty: row.packed_qty }
                : null;
            })
            .filter(Boolean) as any[];
          // Keep fully-packed items visible for SB pools: a packer whose allocation is
          // exhausted must still be able to open the item to send a "Request more" ticket.
          // (filteredItems sorts packed rows to the bottom.)
          setItems(mapped);
          setHiddenPackedCount(0);
          setCatalogCache(cacheKey, { items: mapped, hiddenPackedCount: 0 });
        }
        return;
      }

      const { data, error } = await db.getUnassignedCatalogItems(clientId, orderId, currentSearch);
      if (error) {
        console.error('Error fetching catalog items:', error);
        Alert.alert('Error', 'Failed to load catalog items');
      } else {
        let catalogItems = data || [];

        // Overlay this box destination's allocation qty (the order plan) so the card shows
        // expected/packed for THIS destination (e.g. 2 for AIN), not the global items_db rollup.
        if (destination && catalogItems.length > 0) {
          const { data: allocs } = await db.getOrderAllocationsForDestination(orderId, destination);
          if (allocs && allocs.length > 0) {
            const allocByItem = new Map<string, { expected: number; packed: number }>();
            allocs.forEach((a: any) =>
              allocByItem.set(String(a.items_db_id), {
                expected: Number(a.expected_qty),
                packed: Number(a.packed_qty),
              }),
            );
            catalogItems = catalogItems.map((item: any) => {
              const a = allocByItem.get(String(item.id));
              return a ? { ...item, expected_qty: a.expected, packed_qty: a.packed } : item;
            });
          }
        }

        const isSearching = currentSearch && currentSearch.trim() !== '';

        if (isSearching) {
          // When searching, show both packed and unpacked
          setItems(catalogItems);
          setHiddenPackedCount(0);
          setCatalogCache(cacheKey, { items: catalogItems, hiddenPackedCount: 0 });
        } else {
          // Default view: only show available items
          const availableItems = catalogItems.filter((item) => !isCatalogItemFullyPacked(item));
          const hidden = Math.max(0, catalogItems.length - availableItems.length);
          setItems(availableItems);
          setHiddenPackedCount(hidden);
          setCatalogCache(cacheKey, { items: availableItems, hiddenPackedCount: hidden });
        }
      }
    } catch (e) {
      console.error('Unexpected error loading catalog items:', e);
    } finally {
      setLoading(false);
    }
  }, [visible, clientId, orderId, isStandardBox, destination]);

  // Reset transient state when the modal opens. The fetch itself is handled by the
  // single load effect below — calling loadItems() here too caused a DOUBLE fetch
  // on every open (this effect + the search effect both fired on `visible`).
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSelectedItem(null);
      setQuantityInput('1');
    }
  }, [visible]);

  // Single load path: fetch immediately on open / when the search is cleared, but
  // debounce (500ms) while the user is actively typing so each keystroke doesn't
  // fire its own server query.
  useEffect(() => {
    if (!visible) return;

    const q = searchQuery.trim();
    const handler = setTimeout(
      () => {
        loadItems(q !== '' ? q : undefined);
      },
      q !== '' ? 500 : 0,
    );

    return () => clearTimeout(handler);
  }, [searchQuery, visible, loadItems]);

  const filteredItems = useMemo(() => {
    // In allocation mode the pool is loaded whole, so apply the search filter client-side.
    let base = items;
    if (isStandardBox) {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        base = items.filter((item) =>
          [item.description, item.item_num, item.reference].some((field) =>
            String(field || '').toLowerCase().includes(q),
          ),
        );
      }
    }

    const sorted = [...base];
    const destLower = destination?.toLowerCase();

    sorted.sort((a, b) => {
      const aPacked = isCatalogItemFullyPacked(a) ? 1 : 0;
      const bPacked = isCatalogItemFullyPacked(b) ? 1 : 0;

      if (aPacked !== bPacked) {
        return aPacked - bPacked; // packed items go to the end
      }

      // Legacy warehouse_location sort only applies outside allocation mode.
      if (!isStandardBox && destLower) {
        const aMatches = a.warehouse_location?.toLowerCase() === destLower ? 1 : 0;
        const bMatches = b.warehouse_location?.toLowerCase() === destLower ? 1 : 0;
        return bMatches - aMatches;
      }
      return 0;
    });

    return sorted;
  }, [items, destination, isStandardBox, searchQuery]);

  const handleSendRequest = async (delta: number, reason: string) => {
    const target = requestItem ?? selectedItem;
    if (!target) return;
    setRequestSubmitting(true);
    try {
      const { error } = await db.createAllocationIncreaseRequest({
        orderId,
        itemsDbId: target.id,
        destination: destination ?? null,
        requestedDelta: delta,
        reason,
        orderPackageId,
      });
      if (error) {
        Alert.alert('Error', (error as any)?.message || 'Failed to send request');
        return;
      }
      setRequestVisible(false);
      setRequestItem(null);
      setSelectedItem(null);
      Alert.alert('Request sent', 'An admin will review your request for more of this item.');
    } catch (e) {
      console.error('Error sending allocation-increase request:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleAssignItem = async (itemId: string, quantity: number) => {
    try {
      setAssigningId(itemId);
      const { error } = await db.assignItemToPackage(
        itemId,
        orderPackageId,
        quantity,
        orderPkgInstanceId || undefined
      );


      if (error) {
        Alert.alert('Error', error.message || 'Failed to assign item to package');
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
    if (isCatalogItemFullyPacked(item)) {
      Alert.alert('All Packed', 'This item is already fully packed and cannot be assigned again.');
      return;
    }

    const suggestedQty = Number(item.expected_qty ?? 1);
    const remainingQty = getRemainingExpectedQty(item);
    const effectiveSuggestedQty = remainingQty !== null ? remainingQty : suggestedQty;
    const safeQty = Number.isFinite(effectiveSuggestedQty) && effectiveSuggestedQty > 0 ? effectiveSuggestedQty : 1;

    setSelectedItem(item);
    setQuantityInput(String(safeQty));
  };

  const confirmAssignSelectedItem = async () => {
    if (!selectedItem) return;

    if (isCatalogItemFullyPacked(selectedItem)) {
      Alert.alert('All Packed', 'This item is already fully packed and cannot be assigned again.');
      return;
    }

    const qty = Number(quantityInput);

    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Validation', 'Please enter a quantity greater than 0.');
      return;
    }

    const remainingQty = getRemainingExpectedQty(selectedItem);
    if (remainingQty !== null && qty > remainingQty) {
      Alert.alert('Validation', `Only ${remainingQty} remaining for this item. Reduce quantity to continue.`);
      return;
    }

    await handleAssignItem(selectedItem.id, qty);
  };

  const renderItem = ({ item }: { item: any }) => {
    return (
      <AnimatedItemRow
        item={item}
        assigningId={assigningId}
        openQuantityModal={openQuantityModal}
        openPackedInfoModal={(item, locations) => setPackedInfoModal({ visible: true, item, locations })}
        destination={destination || null}
        allocationMode={isStandardBox}
      />
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
                disableFullscreenUI
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
            {hiddenPackedCount > 0 && (
              <Text className="text-xs text-amber-700 mt-1 ml-1">
                Hidden fully packed items: {hiddenPackedCount}
              </Text>
            )}
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
                No catalog items are available for this client yet.

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
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 144 }}
          onPress={() => !assigningId && setSelectedItem(null)}
        >
          <TouchableWithoutFeedback>
            <View className={`bg-white rounded-xl w-full overflow-hidden border-2 shadow-xl ${selectedItemStatus === 'match' ? 'border-green-300' :
                selectedItemStatus === 'diff' ? 'border-yellow-300' :
                  'border-slate-300'
              }`}>
              <View className={`p-3 gap-2 border-b flex-row items-center ${selectedItemStatus === 'match' ? 'bg-green-50 border-green-100' :
                  selectedItemStatus === 'diff' ? 'bg-yellow-50 border-yellow-100' :
                    'bg-slate-50 border-slate-100'
                }`}>
                <Plus size={20} color={
                  selectedItemStatus === 'match' ? '#16a34a' :
                    selectedItemStatus === 'diff' ? '#ca8a04' :
                      '#64748b'
                } />
                <Text className={`text-base font-bold ${selectedItemStatus === 'match' ? 'text-green-900' :
                    selectedItemStatus === 'diff' ? 'text-yellow-900' :
                      'text-slate-900'
                  }`}>Assign to Box</Text>
              </View>

              <View className="p-4">
                {selectedItemStatus === 'match' && (
                  <View className="bg-green-50 border border-green-200 p-2 rounded-lg mb-3">
                    <Text className="text-green-800 text-[11px] font-medium text-center">
                      This item matches your destination location!
                    </Text>
                  </View>
                )}
                {selectedItemStatus === 'diff' && (
                  <View className="bg-yellow-50 border border-yellow-200 p-2 rounded-lg mb-3">
                    <Text className="text-yellow-800 text-[11px] font-medium text-center">
                      Note: This item belongs to a different warehouse location.
                    </Text>
                  </View>
                )}

                <View className="flex-row items-start justify-between mb-4">
                  <Text className="font-semibold text-slate-800 text-sm flex-1 mr-2">
                    {selectedItem?.description || "Selected Item"}
                  </Text>
                  <View className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    <Text className="text-slate-600 font-bold text-xs">Stock: {selectedItem?.expected_qty || 0}</Text>
                  </View>
                </View>

                <View>
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quantity to add</Text>
                  <TextInput
                    disableFullscreenUI
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 font-medium"
                    value={quantityInput}
                    onChangeText={setQuantityInput}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#94a3b8"
                    editable={!assigningId}
                    autoFocus
                  />
                  {getRemainingExpectedQty(selectedItem) !== null && (
                    <Text className="text-[10px] text-slate-500 mt-1.5 ml-1">
                      Available to pack: <Text className="font-bold text-slate-700">{getRemainingExpectedQty(selectedItem)}</Text>
                    </Text>
                  )}
                </View>
              </View>

              <View className="p-3 bg-slate-50 border-t border-slate-100 flex-row justify-end gap-2">
                {isStandardBox && (
                  <TouchableOpacity
                    onPress={() => setRequestVisible(true)}
                    className="px-4 py-2 rounded-lg bg-amber-50 border border-amber-300 mr-auto"
                    disabled={!!assigningId}
                  >
                    <Text className="text-amber-800 font-bold text-xs">Request more</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setSelectedItem(null)}
                  className="px-5 py-2 rounded-lg bg-white border border-slate-200"
                  disabled={!!assigningId}
                >
                  <Text className="text-slate-600 font-bold text-xs">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmAssignSelectedItem}
                  className={`px-6 py-2 rounded-lg ${selectedItemStatus === 'match' ? 'bg-green-600' :
                      selectedItemStatus === 'diff' ? 'bg-yellow-600' :
                        'bg-blue-600'
                    }`}
                  disabled={!!assigningId}
                >
                  {assigningId ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white font-bold text-xs">Assign to Box</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>

      <RequestMoreModal
        visible={requestVisible}
        itemName={(requestItem ?? selectedItem)?.description || 'Selected item'}
        suggestedDelta={Number(quantityInput) || 1}
        submitting={requestSubmitting}
        onClose={() => {
          setRequestVisible(false);
          setRequestItem(null);
        }}
        onSubmit={handleSendRequest}
      />

      <Modal
        visible={packedInfoModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPackedInfoModal({ visible: false, item: null, locations: [] })}
      >
        <Pressable
          className="flex-1 bg-black/45 justify-center px-36"
          onPress={() => setPackedInfoModal({ visible: false, item: null, locations: [] })}
        >
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-xl w-full overflow-hidden border-2 border-blue-300 shadow-xl">
              <View className="bg-blue-50 p-3 gap-2 border-b border-blue-100 flex-row items-center">
                <Package size={20} color="#3b82f6" />
                <Text className="text-base font-bold text-blue-900">Item Fully Packed</Text>
              </View>
              <View className="p-4">
                <View className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg mb-4">
                  <Text className="text-amber-800 text-[11px] font-medium text-center">
                    All items are packed and you cannot add any more.
                  </Text>
                </View>

                <View className="flex-row items-start justify-between mb-2">
                  <Text className="font-semibold text-slate-800 text-sm flex-1 mr-2">
                    {packedInfoModal.item?.description || "Unknown Item"}
                  </Text>
                  <View className="bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                    <Text className="text-blue-800 font-bold text-xs">Qty: {packedInfoModal.item?.expected_qty || 0}</Text>
                  </View>
                </View>

                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">References / Boxes</Text>
                <View className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {packedInfoModal.locations.map((loc, idx) => (
                    <View key={idx} className="flex-row items-center mb-1.5 last:mb-0">
                      <View className="w-1 h-1 rounded-full bg-blue-400 mr-2" />
                      <Text className="text-xs text-slate-700 font-medium">{loc}</Text>
                    </View>
                  ))}
                  {packedInfoModal.locations.length === 0 && (
                    <Text className="text-xs text-slate-500 italic">No reference found.</Text>
                  )}
                </View>
              </View>
              <View className="p-3 bg-slate-50 border-t border-slate-100 flex-row justify-end gap-2">
                {isStandardBox && (
                  <TouchableOpacity
                    className="px-4 py-2 rounded-lg bg-amber-50 border border-amber-300 mr-auto"
                    onPress={() => {
                      const item = packedInfoModal.item;
                      setPackedInfoModal({ visible: false, item: null, locations: [] });
                      setRequestItem(item);
                      setQuantityInput('1');
                      setRequestVisible(true);
                    }}
                  >
                    <Text className="text-amber-800 font-bold text-xs">Request more</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  className="bg-blue-600 px-6 py-2 rounded-lg"
                  onPress={() => setPackedInfoModal({ visible: false, item: null, locations: [] })}
                >
                  <Text className="text-white font-bold text-xs">Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>
    </Modal>
  );
};

export default CatalogBrowserModal;
