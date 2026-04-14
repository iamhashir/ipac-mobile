import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, Modal } from 'react-native';
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

const PORTAL_BASE_URL = 'https://ipac-admin.vercel.app';
const buildPortalScanUrl = (token: string) => `${PORTAL_BASE_URL}/portal/scan/${encodeURIComponent(token)}`;

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

  const directPrintQRCode = async () => {
    if (!token) return;

    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Direct BLE printing is not available on web.');
      return;
    }

    const qrValue = buildPortalScanUrl(token);

    try {
      const selectedPreset = await chooseQrPrintSizePreset();
      if (!selectedPreset) return;

      setDirectPrinting(true);
      const { printM220QrLabelDirect } = await import('../../../../../utils/printing/m220DirectPrint');

      await printM220QrLabelDirect(qrValue, {
        density: 6,
        feedDots: selectedPreset.feedDots,
        labelWidthMm: selectedPreset.labelWidthMm,
        moduleScale: selectedPreset.moduleScale,
        marginModules: selectedPreset.marginModules,
        dataWriteMode: 'withoutResponse',
        postPrintDelayMs: 3000,
        onStatus: (status) => console.log(`[M220 QR Section] ${status}`),
      });

      Alert.alert('Direct Print Sent', `QR label (${selectedPreset.label}) was sent to the printer.`);
    } catch (e: any) {
      console.error('Error direct-printing QR code:', e);
      const message = e?.message || 'Direct BLE printing failed. Use Share PNG as fallback.';
      if (String(message).toLowerCase().includes('expo go')) {
        Alert.alert(
          'Dev Build Required',
          'Direct BLE printing cannot run in Expo Go. Build/install a Development Client and run with expo start --dev-client.'
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
              <Text className="text-teal-700 font-medium">Direct BLE</Text>
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
