import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, SafeAreaView, Platform, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Sharing from 'expo-sharing';
import { Inbox, Trash2, Plus, RefreshCw, FileText, Printer, Eye, ScanQrCode, X, Share2, Info } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { db } from '../../../../../utils/api/supabase';
import CatalogBrowserModal from './CatalogBrowserModal';
import { chooseQrPrintSizePreset } from './qrPrintPresets';

interface OrderItemsSectionProps {
  orderId: string;
  orderPackageId: string;
  clientId: string;

  orderPkgInstanceId?: string | null;
  editable?: boolean;
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
    <View className="flex-row items-center mt-2 pt-2 border-t border-gray-50">
      <View className="flex-row items-center mr-4">
        <Text className="text-[10px] font-bold text-gray-400 mr-1">L</Text>
        <TextInput
          className="w-12 text-xs text-slate-800 p-0 border-b border-gray-300 font-medium"
          value={l}
          onChangeText={setL}
          onBlur={handleBlur}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor="#cbd5e1"
        />
      </View>
      <View className="flex-row items-center mr-4">
        <Text className="text-[10px] font-bold text-gray-400 mr-1">W</Text>
        <TextInput
          className="w-12 text-xs text-slate-800 p-0 border-b border-gray-300 font-medium"
          value={w}
          onChangeText={setW}
          onBlur={handleBlur}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor="#cbd5e1"
        />
      </View>
      <View className="flex-row items-center mr-4">
        <Text className="text-[10px] font-bold text-gray-400 mr-1">H</Text>
        <TextInput
          className="w-12 text-xs text-slate-800 p-0 border-b border-gray-300 font-medium"
          value={h}
          onChangeText={setH}
          onBlur={handleBlur}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor="#cbd5e1"
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
  editable = true 
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

  const [rowWidths, setRowWidths] = useState<Record<string, number>>({});
  const [permissions, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (clientId) {
      db.getClientQrLogoUrl(clientId).then(({ data }) => {
        if (data) setClientLogoUrl(data);
      });
    }
  }, [clientId]);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await db.getOrderItemsForPackages([orderPackageId], clientId);
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      console.error('Error loading items:', e);
      Alert.alert('Load Error', 'Unable to retrieve items for this box.');
    } finally {
      setLoading(false);
    }
  }, [orderPackageId, clientId]);


  useEffect(() => {
    loadItems();
  }, [loadItems]);

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

  const resolveItemQrData = useCallback(async (maintenanceItem: any) => {
    const maintenanceItemId = maintenanceItem?.id;
    if (!maintenanceItemId) {
      throw new Error('This item does not have a valid ID for QR generation.');
    }

    const { data: token, error: tokenError } = await db.getOrCreateQrToken('item', maintenanceItemId);
    if (tokenError || !token) {
      throw new Error(tokenError?.message || 'Could not generate item QR token.');
    }

    return {
      token,
      qrUrl: buildPortalScanUrl(token),
      itemLabel: maintenanceItem?.item_num || maintenanceItem?.reference || 'item',
      itemName: maintenanceItem?.description || maintenanceItem?.reference || 'Item',
    };
  }, []);

  const handlePreviewItemQr = async (maintenanceItem: any, rowId: string) => {
    try {
      setPreviewingItemId(rowId);
      const qrData = await resolveItemQrData(maintenanceItem);
      
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
    } finally {
      setPreviewingItemId(null);
    }
  };

  const handleDirectPrintItemQr = async (maintenanceItem: any, rowId: string) => {
    if (!maintenanceItem?.id) {
      Alert.alert('Unavailable', 'This item does not have a valid ID for QR generation.');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Brother printing is not available on web.');
      return;
    }

    if (!detectedPrinter) {
      Alert.alert(
        'Connect Printer First',
        'Tap Connect Printer and select your Brother printer before printing.'
      );
      return;
    }

    try {
      const selectedPreset = await chooseQrPrintSizePreset();
      if (!selectedPreset) return;

      setPrintingItemId(rowId);
      const qrData = await resolveItemQrData(maintenanceItem);

      const brotherPrintModule = loadBrotherPrintModule();
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
          detectedPrinter?.connectionType === 'wifi'
            ? 'wifi'
            : detectedPrinter?.connectionType === 'bluetooth'
              ? 'bluetooth'
              : undefined,
        printerAddressHint: detectedPrinter?.address,
        postPrintDelayMs: 3000,
        onStatus: (status: string) => console.log(`[Brother Item Print] ${status}`),
      });

      const refreshedDetected = brotherPrintModule?.getDetectedBrotherPrinter?.() || null;
      if (refreshedDetected) {
        setDetectedPrinter(refreshedDetected);
      }

      Alert.alert('Direct Print Sent', `Item QR label (${selectedPreset.label}) sent to Brother printer for ${qrData.itemLabel}.`);
    } catch (e: any) {
      console.error('Error printing item QR with Brother SDK:', e);
      const message = String(e?.message || 'Unable to print item QR label.');
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
        Alert.alert('Direct Print Failed', message);
      }
    } finally {
      setPrintingItemId(null);
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

    const [cameraPermission, requestCameraPermission] = await useCameraPermissions();
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
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={connectPrinter}
              disabled={detectingPrinter || loading}
              className={`mr-2 px-3 py-1.5 rounded-md border ${detectedPrinter ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-100'}`}
            >
              {detectingPrinter ? (
                <ActivityIndicator size="small" color="#334155" />
              ) : (
                <Text className={`text-xs font-semibold ${detectedPrinter ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {detectedPrinter ? 'Printer Ready' : 'Connect Printer'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={loadItems} disabled={loading} className="p-1 rounded-full bg-gray-200">
            <RefreshCw size={14} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      {Platform.OS !== 'web' && (
        <View className="mb-3 bg-slate-100 border border-slate-200 rounded-md px-3 py-2">
          <Text className="text-xs text-slate-600" numberOfLines={1}>
            Printer: {formatDetectedPrinterLabel(detectedPrinter)}
          </Text>
        </View>
      )}

      {items.length === 0 ? (
        <View className="py-6 items-center bg-white rounded-md border border-dashed border-gray-300">
          <Inbox size={24} color="#94a3b8" />
          <Text className="text-gray-500 mt-2 text-sm text-center px-4">
            No items are assigned to this box yet. Browse the catalog to add items.
          </Text>
        </View>
      ) : (
        <View className="bg-white rounded-md border border-gray-200 overflow-hidden">
          {items.map((item, index) => {
            const maintenanceItem = item.item_details;
            const categoryLabel = maintenanceItem?.pkg_category?.label;
            const itemName = maintenanceItem?.description || 'Unknown Item';
            const isLegacyItem = !!item?.is_legacy_package_item;
            const canPrintOrPreview = !!maintenanceItem?.id;
            const stackActions = shouldStackRowActions(item.id, itemName);
            
            return (
              <View 
                key={item.id} 
                className={`p-3 ${index !== items.length - 1 ? 'border-b border-gray-100' : ''}`}
                onLayout={(event) => {
                  const width = Math.round(event.nativeEvent.layout.width);
                  setRowWidths((prev) => (prev[item.id] === width ? prev : { ...prev, [item.id]: width }));
                }}
              >
                <View className="flex-row flex-wrap items-start" style={{ rowGap: 8 }}>
                  <View
                    className="pr-3"
                    style={
                      stackActions
                        ? { width: '100%' }
                        : { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 190 }
                    }
                  >
                    <View className="flex-row items-center mb-1">
                      <Text className="font-semibold text-slate-800 text-sm" numberOfLines={stackActions ? 2 : 1}>
                        {itemName}
                      </Text>
                      {categoryLabel && (
                        <View className="ml-2 bg-blue-100 px-1.5 py-0.5 rounded">
                          <Text className="text-blue-800 text-[10px] font-medium">{categoryLabel}</Text>
                        </View>
                      )}
                      {isLegacyItem && (
                        <View className="ml-2 bg-amber-100 px-1.5 py-0.5 rounded">
                          <Text className="text-amber-800 text-[10px] font-medium">Legacy</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-gray-500">
                      Ref: {maintenanceItem?.reference || "N/A"} • Item #: {maintenanceItem?.item_num || "N/A"} • Qty: {item.quantity}
                    </Text>
                    {maintenanceItem?.ipac_comments && (
                      <Text className="text-xs text-orange-600 mt-1 italic" numberOfLines={1}>
                        Notes: {maintenanceItem.ipac_comments}
                      </Text>
                    )}

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

                  <View
                    className={`flex-row items-center ${stackActions ? '' : 'ml-auto'}`}
                    style={
                      stackActions
                        ? { width: '100%', justifyContent: 'flex-end' }
                        : { flexShrink: 0 }
                    }
                  >
                    {canPrintOrPreview && (
                      <TouchableOpacity
                        onPress={() => handlePreviewItemQr(maintenanceItem, item.id)}
                        className="p-2 rounded-full bg-slate-100 mr-2"
                        disabled={previewingItemId === item.id || printingItemId === item.id}
                      >
                        {previewingItemId === item.id ? (
                          <ActivityIndicator size="small" color="#475569" />
                        ) : (
                          <Eye size={16} color="#475569" />
                        )}
                      </TouchableOpacity>
                    )}

                    {canPrintOrPreview && (
                      <TouchableOpacity
                        onPress={() => handleDirectPrintItemQr(maintenanceItem, item.id)}
                        className="p-2 rounded-full bg-teal-50 mr-2"
                        disabled={printingItemId === item.id || previewingItemId === item.id}
                      >
                        {printingItemId === item.id ? (
                          <ActivityIndicator size="small" color="#0f766e" />
                        ) : (
                          <Printer size={16} color="#0f766e" />
                        )}
                      </TouchableOpacity>
                    )}

                    {editable && !isLegacyItem && (
                      <TouchableOpacity 
                        onPress={() => handleRemoveItem(item.id, isLegacyItem)}
                        className="p-2 rounded-full bg-red-50"
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
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
            className="flex-row items-center justify-center bg-emerald-600 px-4 py-2.5 rounded-md flex-1"
          >
            <ScanQrCode size={16} color="white" className="mr-1.5" />
            <Text className="text-white font-medium">Scan QR</Text>
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
    </View>
  );
};

export default OrderItemsSection;

