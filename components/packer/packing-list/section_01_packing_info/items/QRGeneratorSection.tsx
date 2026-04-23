import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, Modal, ScrollView } from 'react-native';
import { QrCode, Printer, Download, Eye } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { File, Paths } from 'expo-file-system';
import { db } from '../../../../../utils/api/supabase';
import { chooseQrPrintSizePreset } from './qrPrintPresets';

interface QRGeneratorSectionProps {
  entityType: 'package' | 'item';
  entityId: string;
  label: string;
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
      | BrotherPrintModule
      | undefined;

    if (!loaded) return null;
    return loaded;
  } catch {
    return null;
  }
};

const QRGeneratorSection: React.FC<QRGeneratorSectionProps> = ({
  entityType,
  entityId,
  label
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [directPrinting, setDirectPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [detectingPrinter, setDetectingPrinter] = useState(false);
  const [detectedPrinter, setDetectedPrinter] = useState<DetectedBrotherPrinter | null>(null);
  const [printerPickerVisible, setPrinterPickerVisible] = useState(false);
  const [printerCandidates, setPrinterCandidates] = useState<DetectedBrotherPrinter[]>([]);
  const [connectingPrinterAddress, setConnectingPrinterAddress] = useState<string | null>(null);
  const qrRef = useRef<any>(null);

  useEffect(() => {
    loadToken();
  }, [entityId, entityType]);

  const loadToken = async () => {
    try {
      setLoading(true);
      const { data, error } = await db.getOrCreateQrToken(entityType, entityId);
      if (error) {
        console.error('Error fetching QR token:', error);
      } else if (data) {
        setToken(data);
      }
    } catch (e) {
      console.error('Unexpected error loading QR token:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async () => {
    await loadToken();
  };

  const getQrBase64 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!qrRef.current) {
        reject(new Error('QR generator is not ready yet.'));
        return;
      }

      qrRef.current.toDataURL((data: string) => {
        if (!data) {
          reject(new Error('Unable to export QR image data.'));
          return;
        }
        resolve(data);
      });
    });
  };

  const downloadQRCode = async () => {
    if (!token) return;

    try {
      setDownloading(true);
      const base64 = await getQrBase64();

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${base64}`;
        link.download = `ipac-qr-${entityType}-${entityId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const file = new File(Paths.document, 'qr-downloads', `ipac-qr-${entityType}-${entityId}-${Date.now()}.png`);
      file.create({ overwrite: true, intermediates: true });
      file.write(base64, { encoding: 'base64' });

      Alert.alert('Download Complete', `QR PNG saved to:\n${file.uri}`);
    } catch (e) {
      console.error('Error downloading QR code:', e);
      Alert.alert('Error', 'Failed to download QR PNG.');
    } finally {
      setDownloading(false);
    }
  };

  const connectPrinter = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Brother printing is not available on web.');
      return;
    }

    try {
      setDetectingPrinter(true);
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
          onStatus: (status: string) => console.log(`[Brother QR Connect] ${status}`),
        });
      } else {
        const detected = await detectBrotherPrinter({
          onStatus: (status: string) => console.log(`[Brother QR Connect] ${status}`),
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
          onStatus: (status: string) => console.log(`[Brother QR Connect] ${status}`),
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
      setConnectingPrinterAddress(null);
      setDetectingPrinter(false);
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
        onStatus: (status: string) => console.log(`[Brother QR Connect] ${status}`),
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

  const directPrintQRCode = async () => {
    if (!token) return;

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

    const qrValue = buildPortalScanUrl(token);

    try {
      const selectedPreset = await chooseQrPrintSizePreset();
      if (!selectedPreset) return;

      setDirectPrinting(true);
      const qrImageBase64 = await getQrBase64();
      const brotherPrintModule = loadBrotherPrintModule();
      const printBrotherQrLabelDirect = brotherPrintModule?.printBrotherQrLabelDirect;

      if (typeof printBrotherQrLabelDirect !== 'function') {
        throw new Error(
          'Brother printer module is unavailable in this build. Install/update the Development Build and restart with expo start --dev-client.'
        );
      }

      await printBrotherQrLabelDirect(qrValue, {
        qrImageBase64,
        labelWidthMm: selectedPreset.labelWidthMm,
        moduleScale: selectedPreset.moduleScale,
        marginModules: selectedPreset.marginModules,
        logoPlacement: selectedPreset.logoPlacement,
        logoText: 'IPAC',
        caption: label,
        preferredConnection:
          detectedPrinter?.connectionType === 'wifi'
            ? 'wifi'
            : detectedPrinter?.connectionType === 'bluetooth'
              ? 'bluetooth'
              : undefined,
        printerAddressHint: detectedPrinter?.address,
        postPrintDelayMs: 3000,
        onStatus: (status: string) => console.log(`[Brother QR Section] ${status}`),
      });

      const refreshedDetected = brotherPrintModule?.getDetectedBrotherPrinter?.() || null;
      if (refreshedDetected) {
        setDetectedPrinter(refreshedDetected);
      }

      Alert.alert('Direct Print Sent', `QR label (${selectedPreset.label}) was sent to the Brother printer.`);
    } catch (e: any) {
      console.error('Error direct-printing QR code with Brother SDK:', e);
      const message = e?.message || 'Brother direct printing failed. Use Download as fallback.';
      const normalized = String(message).toLowerCase();
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
      setDirectPrinting(false);
    }
  };

  if (loading) {
    return (
      <View className="bg-white rounded-lg p-6 items-center justify-center border border-gray-200">
        <ActivityIndicator size="small" color="#0ea5e9" />
        <Text className="text-gray-500 mt-2 text-sm">Preparing QR Code...</Text>
      </View>
    );
  }

  // Fallback if no token could be generated
  if (!token) {
    return (
      <View className="bg-white rounded-lg p-6 items-center justify-center border border-gray-200">
        <QrCode size={32} color="#94a3b8" />
        <Text className="text-gray-600 font-medium mt-3">No QR code available</Text>
        <TouchableOpacity 
          onPress={handleCreateToken}
          className="mt-4 bg-blue-600 px-4 py-2 rounded-md"
        >
          <Text className="text-white font-medium">Generate QR Code</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // The actual URL built from the token
  const qrUrl = buildPortalScanUrl(token);

  return (
    <View className="bg-white rounded-lg overflow-hidden border border-gray-200">
      <View className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <QrCode size={18} color="#0f172a" className="mr-2" />
          <Text className="text-base font-bold text-slate-800">Scan Tag</Text>
        </View>
      </View>

      <View className="p-6 items-center">
        <View className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
          <QRCode
            value={qrUrl}
            size={180}
            getRef={(c) => (qrRef.current = c)}
            logo={require('../../../../../assets/adaptive-icon.png')}
            logoSize={40}
            logoBackgroundColor="white"
            logoMargin={4}
            quietZone={10}
            onError={(e: any) => console.log("QR Code generation error:", e)}
          />
        </View>
        <Text className="text-xs text-center text-gray-400 mt-4 max-w-[250px]" numberOfLines={1}>
          {token}
        </Text>
      </View>

      {Platform.OS !== 'web' && (
        <View className="px-4 pb-3 border-t border-gray-200">
          <View className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
            <Text className="text-xs text-slate-600 mb-2" numberOfLines={1}>
              Printer: {formatDetectedPrinterLabel(detectedPrinter)}
            </Text>

            <TouchableOpacity
              onPress={connectPrinter}
              disabled={detectingPrinter || directPrinting}
              className={`rounded-md px-3 py-2 items-center ${detectedPrinter ? 'bg-emerald-600' : 'bg-slate-700'}`}
            >
              {detectingPrinter ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white text-xs font-semibold">
                  {detectedPrinter ? 'Reconnect Printer' : 'Connect Printer'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View className="flex-row border-t border-gray-200">
        <TouchableOpacity 
          className="flex-1 py-3 items-center flex-row justify-center border-r border-gray-200"
          onPress={() => setPreviewVisible(true)}
        >
          <Eye size={18} color="#475569" className="mr-2" />
          <Text className="text-slate-700 font-medium">Preview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 py-3 items-center flex-row justify-center border-r border-gray-200"
          onPress={directPrintQRCode}
          disabled={directPrinting}
        >
          {directPrinting ? (
            <ActivityIndicator size="small" color="#0ea5e9" />
          ) : (
            <>
              <Printer size={18} color="#0f766e" className="mr-2" />
              <Text className="text-teal-700 font-medium">Direct Print</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          className="flex-1 py-3 items-center flex-row justify-center"
          onPress={downloadQRCode}
          disabled={downloading}
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <>
              <Download size={18} color="#2563eb" className="mr-2" />
              <Text className="text-blue-700 font-medium">Download</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={printerPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPrinterPickerVisible(false);
          setPrinterCandidates([]);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', paddingHorizontal: 24 }}>
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
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View className="bg-white rounded-xl p-5 items-center">
            <Text className="text-base font-bold text-slate-900 mb-3">QR Preview</Text>
            <QRCode value={qrUrl} size={240} quietZone={10} />
            <Text className="text-xs text-gray-500 mt-3 text-center" numberOfLines={2}>{qrUrl}</Text>

            <TouchableOpacity
              onPress={() => setPreviewVisible(false)}
              className="mt-5 bg-slate-900 rounded-md px-4 py-2"
            >
              <Text className="text-white font-medium">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default QRGeneratorSection;
