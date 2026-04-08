import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Keyboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { db } from '../../../../utils/api/supabase';

interface PackingItemRow {
  id?: string;
  order_package_id: string;
  designation: string | null;
  quantity: number | null;
  reference?: string | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  net_weight?: number | null;
}

interface OrderPackingItemsProps {
  orderPackageId: string;
  onAttachPics?: (item: PackingItemRow) => void;
  editable?: boolean;
}

interface PackageItemDraft {
  designation: string;
  quantity: string;
  reference: string;
  length: string;
  width: string;
  height: string;
  netWeight: string;
}

const EMPTY_DRAFT: PackageItemDraft = {
  designation: '',
  quantity: '',
  reference: '',
  length: '',
  width: '',
  height: '',
  netWeight: '',
};

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const formatNumeric = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  const cast = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(cast)) return String(value);
  const rounded = roundToTwo(cast);
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

const CellLabel = ({ text, width }: { text: string; width: number }) => (
  <View style={{ width }} className="px-2 py-2 border-r border-gray-300 bg-slate-100">
    <Text className="text-xs font-semibold text-slate-700">{text}</Text>
  </View>
);

const DataCell = ({ value, width }: { value: string; width: number }) => (
  <View style={{ width }} className="px-2 py-2 border-r border-gray-200 justify-center">
    <Text className="text-sm text-slate-800">{value}</Text>
  </View>
);

const InputCell = ({
  width,
  value,
  onChange,
  placeholder,
  keyboardType = 'default',
  editable,
}: {
  width: number;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  editable: boolean;
}) => (
  <View style={{ width }} className="px-2 py-2 border-r border-blue-200 justify-center">
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      keyboardType={keyboardType}
      editable={editable}
      className="border border-blue-300 rounded px-2 py-1 text-sm bg-white"
      returnKeyType="done"
      blurOnSubmit
      onSubmitEditing={() => Keyboard.dismiss()}
      autoCorrect={false}
    />
  </View>
);

const OrderPackingItems: React.FC<OrderPackingItemsProps> = ({
  orderPackageId,
  onAttachPics,
  editable = true,
}) => {
  const [items, setItems] = useState<PackingItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PackageItemDraft>(EMPTY_DRAFT);

  const isEditable = editable !== false;

  const updateDraft = <K extends keyof PackageItemDraft>(key: K, value: PackageItemDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const resetDraft = () => setDraft(EMPTY_DRAFT);

  const parseOptionalNumber = (value: string) => {
    const raw = value.trim();
    if (!raw) return null;
    const cast = Number(raw);
    return Number.isFinite(cast) ? roundToTwo(cast) : null;
  };

  const validateDraft = () => {
    const designation = draft.designation.trim();
    const quantity = roundToTwo(Number(draft.quantity));

    if (!designation) {
      Alert.alert('Validation', 'Designation is required.');
      return null;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Validation', 'Quantity must be greater than 0.');
      return null;
    }

    const length = parseOptionalNumber(draft.length);
    const width = parseOptionalNumber(draft.width);
    const height = parseOptionalNumber(draft.height);
    const netWeight = parseOptionalNumber(draft.netWeight);

    const hasInvalidOptional = [
      [draft.length, length, 'Length'],
      [draft.width, width, 'Width'],
      [draft.height, height, 'Height'],
      [draft.netWeight, netWeight, 'Net Weight'],
    ].find(([raw, parsed]) => String(raw).trim() !== '' && parsed === null);

    if (hasInvalidOptional) {
      Alert.alert('Validation', `${hasInvalidOptional[2]} must be a valid number.`);
      return null;
    }

    return {
      designation,
      quantity,
      reference: draft.reference.trim() || null,
      length,
      width,
      height,
      net_weight: netWeight,
    };
  };

  const saveInlineItem = async () => {
    if (!isEditable || saving) return;

    const payload = validateDraft();
    if (!payload) return;

    try {
      setSaving(true);
      const { data, error } = await db.addPackageItem({
        order_package_id: orderPackageId,
        ...payload,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to add package item.');
        return;
      }

      const inserted: PackingItemRow = {
        id: data?.id,
        order_package_id: orderPackageId,
        designation: data?.designation ?? payload.designation,
        quantity: data?.quantity ?? payload.quantity,
        reference: data?.reference ?? payload.reference,
        length: data?.length ?? payload.length,
        width: data?.width ?? payload.width,
        height: data?.height ?? payload.height,
        net_weight: data?.net_weight ?? payload.net_weight,
      };

      // Instant local append so the new row appears without any full reload.
      setItems((prev) => [...prev, inserted]);
      resetDraft();
    } catch (error) {
      console.error('Failed to save package item', error);
      Alert.alert('Error', 'Failed to add package item.');
    } finally {
      setSaving(false);
    }
  };

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
      const { error } = await db.uploadMediaToStorage(orderPackageId, uri, 'item', notes);
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
        const { data, error } = await db.getPackageItemsByOrderPackageIds([orderPackageId]);
        if (error) {
          Alert.alert('Error', 'Failed to load package items.');
          return;
        }
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

  const columnWidths = useMemo(
    () => ({
      quantity: 90,
      designation: 180,
      reference: 160,
      length: 90,
      width: 90,
      height: 90,
      netWeight: 110,
      photo: 96,
      action: 110,
    }),
    []
  );

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
        <ScrollView horizontal keyboardShouldPersistTaps="always">
          <View style={{ minWidth: 1020 }} className="w-full">
            <View className="flex-row border-b border-gray-300">
              <CellLabel width={columnWidths.quantity} text="Quantity" />
              <CellLabel width={columnWidths.designation} text="Designation" />
              <CellLabel width={columnWidths.reference} text="Reference" />
              <CellLabel width={columnWidths.length} text="Length" />
              <CellLabel width={columnWidths.width} text="Width" />
              <CellLabel width={columnWidths.height} text="Height" />
              <CellLabel width={columnWidths.netWeight} text="Net Weight" />
              <CellLabel width={columnWidths.photo} text="Photo" />
              <CellLabel width={columnWidths.action} text="Save" />
            </View>

            {isEditable && (
              <View className="flex-row border-b border-blue-300 bg-blue-50">
                <InputCell
                  width={columnWidths.quantity}
                  value={draft.quantity}
                  onChange={(text) => updateDraft('quantity', text)}
                  placeholder="Qty"
                  keyboardType="numeric"
                  editable={isEditable && !saving}
                />
                <InputCell
                  width={columnWidths.designation}
                  value={draft.designation}
                  onChange={(text) => updateDraft('designation', text)}
                  placeholder="Designation"
                  editable={isEditable && !saving}
                />
                <InputCell
                  width={columnWidths.reference}
                  value={draft.reference}
                  onChange={(text) => updateDraft('reference', text)}
                  placeholder="Reference"
                  editable={isEditable && !saving}
                />
                <InputCell
                  width={columnWidths.length}
                  value={draft.length}
                  onChange={(text) => updateDraft('length', text)}
                  placeholder="Len"
                  keyboardType="numeric"
                  editable={isEditable && !saving}
                />
                <InputCell
                  width={columnWidths.width}
                  value={draft.width}
                  onChange={(text) => updateDraft('width', text)}
                  placeholder="Wid"
                  keyboardType="numeric"
                  editable={isEditable && !saving}
                />
                <InputCell
                  width={columnWidths.height}
                  value={draft.height}
                  onChange={(text) => updateDraft('height', text)}
                  placeholder="Hei"
                  keyboardType="numeric"
                  editable={isEditable && !saving}
                />
                <InputCell
                  width={columnWidths.netWeight}
                  value={draft.netWeight}
                  onChange={(text) => updateDraft('netWeight', text)}
                  placeholder="Net"
                  keyboardType="numeric"
                  editable={isEditable && !saving}
                />
                <View style={{ width: columnWidths.photo }} className="px-2 py-2 border-r border-blue-200 items-center justify-center">
                  <Text className="text-xs text-gray-500">After Save</Text>
                </View>
                <View style={{ width: columnWidths.action }} className="px-2 py-2 items-center justify-center">
                  <TouchableOpacity
                    onPress={saveInlineItem}
                    disabled={!isEditable || saving}
                    className={`px-3 py-1.5 rounded border ${!isEditable || saving ? 'bg-gray-100 border-gray-300' : 'bg-green-50 border-green-600'}`}
                  >
                    <Text className={`${!isEditable || saving ? 'text-gray-400' : 'text-green-700'} text-xs font-semibold`}>
                      {saving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {items.length === 0 ? (
              <View className="p-4 bg-white border-b border-gray-200">
                <Text className="text-gray-500">No items found for this box.</Text>
              </View>
            ) : (
              <View>
                {items.map((it, idx) => (
                  <View
                    key={it.id || `${it.designation || 'item'}-${idx}`}
                    className={`flex-row border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                  >
                    <DataCell width={columnWidths.quantity} value={formatNumeric(it.quantity)} />
                    <DataCell width={columnWidths.designation} value={it.designation || '—'} />
                    <DataCell width={columnWidths.reference} value={it.reference || '—'} />
                    <DataCell width={columnWidths.length} value={formatNumeric(it.length)} />
                    <DataCell width={columnWidths.width} value={formatNumeric(it.width)} />
                    <DataCell width={columnWidths.height} value={formatNumeric(it.height)} />
                    <DataCell width={columnWidths.netWeight} value={formatNumeric(it.net_weight)} />
                    <View style={{ width: columnWidths.photo }} className="px-2 py-2 border-r border-gray-200 items-center justify-center">
                      <TouchableOpacity
                        onPress={() => handleCameraPress(it)}
                        className="w-10 h-10 rounded bg-blue-600 items-center justify-center"
                        activeOpacity={0.8}
                        accessibilityLabel="Attach images"
                      >
                        <Camera size={22} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                    <View style={{ width: columnWidths.action }} className="px-2 py-2 items-center justify-center">
                      <Text className="text-xs text-gray-500">Saved</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default OrderPackingItems;
