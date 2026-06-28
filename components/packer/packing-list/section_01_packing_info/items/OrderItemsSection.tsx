import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, SafeAreaView, Platform, ScrollView, KeyboardAvoidingView } from 'react-native';
import { CachedImage } from '../../../../ui/CachedImage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Inbox, Trash2, Plus, RefreshCw, FileText, Printer, Eye, ScanQrCode, X, Share2, Info, Camera } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { db } from '../../../../../utils/api/supabase';
import QtyAllocationModal from './QtyAllocationModal';
import CatalogBrowserModal from './CatalogBrowserModal';
import { chooseQrPrintSizePreset } from './qrPrintPresets';
import CustomPrintModal from '../../common/CustomPrintModal';
import { SplitThumbnail } from '../../common/SplitThumbnail';

interface OrderItemsSectionProps {
  orderId: string;
  orderPackageId: string;
  clientId: string;

  orderPkgInstanceId?: string | null;
  editable?: boolean;
  detectedPrinter?: DetectedBrotherPrinter | null;
  destination?: string | null;
  /** Standard box: the catalog picker draws from the destination allocation pool. */
  isStandardBox?: boolean;
}

const normalizePortalBaseUrl = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'https://ipac-admin.vercel.app';

  return trimmed
    .replace(/\/portal\/projects\/?$/i, '')
    .replace(/\/+$/, '');
};

const PORTAL_BASE_URL = normalizePortalBaseUrl(
  process.env.EXPO_PUBLIC_PORTAL_BASE_URL || 'https://ipac-admin.vercel.app'
);
const buildPortalScanUrl = (token: string) => `${PORTAL_BASE_URL}/portal/scan/${encodeURIComponent(token)}`;
const ACTIONS_INLINE_MIN_ROW_WIDTH = 760;
const LONG_ITEM_NAME_THRESHOLD = 72;

type DetectedBrotherPrinter = {
  modelName: string;
  address: string;
  serialNumber?: string;
  connectionType: 'bluetooth' | 'wifi' | 'unknown';
};

type BrotherPrintModule = {
  listBrotherPrinters?: (options?: any) => Promise<DetectedBrotherPrinter[]>;
  detectBrotherPrinter?: (options?: any) => Promise<DetectedBrotherPrinter>;
  getDetectedBrotherPrinter?: () => DetectedBrotherPrinter | null;
  printBrotherQrLabelDirect?: (qrValue: string, options?: any) => Promise<void>;
};

const formatDetectedPrinterLabel = (printer: DetectedBrotherPrinter | null): string => {
  if (!printer) return 'Not connected';
  return `${printer.modelName} (${printer.address})`;
};

const loadBrotherPrintModule = (): BrotherPrintModule | null => {
  try {
    const loaded = require('../../../../../utils/printing/brotherDirectPrint') as
      | {
          listBrotherPrinters: BrotherPrintModule['listBrotherPrinters'];
          detectBrotherPrinter: BrotherPrintModule['detectBrotherPrinter'];
          getDetectedBrotherPrinter: BrotherPrintModule['getDetectedBrotherPrinter'];
          printBrotherQrLabelDirect: BrotherPrintModule['printBrotherQrLabelDirect'];
          generateBrotherQrLabelPdf: (qrValue: string, options?: any) => Promise<any>;
        }
      | undefined;

    if (!loaded) return null;
    return loaded;
  } catch {
    return null;
  }
};

const parseScannedItemNumber = (rawCode: string): string | null => {
  const normalized = String(rawCode || '').trim();
  if (!normalized) return null;

  const firstSegment = normalized.split('-')[0]?.trim() || '';
  const cleaned = firstSegment.replace(/\s+/g, '');
  return cleaned || null;
};

const parseScannedDefaultBin = (rawCode: string): string | null => {
  const normalized = String(rawCode || '').trim();
  if (!normalized) return null;

  const segments = normalized.split('-');
  if (segments.length < 2) return null;

  const fallbackSegment = segments.slice(1).join('-').trim();
  const cleaned = fallbackSegment.replace(/\s+/g, '');
  return cleaned || null;
};

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

interface DimensionInputsProps {
  itemId: string;
  initialLength: number | null;
  initialWidth: number | null;
  initialHeight: number | null;
  onUpdate: (dims: { length: number | null; width: number | null; height: number | null }) => Promise<void>;
}

const DimensionInputs: React.FC<DimensionInputsProps> = ({ 
  itemId, 
  initialLength, 
  initialWidth, 
  initialHeight, 
  onUpdate 
}) => {
  const [l, setL] = useState(initialLength ? String(initialLength) : '');
  const [w, setW] = useState(initialWidth ? String(initialWidth) : '');
  const [h, setH] = useState(initialHeight ? String(initialHeight) : '');
  const [saving, setSaving] = useState(false);

  // Focus chaining: L → W → H
  const wInputRef = useRef<TextInput>(null);
  const hInputRef = useRef<TextInput>(null);

  const handleBlur = async () => {
    const nextL = toFiniteNumberOrNull(l);
    const nextW = toFiniteNumberOrNull(w);
    const nextH = toFiniteNumberOrNull(h);

    if (nextL === initialLength && nextW === initialWidth && nextH === initialHeight) return;

    setSaving(true);
    try {
      await onUpdate({ length: nextL, width: nextW, height: nextH });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-row items-center mt-1">
      <View className="flex-row items-center mr-4">
        <Text className="text-[10px] font-bold text-gray-400 mr-1">L</Text>
        <TextInput
          disableFullscreenUI
          className="w-12 text-xs text-slate-800 p-0 border-b border-gray-300 font-medium"
          value={l}
          onChangeText={setL}
          onBlur={handleBlur}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor="#cbd5e1"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => wInputRef.current?.focus()}
        />
      </View>
      <View className="flex-row items-center mr-4">
        <Text className="text-[10px] font-bold text-gray-400 mr-1">W</Text>
        <TextInput
          ref={wInputRef}
          disableFullscreenUI
          className="w-12 text-xs text-slate-800 p-0 border-b border-gray-300 font-medium"
          value={w}
          onChangeText={setW}
          onBlur={handleBlur}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor="#cbd5e1"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => hInputRef.current?.focus()}
        />
      </View>
      <View className="flex-row items-center mr-4">
        <Text className="text-[10px] font-bold text-gray-400 mr-1">H</Text>
        <TextInput
          ref={hInputRef}
          disableFullscreenUI
          className="w-12 text-xs text-slate-800 p-0 border-b border-gray-300 font-medium"
          value={h}
          onChangeText={setH}
          onBlur={handleBlur}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor="#cbd5e1"
          returnKeyType="done"
        />
      </View>
      {saving && <ActivityIndicator size="small" color="#0ea5e9" className="ml-auto" />}
    </View>
  );
};

const OrderItemsSection: React.FC<OrderItemsSectionProps> = ({ 
  orderId,
  orderPackageId, 
  clientId, 
  orderPkgInstanceId = null,
  editable = true,
  detectedPrinter: propDetectedPrinter = null,
  destination = null,
  isStandardBox = false
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [assigningFromScan, setAssigningFromScan] = useState(false);
  const [scannedCatalogItem, setScannedCatalogItem] = useState<any | null>(null);
  const [scanQuantityInput, setScanQuantityInput] = useState('1');
  const [lastScannedItemNumber, setLastScannedItemNumber] = useState('');
  const [scannedCatalogCandidates, setScannedCatalogCandidates] = useState<any[]>([]);
  const [previewingItemId, setPreviewingItemId] = useState<string | null>(null);
  const [printingItemId, setPrintingItemId] = useState<string | null>(null);
  const [detectedPrinter, setDetectedPrinter] = useState<DetectedBrotherPrinter | null>(null);
  const [printerPickerVisible, setPrinterPickerVisible] = useState(false);
  const [printerCandidates, setPrinterCandidates] = useState<DetectedBrotherPrinter[]>([]);
  const [connectingPrinterAddress, setConnectingPrinterAddress] = useState<string | null>(null);
  const [detectingPrinter, setDetectingPrinterLoading] = useState(false);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);

  const [manualItemModalVisible, setManualItemModalVisible] = useState(false);
  const [manualItemSaving, setManualItemSaving] = useState(false);
  const [manualItemDesignation, setManualItemDesignation] = useState('');
  const [manualItemQty, setManualItemQty] = useState('1');
  const [manualItemLength, setManualItemLength] = useState('');
  const [manualItemWidth, setManualItemWidth] = useState('');
  const [manualItemHeight, setManualItemHeight] = useState('');
  // Focus chaining for the manual-item dimensions row
  const manualWidthRef = useRef<TextInput>(null);
  const manualHeightRef = useRef<TextInput>(null);

  const [itemMediaModalVisible, setItemMediaModalVisible] = useState(false);
  const [selectedItemForMedia, setSelectedItemForMedia] = useState<any | null>(null);
  const [itemMedia, setItemMedia] = useState<any[]>([]);
  const [loadingItemMedia, setLoadingItemMedia] = useState(false);

  const [rowWidths, setRowWidths] = useState<Record<string, number>>({});
  const [enlargedImage, setEnlargedImage] = useState<{ uri: string; cacheKey?: string } | null>(null);
  const [permissions, requestPermission] = useCameraPermissions();
  const [customPrintModalVisible, setCustomPrintModalVisible] = useState(false);
  const [selectedItemForCustomPrint, setSelectedItemForCustomPrint] = useState<{item: any, rowId: string, outerItem: any} | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [itemMediaCounts, setItemMediaCounts] = useState<Record<string, number>>({});

  // Compact quantity pop-up ([input]/max with a request-more morph). 'edit' sets a row's
  // quantity; 'confirm' flips a planned shadow (is_confirmed=false) to packed. Both share
  // QtyAllocationModal so the max display + request-more flow live in one place.
  const [qtyModalItem, setQtyModalItem] = useState<any | null>(null);
  const [qtyModalMode, setQtyModalMode] = useState<'edit' | 'confirm'>('edit');
  // pkd_item id currently being confirmed via the one-tap CONFIRM PACKED button.
  const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) {
      db.getClientQrLogoUrl(clientId).then(({ data }) => {
        if (data) setClientLogoUrl(data);
      });
    }
  }, [clientId]);

  const loadMediaCounts = useCallback(async () => {
    try {
      const { data, error } = await db.query
        .from('media')
        .select('pkd_item_id')
        .eq('order_package_id', orderPackageId);
      
      if (!error && data) {
        const counts: Record<string, number> = {};
        data.forEach(m => {
          if (m.pkd_item_id) {
            counts[m.pkd_item_id] = (counts[m.pkd_item_id] || 0) + 1;
          }
        });
        setItemMediaCounts(counts);
      }
    } catch (e) {
      console.warn('Error loading media counts:', e);
    }
  }, [orderPackageId]);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      // Pass the current instance ID so we only fetch pkd_items for THIS instance,
      // not all instances in the package.
      const instanceFilter = orderPkgInstanceId ? [orderPkgInstanceId] : undefined;
      const { data, error } = await db.getOrderItemsForPackages(
        [orderPackageId],
        clientId,
        instanceFilter
      );
      if (error) throw error;
      setItems(data || []);
      await loadMediaCounts();
    } catch (e: any) {
      console.error('Error loading items:', e);
      Alert.alert('Load Error', 'Unable to retrieve items for this box.');
    } finally {
      setLoading(false);
    }
  }, [orderPackageId, clientId, orderPkgInstanceId, loadMediaCounts]);


  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Open the compact qty pop-up: 'edit' to set the quantity, 'confirm' to pack a shadow.
  const openQtyModal = (item: any, mode: 'edit' | 'confirm') => {
    setQtyModalMode(mode);
    setQtyModalItem(item);
  };

  // One-tap confirm: pack a shadow at its CURRENT quantity (already set via the QTY cell)
  // without re-prompting. confirmPackedItem caps server-side and returns a guiding error
  // when over the destination cap — adjust via the QTY cell (which has the request-more flow).
  const handleConfirmPacked = async (item: any) => {
    if (!item?.id || confirmingItemId) return;
    setConfirmingItemId(item.id);
    try {
      const { error } = await db.confirmPackedItem(item.id);
      if (error) {
        Alert.alert(
          'Could not confirm',
          (error as any)?.message ||
            'Failed to confirm. Tap the QTY box to adjust the amount or request more.',
        );
        return;
      }
      await loadItems();
    } catch (e) {
      console.error('Confirm packed error:', e);
      Alert.alert('Error', 'An unexpected error occurred while confirming.');
    } finally {
      setConfirmingItemId(null);
    }
  };

  const prepareScannedItemForAssignment = useCallback((catalogItem: any) => {
    const remainingQty = getRemainingExpectedQty(catalogItem);
    const suggestedQty = remainingQty !== null
      ? remainingQty
      : Number(catalogItem?.expected_qty ?? 1);
    const safeQty = Number.isFinite(suggestedQty) && suggestedQty > 0 ? suggestedQty : 1;
    setScannedCatalogItem(catalogItem);
    setScanQuantityInput(String(safeQty));
  }, []);

  const shouldStackRowActions = useCallback((rowId: string, itemName?: string | null) => {
    const width = rowWidths[rowId] ?? Number.MAX_SAFE_INTEGER;
    const compactRow = width < ACTIONS_INLINE_MIN_ROW_WIDTH;
    const longName = String(itemName || '').trim().length >= LONG_ITEM_NAME_THRESHOLD;
    return compactRow || longName;
  }, [rowWidths]);

  const resolveItemQrData = useCallback(async (maintenanceItem: any, pkdItemId: string, customText?: string) => {
    if (!pkdItemId) {
      throw new Error('This item does not have a valid packed instance ID for QR generation.');
    }

    // Use pkd_item.id with 'pkd_item' entity type — each physical instance gets its own unique token
    const { data: token, error: tokenError } = await db.getOrCreateQrToken('pkd_item', pkdItemId);
    if (tokenError || !token) {
      throw new Error(tokenError?.message || 'Could not generate item QR token.');
    }

    const defaultLabel = maintenanceItem?.order_pkg_instance?.ipac_reference || maintenanceItem?.item_num || maintenanceItem?.reference || 'item';

    return {
      token,
      qrUrl: buildPortalScanUrl(token),
      itemLabel: customText || defaultLabel,
      itemName: maintenanceItem?.description || maintenanceItem?.reference || 'Item',
    };
  }, []);

  const handlePreviewItemQr = async (maintenanceItem: any, rowId: string, customText?: string) => {
    try {
      setPreviewingItemId(rowId);
      const qrData = await resolveItemQrData(maintenanceItem, rowId, customText);
      
      const selectedPreset = await chooseQrPrintSizePreset();
      if (!selectedPreset) return;

      const brotherPrintModule = loadBrotherPrintModule();
      if (!brotherPrintModule?.generateBrotherQrLabelPdf) {
          throw new Error('PDF generation module is unavailable.');
      }

      const pdfData = await brotherPrintModule.generateBrotherQrLabelPdf(qrData.qrUrl, {
          labelWidthMm: selectedPreset.labelWidthMm,
          moduleScale: selectedPreset.moduleScale,
          marginModules: selectedPreset.marginModules,
          logoUrl: clientLogoUrl || undefined,
          layout: 'qr-with-caption-beside',
          caption: qrData.itemLabel,
      });

      await Sharing.shareAsync(pdfData.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Technical Preview: ${qrData.itemLabel}`,
      });

    } catch (e: any) {
      console.error('Error previewing item QR:', e);
      Alert.alert('Preview Failed', e?.message || 'Unable to prepare item QR preview.');
      throw e;
    } finally {
      setPreviewingItemId(null);
    }
  };

  const handleDirectPrintItemQr = async (maintenanceItem: any, rowId: string, customText?: string) => {
    if (!maintenanceItem?.id) {
      Alert.alert('Unavailable', 'This item does not have a valid ID for QR generation.');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Brother printing is not available on web.');
      return;
    }

    // Use the globally connected printer (prop) first, fall back to local state, then check native module state
    const brotherPrintModule = loadBrotherPrintModule();
    const activePrinter = propDetectedPrinter || detectedPrinter || 
      (typeof brotherPrintModule?.getDetectedBrotherPrinter === 'function' ? brotherPrintModule.getDetectedBrotherPrinter() : null);

    if (!activePrinter) {
      Alert.alert(
        'Connect Printer First',
        'Use the Connect Printer button at the top of the packing list, then retry.'
      );
      return;
    }

    try {
      const selectedPreset = await chooseQrPrintSizePreset();
      if (!selectedPreset) return;

      setPrintingItemId(rowId);
      const qrData = await resolveItemQrData(maintenanceItem, rowId, customText);

      const printBrotherQrLabelDirect = brotherPrintModule?.printBrotherQrLabelDirect;

      if (typeof printBrotherQrLabelDirect !== 'function') {
        throw new Error(
          'Brother printer module is unavailable in this build. Install/update the Development Build and restart with expo start --dev-client.'
        );
      }

      await printBrotherQrLabelDirect(qrData.qrUrl, {
        labelWidthMm: selectedPreset.labelWidthMm,
        moduleScale: selectedPreset.moduleScale,
        marginModules: selectedPreset.marginModules,
        logoUrl: clientLogoUrl || undefined,
        layout: 'qr-with-caption-beside',
        caption: qrData.itemLabel,
        preferredConnection:
          activePrinter?.connectionType === 'wifi'
            ? 'wifi'
            : activePrinter?.connectionType === 'bluetooth'
              ? 'bluetooth'
              : undefined,
        printerAddressHint: activePrinter?.address,
        postPrintDelayMs: 3000,
        onStatus: (status: string) => console.log(`[Brother Item Print] ${status}`),
      });

      Alert.alert('Direct Print Sent', `Item QR label (${selectedPreset.label}) sent to Brother printer for ${qrData.itemLabel}.`);
    } catch (e: any) {
      console.error('Error printing item QR with Brother SDK:', e);
      const message = String(e?.message || 'Unable to print item QR label.');
      Alert.alert('Print Failed', message);
      throw e;
    } finally {
      setPrintingItemId(null);
    }
  };

  const handleAddItemPhoto = async (itemId: string, itemName: string, isLegacy: boolean) => {
    Alert.alert(
      'Add Photo',
      'Choose a source',
      [
        {
          text: 'Camera',
          onPress: () => handleTakePhotoForItem(itemId, itemName, isLegacy)
        },
        {
          text: 'Gallery',
          onPress: () => handlePickPhotoForItem(itemId, itemName, isLegacy)
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleTakePhotoForItem = async (itemId: string, itemName: string, isLegacy: boolean) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadItemAsset(res.assets[0].uri, itemId, itemName, isLegacy);
    }
  };

  const handlePickPhotoForItem = async (itemId: string, itemName: string, isLegacy: boolean) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Gallery access is needed.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, selectionLimit: 1 });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadItemAsset(res.assets[0].uri, itemId, itemName, isLegacy);
    }
  };

  const uploadItemAsset = async (uri: string, itemId: string, itemName: string, isLegacy: boolean) => {
    try {
      setLoading(true);
      const notes = `Item: ${itemName}`;
      const mappingIds = isLegacy 
        ? { packageItemId: itemId, orderPkgInstanceId } 
        : { pkdItemId: itemId, orderPkgInstanceId };

      const { error } = await db.uploadMediaToStorage(
        orderPackageId, 
        uri, 
        'item', 
        notes,
        mappingIds
      );
      if (error) {
        Alert.alert('Upload failed', 'Could not upload item image.');
      } else {
        await loadItems();
        Alert.alert('Uploaded', 'Image linked to item successfully.');
      }
    } catch (e) {
      Alert.alert('Upload error', 'Unexpected error while uploading item image.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMediaManager = async (item: any) => {
    setSelectedItemForMedia(item);
    setLoadingItemMedia(true);
    setItemMediaModalVisible(true);
    try {
      const { data, error } = await db.getItemMedia(item.id);
      if (error) throw error;
      setItemMedia(data || []);
    } catch (e) {
      console.error('Error loading item media:', e);
      Alert.alert('Error', 'Unable to load photos for this item.');
    } finally {
      setLoadingItemMedia(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await db.deleteMedia(mediaId);
              if (error) throw error;
              setItemMedia((prev) => prev.filter((m) => m.id !== mediaId));
              await loadItems(); // Refresh thumbnails
            } catch (e) {
              Alert.alert('Error', 'Failed to delete photo.');
            }
          },
        },
      ]
    );
  };

  const handleSaveManualItem = async () => {
    if (!manualItemDesignation.trim()) {
      Alert.alert('Missing Name', 'Please enter an item name/designation.');
      return;
    }

    const qty = Number(manualItemQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Validation', 'Please enter a quantity greater than 0.');
      return;
    }

    try {
      setManualItemSaving(true);
      // 1. Create ad-hoc item in items_db
      const { data: catalogItem, error: catalogError } = await db.createAdHocItem({
        clientId,
        description: manualItemDesignation.trim(),
        quantity: qty,
        length: Number(manualItemLength) || undefined,
        width: Number(manualItemWidth) || undefined,
        height: Number(manualItemHeight) || undefined,
      });

      if (catalogError || !catalogItem?.id) throw catalogError || new Error('Failed to create item');

      // 2. Assign to package
      const { error: assignError } = await db.assignItemToPackage(
        catalogItem.id,
        orderPackageId,
        Number(manualItemQty) || 1,
        orderPkgInstanceId || undefined
      );

      if (assignError) throw assignError;

      setManualItemModalVisible(false);
      // Reset form
      setManualItemDesignation('');
      setManualItemQty('1');
      setManualItemLength('');
      setManualItemWidth('');
      setManualItemHeight('');

      await loadItems();
      Alert.alert('Success', 'Item added to box.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add manual item.');
    } finally {
      setManualItemSaving(false);
    }
  };

  const connectPrinter = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Brother printing is not available on web.');
      return;
    }

    try {
      setDetectingPrinterLoading(true);
      const brotherPrintModule = loadBrotherPrintModule();

      const listBrotherPrinters = brotherPrintModule?.listBrotherPrinters;
      const detectBrotherPrinter = brotherPrintModule?.detectBrotherPrinter;

      if (typeof detectBrotherPrinter !== 'function') {
        throw new Error(
          'Brother printer module is unavailable in this build. Install/update the Development Build and restart with expo start --dev-client.'
        );
      }

      let discoveredPrinters: DetectedBrotherPrinter[] = [];

      if (typeof listBrotherPrinters === 'function') {
        discoveredPrinters = await listBrotherPrinters({
          onStatus: (status: string) => console.log(`[Brother Items Connect] ${status}`),
        });
      } else {
        const detected = await detectBrotherPrinter({
          onStatus: (status: string) => console.log(`[Brother Items Connect] ${status}`),
        });
        discoveredPrinters = detected ? [detected] : [];
      }

      if (!discoveredPrinters.length) {
        Alert.alert(
          'No Brother Printer Found',
          'No Brother-compatible printer was discovered. Ensure the printer is on and nearby, then retry.'
        );
        return;
      }

      if (discoveredPrinters.length === 1) {
        const candidate = discoveredPrinters[0];
        setConnectingPrinterAddress(candidate.address);
        const detected = await detectBrotherPrinter({
          printerAddressHint: candidate.address,
          preferredConnection:
            candidate.connectionType === 'wifi'
              ? 'wifi'
              : candidate.connectionType === 'bluetooth'
                ? 'bluetooth'
                : undefined,
          onStatus: (status: string) => console.log(`[Brother Items Connect] ${status}`),
        });
        setDetectedPrinter(detected);
        Alert.alert('Printer Connected', `Connected to ${formatDetectedPrinterLabel(detected)}.`);
        return;
      }

      setPrinterCandidates(discoveredPrinters);
      setPrinterPickerVisible(true);
    } catch (e: any) {
      console.error('Error connecting to Brother printer:', e);
      const message = String(e?.message || 'Unable to connect to Brother printer.');
      const normalized = message.toLowerCase();
      if (
        normalized.includes('expo go') ||
        normalized.includes('development build') ||
        normalized.includes('native module')
      ) {
        Alert.alert(
          'Dev Build Required',
          'Brother printing requires a Development Build. Build/install a Dev Client and run with expo start --dev-client.'
        );
      } else {
        Alert.alert('Connection Failed', message);
      }
    } finally {
      setDetectingPrinterLoading(false);
      setConnectingPrinterAddress(null);
    }
  };

  const handleConnectSpecificPrinter = async (candidate: DetectedBrotherPrinter) => {
    if (Platform.OS === 'web') return;

    try {
      setConnectingPrinterAddress(candidate.address);
      const brotherPrintModule = loadBrotherPrintModule();
      const detectBrotherPrinter = brotherPrintModule?.detectBrotherPrinter;

      if (typeof detectBrotherPrinter !== 'function') {
        throw new Error(
          'Brother printer module is unavailable in this build. Install/update the Development Build and restart with expo start --dev-client.'
        );
      }

      const detected = await detectBrotherPrinter({
        printerAddressHint: candidate.address,
        preferredConnection:
          candidate.connectionType === 'wifi'
            ? 'wifi'
            : candidate.connectionType === 'bluetooth'
              ? 'bluetooth'
              : undefined,
        onStatus: (status: string) => console.log(`[Brother Items Connect] ${status}`),
      });

      setDetectedPrinter(detected);
      setPrinterPickerVisible(false);
      setPrinterCandidates([]);
      Alert.alert('Printer Connected', `Connected to ${formatDetectedPrinterLabel(detected)}.`);
    } catch (e: any) {
      console.error('Error connecting to selected Brother printer:', e);
      Alert.alert('Connection Failed', String(e?.message || 'Unable to connect to selected printer.'));
    } finally {
      setConnectingPrinterAddress(null);
    }
  };

  const openScanModal = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Camera scanning is not available on web.');
      return;
    }

    if (!permissions?.granted) {
      const response = await requestPermission();
      if (!response.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to scan item QR codes.');
        return;
      }
    }


    setScannerBusy(false);
    setScannerVisible(true);
  };

  const handleScannedCode = async (rawCode: string) => {
    const itemNumber = parseScannedItemNumber(rawCode);
    const defaultBin = parseScannedDefaultBin(rawCode);
    if (!itemNumber) {
      Alert.alert('Invalid QR Format', 'Expected format: itemNo-batchNo. Please scan again.');
      return;
    }

    setLastScannedItemNumber(itemNumber);

    const { data: catalogItems, error } = await db.getItemCatalogByNumber(
      clientId,
      itemNumber,
      orderId
    );


    if (error) {
      throw new Error(error.message || 'Failed to search catalog by scanned item number.');
    }

    const matches = catalogItems || [];
    const availableMatches = matches.filter((candidate) => !isCatalogItemFullyPacked(candidate));

    if (availableMatches.length > 0) {
      setScannerVisible(false);

      if (availableMatches.length === 1) {
        prepareScannedItemForAssignment(availableMatches[0]);
        return;
      }

      setScannedCatalogCandidates(availableMatches);
      return;
    }

    if (matches.length > 0) {
      Alert.alert('All Packed', `Item number ${itemNumber} is fully packed and cannot be assigned again.`);
      return;
    }

    if (defaultBin) {
      const { data: fallbackMatchesRaw, error: fallbackError } = await db.getItemCatalogByBin(
        clientId,
        defaultBin,
        orderId
      );


      if (fallbackError) {
        throw new Error(fallbackError.message || 'Failed to search catalog by default bin.');
      }

      const fallbackMatches = fallbackMatchesRaw || [];
      const availableFallbackMatches = fallbackMatches.filter((candidate) => !isCatalogItemFullyPacked(candidate));

      if (availableFallbackMatches.length > 0) {
        setScannerVisible(false);

        if (availableFallbackMatches.length === 1) {
          prepareScannedItemForAssignment(availableFallbackMatches[0]);
          return;
        }

        setScannedCatalogCandidates(availableFallbackMatches);
        return;
      }

      if (fallbackMatches.length > 0) {
        Alert.alert('All Packed', `Default bin ${defaultBin} only has fully packed items and cannot be assigned.`);
        return;
      }

      Alert.alert('Item Not Found', `No catalog record found for item number ${itemNumber} or default bin ${defaultBin}.`);
      return;
    }

    Alert.alert('Item Not Found', `No catalog record found for item number ${itemNumber}.`);
  };

  const onBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannerBusy) return;

    try {
      setScannerBusy(true);
      await handleScannedCode(data);
    } catch (e: any) {
      console.error('Error handling scanned QR code:', e);
      Alert.alert('Scan Failed', e?.message || 'Unable to process scanned code.');
    } finally {
      setScannerBusy(false);
    }
  };

  const assignScannedItemToPackage = async () => {
    if (!scannedCatalogItem?.id) return;

    const qty = Number(scanQuantityInput);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Validation', 'Please enter a quantity greater than 0.');
      return;
    }

    if (isCatalogItemFullyPacked(scannedCatalogItem)) {
      Alert.alert('All Packed', 'This item is already fully packed and cannot be assigned again.');
      return;
    }

    const remainingQty = getRemainingExpectedQty(scannedCatalogItem);
    if (remainingQty !== null && qty > remainingQty) {
      Alert.alert('Validation', `Only ${remainingQty} remaining for this item. Reduce quantity to continue.`);
      return;
    }

    try {
      setAssigningFromScan(true);
      const { error } = await db.assignItemToPackage(
        scannedCatalogItem.id,
        orderPackageId,
        qty,
        orderPkgInstanceId || undefined
      );
      if (error) {
        throw new Error(error.message || 'Unable to assign scanned item to this box.');
      }

      setScannedCatalogCandidates([]);
      setScannedCatalogItem(null);
      setLastScannedItemNumber('');
      setScanQuantityInput('1');
      await loadItems();
      Alert.alert('Assigned', 'Scanned item was assigned to this box.');
    } catch (e: any) {
      console.error('Error assigning scanned item:', e);
      Alert.alert('Assignment Failed', e?.message || 'Could not assign scanned item.');
    } finally {
      setAssigningFromScan(false);
    }
  };

  const handleRemoveItem = async (maintenancePackageItemId: string, isLegacyItem: boolean = false) => {
    if (!editable) return;

    if (isLegacyItem) {
      Alert.alert(
        'Legacy Item',
        'This item comes from the legacy package_items table and cannot be removed from this screen.'
      );
      return;
    }
    
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from the box? It will be returned to the catalog and marked as unassigned.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await db.unassignItemFromPackage(maintenancePackageItemId);
            if (error) {
              Alert.alert('Error', 'Failed to remove item');
              setLoading(false);
            } else {
              await loadItems();
            }
          }
        }
      ]
    );
  };

  const handleUpdateMasterDimensions = async (itemId: string, dims: { length: number | null; width: number | null; height: number | null }) => {
    try {
      const { error } = await db.updateItemDimensions(itemId, dims);
      if (error) {
        Alert.alert('Update Failed', 'Master catalog record could not be updated.');
      }
    } catch (e) {
      console.error('Master update error:', e);
    }
  };

  if (loading && items.length === 0) {
    return (
      <View className="py-4 justify-center items-center">
        <ActivityIndicator size="small" color="#0ea5e9" />
        <Text className="text-gray-500 mt-2 text-sm">Loading items...</Text>
      </View>
    );
  }

  return (
    <View className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center">
          <Inbox size={18} color="#0f172a" className="mr-2" />
          <Text className="text-sm font-bold text-slate-800">Box Items</Text>
          <View className="flex-row items-center gap-x-2">
            <TouchableOpacity
              onPress={loadItems}
              className="p-1 px-2 flex-row items-center bg-slate-100 rounded-md"
            >
              <RefreshCw size={14} color="#64748b" className={loading ? 'animate-spin' : ''} />
              <Text className="text-[10px] ml-1 text-slate-600">Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCatalogVisible(true)}
              className="p-1 px-2 flex-row items-center bg-blue-50 rounded-md border border-blue-100"
            >
              <Info size={14} color="#2563eb" />
              <Text className="text-[10px] ml-1 text-blue-700">Items DB</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-slate-200 ml-2 px-2 py-0.5 rounded-full">
            <Text className="text-slate-700 text-xs font-semibold">{items.length}</Text>
          </View>
        </View>
        <View className="flex-row items-center">
          <TouchableOpacity onPress={loadItems} disabled={loading} className="p-1 rounded-full bg-gray-200">
            <RefreshCw size={14} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>


      {items.length === 0 ? (
        <View className="py-6 items-center bg-white rounded-md border border-dashed border-gray-300">
          <Inbox size={24} color="#94a3b8" />
          <Text className="text-gray-500 mt-2 text-sm text-center px-4">
            No items are assigned to this box yet. Browse the catalog to add items.
          </Text>
        </View>
      ) : (
        <View style={{ maxHeight: 380 }}>
          <ScrollView 
            nestedScrollEnabled={true} 
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {items.map((item, index) => {
            const maintenanceItem = item.item_details;
            const categoryLabel = maintenanceItem?.pkg_category?.label;
            const itemName = maintenanceItem?.description || 'Unknown Item';
            const isLegacyItem = !!item?.is_legacy_package_item;
            const canPrintOrPreview = !!maintenanceItem?.id;
            // "Shadow": planned at order-create but not yet confirmed as physically packed.
            const isShadow = item?.is_confirmed === false && !isLegacyItem;

            return (
              <View
                key={item.id}
                className={`flex-row rounded-md mb-3 overflow-hidden shadow-sm border ${
                  isShadow
                    ? 'bg-amber-50/40 border-amber-300 border-dashed opacity-90'
                    : 'bg-white border-gray-300'
                }`}
              >
                {/* 1. NO. Column */}
                <View className="w-10 items-center justify-center border-r border-gray-300 bg-gray-100/50">
                  <Text className="text-[10px] font-bold text-gray-500">{index + 1}</Text>
                </View>

                {/* 2. QTY Column — tap to open the compact qty pop-up ([input]/max). */}
                <View className="w-14 items-center justify-center border-r border-gray-300">
                  {editable && !isLegacyItem ? (
                    <TouchableOpacity
                      onPress={() => openQtyModal(item, 'edit')}
                      className="px-2 py-1 bg-blue-50/70 border border-blue-200 rounded items-center"
                    >
                      <Text className="text-base font-bold text-slate-900 text-center">{item.quantity}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text className="text-base font-bold text-slate-900">{item.quantity}</Text>
                  )}
                  <Text className="text-[8px] text-gray-500 uppercase font-black">Qty</Text>
                </View>

                {/* 3. MAIN CONTENT AREA */}
                <View className="flex-1 p-2">
                  {/* TOP ROW: Item info + Remove */}
                  <View className="flex-row items-center mb-2">
                    <View className="flex-1 flex-row items-center flex-wrap" style={{ columnGap: 12 }}>
                      <View>
                        <Text className="text-[9px] text-gray-400 uppercase font-bold">Item No.</Text>
                        <Text className="text-xs font-semibold text-slate-700">{maintenanceItem?.item_num || "N/A"}</Text>
                      </View>
                      <View>
                        <Text className="text-[9px] text-gray-400 uppercase font-bold">Ref</Text>
                        <Text className="text-xs font-semibold text-slate-700">{maintenanceItem?.reference || "N/A"}</Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => setExpandedRows(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        activeOpacity={0.7}
                        className="flex-1 min-w-[120px]"
                      >
                        <Text className="text-[9px] text-gray-400 uppercase font-bold">Name of Item</Text>
                        <Text className="text-[13px] font-bold text-slate-800" numberOfLines={expandedRows[item.id] ? undefined : 1}>
                          {itemName}
                        </Text>
                      </TouchableOpacity>
                      {isShadow && (
                        <View className="bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 self-end mb-0.5">
                          <Text className="text-amber-800 text-[8px] font-black">PLANNED · NOT PACKED</Text>
                        </View>
                      )}
                      {categoryLabel && (
                        <View className="bg-blue-50 px-1 py-0.5 rounded border border-blue-100 self-end mb-0.5">
                          <Text className="text-blue-700 text-[8px] font-bold">{categoryLabel}</Text>
                        </View>
                      )}
                    </View>

                    {editable && !isLegacyItem && (
                      <TouchableOpacity 
                        onPress={() => handleRemoveItem(item.id, isLegacyItem)}
                        className="ml-2 px-2 py-1 rounded bg-red-50 border border-red-200"
                      >
                        <Text className="text-[10px] font-bold text-red-600">REMOVE</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Horizontal Line as per drawing */}
                  <View className="h-[1px] bg-gray-200 w-full mb-2" />

                  {/* BOTTOM ROW: Dimensions + Actions */}
                  <View className="flex-row items-end">
                    <View className="flex-1">
                      {!isLegacyItem && maintenanceItem?.id && (
                        <DimensionInputs
                          itemId={maintenanceItem.id}
                          initialLength={maintenanceItem.length}
                          initialWidth={maintenanceItem.width}
                          initialHeight={maintenanceItem.height}
                          onUpdate={(dims) => handleUpdateMasterDimensions(maintenanceItem.id, dims)}
                        />
                      )}
                    </View>

                    <View className="flex-row items-center gap-x-2">
                      {isShadow && editable && (
                        <TouchableOpacity
                          onPress={() => handleConfirmPacked(item)}
                          disabled={confirmingItemId === item.id}
                          className={`px-3 py-1.5 rounded flex-row items-center ${
                            confirmingItemId === item.id ? 'bg-amber-300' : 'bg-amber-500'
                          }`}
                        >
                          {confirmingItemId === item.id ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text className="text-[10px] font-bold text-white">CONFIRM PACKED</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {canPrintOrPreview && (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedItemForCustomPrint({ item: maintenanceItem, rowId: item.id, outerItem: item });
                            setCustomPrintModalVisible(true);
                          }}
                          className="px-3 py-1.5 rounded bg-teal-50 border border-teal-100 flex-row items-center"
                          disabled={printingItemId === item.id || previewingItemId === item.id}
                        >
                          <Printer size={14} color="#0f766e" />
                          <Text className="text-[10px] font-bold text-teal-700 ml-1">PRINT</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity 
                        onPress={() => handleOpenMediaManager(item)}
                        className={`px-3 py-1.5 rounded flex-row items-center ${
                          (itemMediaCounts[item.id] || 0) > 0 
                            ? 'bg-emerald-50 border border-emerald-100' 
                            : 'bg-blue-50 border border-blue-100'
                        }`}
                      >
                        <Camera 
                          size={14} 
                          color={(itemMediaCounts[item.id] || 0) > 0 ? '#059669' : '#2563eb'} 
                          fill={(itemMediaCounts[item.id] || 0) > 0 ? '#059669' : 'transparent'}
                        />
                        <Text className={`text-[10px] font-bold ml-1 ${
                          (itemMediaCounts[item.id] || 0) > 0 ? 'text-emerald-700' : 'text-blue-700'
                        }`}>
                          {(itemMediaCounts[item.id] || 0) > 0 ? `PHOTOS (${itemMediaCounts[item.id]})` : 'ADD PIC'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
          </ScrollView>
        </View>
      )}

      {editable && (
        <View className="mt-4 flex-row justify-end space-x-2">
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="flex-row items-center justify-center bg-blue-600 px-4 py-2.5 rounded-md flex-1 mr-2"
          >
            <Plus size={16} color="white" className="mr-1.5" />
            <Text className="text-white font-medium">Browse Catalog</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openScanModal}
            className="flex-row items-center justify-center bg-emerald-600 px-4 py-2.5 rounded-md flex-1 mr-2"
          >
            <ScanQrCode size={16} color="white" className="mr-1.5" />
            <Text className="text-white font-medium">Scan QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setManualItemModalVisible(true)}
            className="flex-row items-center justify-center bg-slate-700 px-4 py-2.5 rounded-md flex-1"
          >
            <Plus size={16} color="white" className="mr-1.5" />
            <Text className="text-white font-medium">Add Manual</Text>
          </TouchableOpacity>
        </View>
      )}

      <CatalogBrowserModal
        visible={isModalVisible}
        onClose={() => setModalVisible(false)}
        clientId={clientId}
        orderId={orderId}
        orderPackageId={orderPackageId}
        orderPkgInstanceId={orderPkgInstanceId}
        onAssigned={loadItems}
        destination={destination}
        isStandardBox={isStandardBox}
      />

      {/* Confirm-packed modal for shadow (planned) items */}
      {/* Compact qty pop-up shared by the QTY cell (edit) + CONFIRM PACKED (confirm). */}
      <QtyAllocationModal
        visible={!!qtyModalItem}
        item={qtyModalItem}
        mode={qtyModalMode}
        orderPackageId={orderPackageId}
        onClose={() => setQtyModalItem(null)}
        onSaved={loadItems}
      />



      <Modal
        visible={printerPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPrinterPickerVisible(false);
          setPrinterCandidates([]);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View className="bg-white rounded-xl p-4" style={{ maxHeight: '75%' }}>
            <Text className="text-base font-bold text-slate-900">Select Brother Printer</Text>
            <Text className="text-sm text-gray-600 mt-2">
              Choose the exact printer to connect. Non-printer Bluetooth devices are excluded.
            </Text>

            <ScrollView className="mt-4" contentContainerStyle={{ paddingBottom: 8 }}>
              {printerCandidates.map((candidate) => {
                const isConnecting = connectingPrinterAddress === candidate.address;
                return (
                  <TouchableOpacity
                    key={`${candidate.address}-${candidate.modelName}-${candidate.connectionType}`}
                    onPress={() => handleConnectSpecificPrinter(candidate)}
                    disabled={!!connectingPrinterAddress}
                    className="border border-gray-200 rounded-lg p-3 mb-2"
                  >
                    <Text className="text-slate-900 font-semibold">{candidate.modelName || 'Brother Printer'}</Text>
                    <Text className="text-xs text-gray-600 mt-1">
                      {candidate.address} • {candidate.connectionType.toUpperCase()}
                    </Text>
                    {isConnecting && (
                      <View className="mt-2">
                        <ActivityIndicator size="small" color="#334155" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="mt-2 flex-row justify-end">
              <TouchableOpacity
                onPress={() => {
                  setPrinterPickerVisible(false);
                  setPrinterCandidates([]);
                }}
                disabled={!!connectingPrinterAddress}
                className="px-4 py-2 rounded-md bg-gray-100"
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-black">
          <View className="px-4 py-3 bg-slate-950 flex-row justify-between items-center">
            <View>
              <Text className="text-white font-bold text-base">Scan Item QR</Text>
              <Text className="text-slate-300 text-xs mt-1">Expected format: itemNo-batchNo</Text>
            </View>
            <TouchableOpacity onPress={() => setScannerVisible(false)} className="p-2 bg-slate-800 rounded-full">
              <X size={18} color="white" />
            </TouchableOpacity>
          </View>

          <View className="flex-1">
            {Platform.OS !== 'web' && (
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e'],
                }}
                onBarcodeScanned={scannerBusy ? undefined : onBarcodeScanned}
              />
            )}
          </View>

          <View className="px-4 py-4 bg-slate-950">
            <Text className="text-slate-300 text-xs text-center">
              Align barcode or QR inside the camera frame. We use the item number before the hyphen.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={scannedCatalogCandidates.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setScannedCatalogCandidates([])}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View className="bg-white rounded-xl p-4" style={{ maxHeight: '75%' }}>
            <Text className="text-base font-bold text-slate-900">Multiple Items Found</Text>
            <Text className="text-sm text-gray-600 mt-2">
              Item # {lastScannedItemNumber || 'N/A'} exists in multiple catalog rows. Select one to assign.
            </Text>

            <ScrollView className="mt-4" contentContainerStyle={{ paddingBottom: 8 }}>
              {scannedCatalogCandidates.map((candidate) => (
                <TouchableOpacity
                  key={candidate.id}
                  onPress={() => {
                    setScannedCatalogCandidates([]);
                    prepareScannedItemForAssignment(candidate);
                  }}
                  className="border border-gray-200 rounded-lg p-3 mb-2"
                >
                  <Text className="text-slate-900 font-semibold" numberOfLines={2}>
                    {candidate?.description || candidate?.reference || 'Catalog Item'}
                  </Text>
                  <Text className="text-xs text-gray-600 mt-1">
                    Ref: {candidate?.reference || 'N/A'} • Item #: {candidate?.item_num || 'N/A'} • Expected Qty: {candidate?.expected_qty ?? 'N/A'} • Packed: {candidate?.packed_qty ?? 0}{getRemainingExpectedQty(candidate) !== null ? ` • Remaining: ${getRemainingExpectedQty(candidate)}` : ''}
                  </Text>
                  {candidate?.ipac_comments && (
                    <Text className="text-xs text-orange-600 mt-1" numberOfLines={2}>
                      Notes: {candidate.ipac_comments}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="mt-2 flex-row justify-end">
              <TouchableOpacity
                onPress={() => {
                  setScannedCatalogCandidates([]);
                  setLastScannedItemNumber('');
                }}
                className="px-4 py-2 rounded-md bg-gray-100"
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!scannedCatalogItem}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setScannedCatalogItem(null);
          setLastScannedItemNumber('');
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View className="bg-white rounded-xl p-4">
            <Text className="text-base font-bold text-slate-900">Assign Scanned Item</Text>
            <Text className="text-sm text-gray-600 mt-2" numberOfLines={2}>
              {scannedCatalogItem?.description || scannedCatalogItem?.reference || 'Scanned catalog item'}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">Item #: {scannedCatalogItem?.item_num || 'N/A'}</Text>

            <View className="mt-4">
              <Text className="text-xs text-gray-600 mb-1 font-medium">Quantity for this box</Text>
              <TextInput
                disableFullscreenUI
                className="border border-gray-300 rounded-lg px-3 py-2 text-slate-900"
                value={scanQuantityInput}
                onChangeText={setScanQuantityInput}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#94a3b8"
                editable={!assigningFromScan}
              />
              {getRemainingExpectedQty(scannedCatalogItem) !== null && (
                <Text className="text-xs text-gray-500 mt-1">
                  Remaining available: {getRemainingExpectedQty(scannedCatalogItem)}
                </Text>
              )}
            </View>

            <View className="mt-4 flex-row justify-end">
              <TouchableOpacity
                onPress={() => {
                  setScannedCatalogItem(null);
                  setLastScannedItemNumber('');
                }}
                className="px-4 py-2 rounded-md bg-gray-100 mr-2"
                disabled={assigningFromScan}
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={assignScannedItemToPackage}
                className="px-4 py-2 rounded-md bg-blue-600"
                disabled={assigningFromScan}
              >
                {assigningFromScan ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white font-medium">Assign to Box</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={manualItemModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualItemModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}
            style={{ width: '100%' }}
          >
          <View className="bg-white rounded-2xl p-5 shadow-xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-slate-900">Add Manual Item</Text>
              <TouchableOpacity onPress={() => setManualItemModalVisible(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="space-y-4">
                <View>
                  <Text className="text-sm font-semibold text-slate-700 mb-1">Item Name / Designation</Text>
                  <TextInput
                    disableFullscreenUI
                    className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-slate-50"
                    placeholder="e.g. Spare Parts Box"
                    value={manualItemDesignation}
                    onChangeText={setManualItemDesignation}
                  />
                </View>

                <View className="flex-row space-x-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-slate-700 mb-1">Quantity</Text>
                    <TextInput
                      disableFullscreenUI
                      className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-slate-50"
                      keyboardType="numeric"
                      value={manualItemQty}
                      onChangeText={setManualItemQty}
                    />
                  </View>
                </View>

                <Text className="text-sm font-bold text-slate-800 mt-2">Dimensions (cm) - Optional</Text>
                <View className="flex-row space-x-2">
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Length</Text>
                    <TextInput
                      disableFullscreenUI
                      className="border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 bg-slate-50"
                      keyboardType="numeric"
                      placeholder="L"
                      value={manualItemLength}
                      onChangeText={setManualItemLength}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => manualWidthRef.current?.focus()}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Width</Text>
                    <TextInput
                      ref={manualWidthRef}
                      disableFullscreenUI
                      className="border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 bg-slate-50"
                      keyboardType="numeric"
                      placeholder="W"
                      value={manualItemWidth}
                      onChangeText={setManualItemWidth}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => manualHeightRef.current?.focus()}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Height</Text>
                    <TextInput
                      ref={manualHeightRef}
                      disableFullscreenUI
                      className="border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 bg-slate-50"
                      keyboardType="numeric"
                      placeholder="H"
                      value={manualItemHeight}
                      onChangeText={setManualItemHeight}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View className="mt-6 flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setManualItemModalVisible(false)}
                className="flex-1 py-3.5 rounded-xl bg-slate-100 items-center mr-2"
                disabled={manualItemSaving}
              >
                <Text className="text-slate-600 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveManualItem}
                className="flex-1 py-3.5 rounded-xl bg-blue-600 items-center shadow-md shadow-blue-200"
                disabled={manualItemSaving}
              >
                {manualItemSaving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold">Save Item</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={itemMediaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setItemMediaModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <View className="flex-row justify-between items-center px-4 py-4 border-b border-white/10">
            <View className="flex-1 pr-4">
              <Text className="text-white font-bold text-lg" numberOfLines={1}>
                {selectedItemForMedia?.item_details?.description || 'Item Photos'}
              </Text>
              <Text className="text-white/60 text-xs mt-0.5">
                {itemMedia.length} Photos total
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                handleAddItemPhoto(selectedItemForMedia.id, selectedItemForMedia?.item_details?.description || 'Item', false);
              }}
              className="w-10 h-10 items-center justify-center bg-blue-600 rounded-full mr-2"
            >
              <Camera size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setItemMediaModalVisible(false)}
              className="w-10 h-10 items-center justify-center bg-white/10 rounded-full"
            >
              <X size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View className="flex-1">
            {loadingItemMedia ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="white" />
              </View>
            ) : itemMedia.length === 0 ? (
              <View className="flex-1 items-center justify-center p-10">
                <Camera size={48} color="rgba(255,255,255,0.2)" />
                <Text className="text-white/40 mt-4 text-center">No photos added to this item yet.</Text>
              </View>
            ) : (
              <ScrollView 
                contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
              >
                {itemMedia.map((media) => (
                  <View key={media.id} className="relative" style={{ width: '47%', aspectRatio: 1 }}>
                    <CachedImage
                      uri={media.image_url}
                      cacheKey={media?.id != null ? String(media.id) : undefined}
                      style={{ width: '100%', height: '100%', borderRadius: 12 }}
                      contentFit="cover"
                    />
                    <View className="absolute top-2 right-2 flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => setEnlargedImage({ uri: media.image_url, cacheKey: media?.id != null ? String(media.id) : undefined })}
                        className="bg-blue-600 w-8 h-8 rounded-full items-center justify-center shadow-lg"
                      >
                        <Eye size={16} color="white" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteMedia(media.id)}
                        className="bg-red-600 w-8 h-8 rounded-full items-center justify-center shadow-lg"
                      >
                        <Trash2 size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Removed footer button as it was obscured and moved to header */}
        </SafeAreaView>
      </Modal>
      
      {/* Full Screen Image Modal */}
      <Modal
        visible={!!enlargedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setEnlargedImage(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity 
            className="absolute top-12 right-6 z-10 w-10 h-10 items-center justify-center bg-black/50 rounded-full"
            onPress={() => setEnlargedImage(null)}
          >
            <X size={24} color="white" />
          </TouchableOpacity>
          {enlargedImage && (
            <CachedImage
              uri={enlargedImage.uri}
              cacheKey={enlargedImage.cacheKey}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
      <CustomPrintModal
        visible={customPrintModalVisible}
        onClose={() => {
          setCustomPrintModalVisible(false);
          setSelectedItemForCustomPrint(null);
        }}
        title="Print Item Label"
        subtitle={selectedItemForCustomPrint?.item?.description || 'Item'}
        initialText={(() => {
          if (!selectedItemForCustomPrint) return '';
          const mi = selectedItemForCustomPrint.item;
          const oi = selectedItemForCustomPrint.outerItem;
          // Resolve project type prefix from tags (P- for Power, W- for Water)
          const tags: string[] = (mi?.pkg_category?.category_tag_map || []).map(
            (m: any) => String(m?.tag?.name || '').trim().toLowerCase()
          );
          const prefix = tags.some(t => t.includes('power')) ? 'P-'
            : tags.some(t => t.includes('water')) ? 'W-'
            : '';
          const itemNum = String(mi?.item_num || mi?.reference || '').trim();
          const qty = Number(oi?.quantity ?? 0);
          const qtyStr = qty > 0 ? String(qty).padStart(2, '0') : '01';
          return `${prefix}${itemNum}-QTY:${qtyStr}`;
        })()}
        onPreview={(text) => selectedItemForCustomPrint && handlePreviewItemQr(selectedItemForCustomPrint.item, selectedItemForCustomPrint.rowId, text)}
        onPrint={(text) => selectedItemForCustomPrint && handleDirectPrintItemQr(selectedItemForCustomPrint.item, selectedItemForCustomPrint.rowId, text)}
      />
    </View>
  );
};


export default OrderItemsSection;

