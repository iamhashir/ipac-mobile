import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Printer, Eye, X, Trash2, FileText } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { Modal, ScrollView, Image, SafeAreaView } from 'react-native';
import { SplitThumbnail } from '../common/SplitThumbnail';
import { chooseQrPrintSizePreset } from './items/qrPrintPresets';
import OrderPackingInfo, { BoxInfoDetails } from './order_packing_info';
import OrderPackingDimensions from './order_packing_dimensions';
import { DimensionsTriple } from '../common/DimensionsBox';
import OrderItemsSection from './items/OrderItemsSection';
import TwoTierEditableCard from '../common/TwoTierEditableCard';
import CustomPrintModal from '../common/CustomPrintModal';
import { PackageInfoChangeEvent } from './types';

interface BoxInfoPair {
  original: BoxInfoDetails | null;
  final: BoxInfoDetails | null;
}

interface DimensionPair { original: DimensionsTriple | null; final: DimensionsTriple | null; }

interface BoxDetailsTabProps {
  orderId: string;
  orderPackageId: string;
  orderPkgInstanceId?: string | null;
  packageNumber: number | null;
  description?: string | null;
  info?: BoxInfoPair;
  dimensions?: {
    internal: DimensionPair;
    external: DimensionPair;
  };
  originalPkgInfoId?: string | null;
  finalPkgInfoId?: string | null;
  onAttachPics?: (item: { order_package_id: string; designation: string | null; quantity: number | null }) => void;
  originalBoxTypeId?: string | null;
  finalBoxTypeId?: string | null;
  originalPackingTypeId?: string | null;
  finalPackingTypeId?: string | null;
  useSeiFlow?: boolean;
  reference?: string | null;
  instanceReference?: string | null;
  status?: string;
  isOrderCompleted?: boolean;
  projectType?: 'standard' | 'maintenance' | 'survey' | null;
  onStatusChange?: () => void;
  onReferenceChange?: (value: string | null) => Promise<void> | void;
  onDataChange?: (change: PackageInfoChangeEvent) => void;
  hidePackingItems?: boolean;
  hasPortal?: boolean;
  clientId?: string | null;
  detectedPrinter?: any;
  boxQuantity?: number | null;
  boxTypeName?: string | null;
  destination?: string | null;
}

const normalizeReferenceValue = (value: unknown): string | null => {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
};

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

const BoxDetailsTab: React.FC<BoxDetailsTabProps> = ({ orderId, orderPackageId, orderPkgInstanceId = null, packageNumber, description, info, dimensions, originalPkgInfoId, finalPkgInfoId, onAttachPics, originalBoxTypeId, finalBoxTypeId, originalPackingTypeId, finalPackingTypeId, useSeiFlow = false, reference = null, instanceReference = null, status, isOrderCompleted, projectType = 'standard', onStatusChange, onReferenceChange, onDataChange, hidePackingItems = false, hasPortal = false, clientId = null, detectedPrinter = null, boxQuantity = null, boxTypeName = null, destination = null }) => {
  const [printingBoxLabel, setPrintingBoxLabel] = useState(false);
  const [previewingBoxLabel, setPreviewingBoxLabel] = useState(false);
  const [customPrintModalVisible, setCustomPrintModalVisible] = useState(false);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [resolvedModalCaption, setResolvedModalCaption] = useState<string | null>(null);
  const isEditable = status !== 'packed' && !isOrderCompleted;
  const requiresOriginalFirst = projectType === 'maintenance' || projectType === 'survey';
  const referenceEditTarget: 'original' | 'final' = 'final';

  // Standard box: name starts with "Standard Box" OR code starts with "standardbox"
  const isCustomBox = (() => {
    if (!boxTypeName) return false; // no box type set yet — treat as standard
    const name = boxTypeName.trim().toLowerCase();
    const code = String(name || ''); // we only have boxTypeName here; code check via name
    if (name.startsWith('standard box')) return false;
    return true;
  })();

  /**
   * Builds the base label caption from the stored ipac_reference.
   * For custom boxes: replaces trailing instance-seq with QTY:{qty} (qty resolved at print time).
   * For standard boxes: replaces trailing instance-seq with Box #NN.
   * This is used as a fallback when the live qty hasn't been fetched yet.
   */
  const buildBoxLabelCaption = (liveQty?: number | null) => {
    const ref = String(instanceReference || '').trim();
    const fallbackNum = String(packageNumber ?? 1).padStart(2, '0');
    if (!ref) return isCustomBox ? `QTY:${fallbackNum}` : `Box #${fallbackNum}`;
    // Match trailing hyphen + digits (e.g. "-01", "-1", "-12")
    const match = ref.match(/^(.*?)-(\d+)$/);
    if (match) {
      const base = match[1];
      const seqNum = parseInt(match[2], 10);
      if (isCustomBox) {
        const qty = liveQty != null ? liveQty : seqNum; // use live qty if available
        return `${base}-QTY:${qty}`;
      }
      return `${base}-Box #${String(seqNum).padStart(2, '0')}`;
    }
    if (isCustomBox) {
      const qty = liveQty != null ? liveQty : Number(fallbackNum);
      return `${ref}-QTY:${qty}`;
    }
    return `${ref}-Box #${fallbackNum}`;
  };

  // Sync caption (no live qty yet — used for display only)
  const boxLabelCaption = buildBoxLabelCaption();

  React.useEffect(() => {
    if (clientId) {
      import('../../../../utils/api/supabase').then(({ db }) => {
        db.getClientQrLogoUrl(clientId).then(({ data }) => {
          if (data) setClientLogoUrl(data);
        });
      });
    }
  }, [clientId]);

  const [media, setMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const loadBoxMedia = React.useCallback(async () => {
    try {
      setLoadingMedia(true);
      const { db } = await import('../../../../utils/api/supabase');
      const { data, error } = await db.getPackageMedia(orderPackageId);
      if (!error && data) {
        setMedia(data);
      }
    } catch (err) {
      console.error('Error loading box media:', err);
    } finally {
      setLoadingMedia(false);
    }
  }, [orderPackageId]);

  React.useEffect(() => {
    loadBoxMedia();
  }, [loadBoxMedia]);

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
              const { db } = await import('../../../../utils/api/supabase');
              const { error } = await db.deleteMedia(mediaId);
              if (error) throw error;
              loadBoxMedia();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete photo');
            }
          }
        }
      ]
    );
  };

  const handleMarkComplete = async () => {
    try {
  const { supabase } = await import('../../../../utils/api/supabase');
      
      // First validate the box completion
      const { data: validation, error: validationError } = await supabase.rpc('validate_box_completion', { op_id: orderPackageId });
      
      if (validationError) {
        Alert.alert('Validation Error', 'Could not validate box completion requirements.');
        console.error('Validation error:', validationError);
        return;
      }
      
      if (!validation?.valid) {
        let errorMsg = 'Box cannot be marked as complete:\n\n';
        if (!validation?.materials_valid) {
          errorMsg += `\u2022 ${validation.materials_message}\n`;
        }
        if (!validation?.tasks_valid) {
          errorMsg += `\u2022 ${validation.tasks_message}\n`;
        }
        Alert.alert('Cannot Complete Box', errorMsg);
        return;
      }
      
      // If validation passes, mark as packed
      const { error } = await supabase.rpc('mark_order_package_packed', { op_id: orderPackageId });
      if (!error) {
        Alert.alert('Success', 'Box marked as completed!');
        onStatusChange?.();
      } else {
        console.warn('Mark complete failed:', error);
        Alert.alert('Error', 'Failed to mark box as complete.');
      }
    } catch (e) {
      console.error('Unexpected error while updating package status:', e);
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  const handleUndo = async () => {
    try {
  const { supabase } = await import('../../../../utils/api/supabase');
      const { error } = await supabase.rpc('unpack_order_package', { op_id: orderPackageId });
      if (!error) {
        onStatusChange?.();
      } else {
        console.warn('Undo failed:', error);
      }
    } catch (e) {
      console.error('Unexpected error while undoing package status:', e);
    }
  };

  const askSource = async () => {
    Alert.alert('Attach image', 'Choose source', [
      { text: 'Gallery', onPress: pickFromGallery },
      { text: 'Camera', onPress: takePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Media library access is needed.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri);
    }
  };

  const uploadAsset = async (uri: string) => {
    try {
      const { db } = await import('../../../../utils/api/supabase');
      const notes = `Package #${packageNumber || 'N/A'}`;
      const { data, error } = await db.uploadMediaToStorage(
        orderPackageId, 
        uri, 
        'package', 
        notes,
        { orderPkgInstanceId }
      );
      if (error) {
        Alert.alert('Upload failed', 'Could not upload image to storage.');
      } else {
        Alert.alert('Uploaded', 'Image uploaded successfully.');
        loadBoxMedia(); // Refresh media after upload
      }
    } catch (e) {
      Alert.alert('Upload error', 'Unexpected error while uploading.');
    }
  };

  const handlePreviewBoxLabel = async (customText?: string) => {
    if (!orderPkgInstanceId) {
      Alert.alert('Missing ID', 'This box does not have an instance ID assigned yet.');
      return;
    }

    try {
      setPreviewingBoxLabel(true);
      const { db } = await import('../../../../utils/api/supabase');

      // For custom boxes, fetch live item qty for accurate label caption
      let resolvedCaption = customText || boxLabelCaption;
      if (!customText && isCustomBox && orderPkgInstanceId) {
        const { qty } = await db.getInstancePackedItemQty(orderPkgInstanceId);
        resolvedCaption = buildBoxLabelCaption(qty > 0 ? qty : null);
      }

      const { data: token, error: tokenError } = await db.getOrCreateQrToken('package', orderPkgInstanceId);
      if (tokenError || !token) {
        throw new Error(tokenError?.message || 'Could not generate QR token for this box.');
      }

      const selectedPreset = await chooseQrPrintSizePreset();
      if (!selectedPreset) return;

      const brotherPrintModule = require('../../../../utils/printing/brotherDirectPrint') as any;
      if (!brotherPrintModule?.generateBrotherQrLabelPdf) {
        throw new Error('PDF generation module is unavailable.');
      }

      const qrUrl = buildPortalScanUrl(token);
      const pdfData = await brotherPrintModule.generateBrotherQrLabelPdf(qrUrl, {
        labelWidthMm: selectedPreset.labelWidthMm,
        moduleScale: selectedPreset.moduleScale,
        marginModules: selectedPreset.marginModules,
        logoUrl: clientLogoUrl || undefined,
        layout: 'qr-with-caption-beside',
        caption: resolvedCaption,
      });

      await Sharing.shareAsync(pdfData.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Label Preview: ${resolvedCaption || instanceReference || 'Box'}`,
      });

    } catch (e: any) {
      console.error('Error previewing box label:', e);
      Alert.alert('Preview Failed', e?.message || 'Unable to prepare box label preview.');
      throw e;
    } finally {
      setPreviewingBoxLabel(false);
    }
  };

  const handlePrintBoxLabel = async (customText?: string) => {
    if (!orderPkgInstanceId) {
      Alert.alert('Missing ID', 'This box does not have an instance ID assigned yet.');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Brother printing is not available on web.');
      return;
    }

    try {
      setPrintingBoxLabel(true);
      const brotherPrintModule = require('../../../../utils/printing/brotherDirectPrint') as {
        getDetectedBrotherPrinter?: () => {
          modelName: string;
          address: string;
          connectionType: 'bluetooth' | 'wifi' | 'unknown';
        } | null;
        printBrotherQrLabelDirect?: (qrValue: string, options?: any) => Promise<void>;
      };
      const { getDetectedBrotherPrinter, printBrotherQrLabelDirect } = brotherPrintModule;

      if (typeof printBrotherQrLabelDirect !== 'function') {
        throw new Error('Brother print module loaded but printBrotherQrLabelDirect is unavailable.');
      }

      const connectedPrinter =
        detectedPrinter ||
        (typeof getDetectedBrotherPrinter === 'function' ? getDetectedBrotherPrinter() : null);

      if (!connectedPrinter?.address) {
        Alert.alert(
          'Connect Printer First',
          'Use the Connect Printer button at the top of the packing list, then retry.'
        );
        return;
      }

      const { db } = await import('../../../../utils/api/supabase');

      // For custom boxes, query actual item qty for accurate label caption
      let resolvedCaption = customText || boxLabelCaption;
      if (!customText && isCustomBox && orderPkgInstanceId) {
        const { qty } = await db.getInstancePackedItemQty(orderPkgInstanceId);
        resolvedCaption = buildBoxLabelCaption(qty > 0 ? qty : null);
      }

      const { data: token, error: tokenError } = await db.getOrCreateQrToken('package', orderPkgInstanceId);
      if (tokenError || !token) {
        throw new Error(tokenError?.message || 'Could not generate QR token for this box.');
      }

      const selectedPreset = await chooseQrPrintSizePreset();
      if (!selectedPreset) return;

      const qrUrl = buildPortalScanUrl(token);

      await printBrotherQrLabelDirect(qrUrl, {
        printerAddressHint: connectedPrinter.address,
        preferredConnection: connectedPrinter.connectionType,
        labelWidthMm: selectedPreset.labelWidthMm,
        moduleScale: selectedPreset.moduleScale,
        marginModules: selectedPreset.marginModules,
        logoUrl: clientLogoUrl || undefined,
        layout: 'qr-with-caption-beside',
        caption: resolvedCaption,
        postPrintDelayMs: 3000,
        onStatus: (statusText: string) => console.log(`[Brother Box Label] ${statusText}`),
      });

      Alert.alert(
        'Direct Print Sent',
        `Box label for ${resolvedCaption || instanceReference || 'this box'} was sent to ${connectedPrinter.modelName}.`
      );
    } catch (e: any) {
      console.error('Error printing box label with Brother SDK:', e);
      const message = String(e?.message || 'Unable to print box label.');
      Alert.alert('Direct Print Failed', message);
      throw e;
    } finally {
      setPrintingBoxLabel(false);
    }
  };

  return (
    <View className="bg-white rounded-b-lg p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-800">Box #{packageNumber ?? '—'}</Text>
        {(hasPortal || !isOrderCompleted) && (
          <View className="flex-row gap-2 items-center">
            {hasPortal && (
              <TouchableOpacity
                onPress={async () => {
                  // Pre-fetch live qty so the modal initialText is already correct
                  let caption = boxLabelCaption;
                  if (isCustomBox && orderPkgInstanceId) {
                    try {
                      const { db } = await import('../../../../utils/api/supabase');
                      const { qty } = await db.getInstancePackedItemQty(orderPkgInstanceId);
                      caption = buildBoxLabelCaption(qty > 0 ? qty : null);
                    } catch {
                      // fall back to sync caption
                    }
                  }
                  setResolvedModalCaption(caption);
                  setCustomPrintModalVisible(true);
                }}
                disabled={previewingBoxLabel || printingBoxLabel}
                className="px-3 py-1.5 rounded-lg border border-teal-700 bg-teal-50 flex-row items-center justify-center"
              >
                {previewingBoxLabel || printingBoxLabel ? (
                  <ActivityIndicator size="small" color="#0f766e" />
                ) : (
                  <>
                    <Printer size={16} color="#0f766e" />
                    <Text className="text-teal-800 text-xs font-bold ml-1.5">Print Label</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {!isOrderCompleted && (
              <>
            {media.length > 0 ? (
              <TouchableOpacity 
                onPress={() => setMediaModalVisible(true)}
                className="flex-row items-center bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg"
              >
                <Camera size={14} color="#15803d" />
                <Text className="text-green-700 font-bold ml-1.5 text-[10px]">
                  PHOTOS ({media.length})
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={askSource}
                className="flex-row items-center bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-lg"
              >
                <Camera size={14} color="#475569" />
                <Text className="text-gray-600 font-bold ml-1.5 text-[10px]">
                  ADD PHOTO
                </Text>
              </TouchableOpacity>
            )}
            {status === 'packed' ? (
              <TouchableOpacity 
                onPress={handleUndo} 
                className="px-3 py-1 rounded border border-orange-700 bg-orange-300 justify-center items-center"
              >
                <Text className="text-orange-900 text-md font-semibold">
                  Undo Completion
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={handleMarkComplete} 
                className="px-3 py-1 rounded border border-lime-600 bg-lime-400 justify-center items-center"
              >
                <Text className="text-lime-900 text-md font-semibold">
                  Box Packed
                </Text>
              </TouchableOpacity>
            )}
              </>
            )}
          </View>
        )}
      </View>
      {description ? (
        <Text className="text-gray-600 mt-2">{description}</Text>
      ) : (
        <Text className="text-gray-500 mt-2">No description provided.</Text>
      )}

      <View className="mt-4 flex-row flex-wrap gap-2">
        <View className="mb-2 rounded border border-blue-100 bg-blue-50 px-3 py-2" style={{ flex: 1, minWidth: 200 }}>
          <Text className="text-xs font-semibold text-blue-800">IPAC Instance Reference</Text>
          <Text className="text-sm text-blue-900">{instanceReference || '—'}</Text>
        </View>

        {destination && (
          <View className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2" style={{ flex: 1, minWidth: 150 }}>
            <Text className="text-xs font-semibold text-amber-800">Destination</Text>
            <View className="flex-row items-center mt-0.5">
              <View className="bg-amber-400 w-2 h-2 rounded-full mr-2" />
              <Text className="text-sm font-bold text-amber-900 uppercase">{destination}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Packing Info cards */}
      <View className="mt-4">
        <OrderPackingInfo
          original={info?.original || null}
          final={info?.final || null}
          originalInfoId={originalPkgInfoId || null}
          finalInfoId={finalPkgInfoId || null}
          orderPackageId={orderPackageId}
          originalBoxTypeId={originalBoxTypeId || null}
          finalBoxTypeId={finalBoxTypeId || null}
          originalPackingTypeId={originalPackingTypeId || null}
          finalPackingTypeId={finalPackingTypeId || null}
          useSeiFlow={useSeiFlow}
          editTarget="final"
          requiresOriginalFirst={requiresOriginalFirst}
          editable={isEditable}
          onChange={(change) => onDataChange?.({ ...change, source: 'info' })}
        />
      </View>

      {/* Dimensions boxes */}
      <View className="mt-4">
        <OrderPackingDimensions 
          orderPackageId={orderPackageId}
          originalInfoId={originalPkgInfoId || null}
          finalInfoId={finalPkgInfoId || null}
          internal={dimensions?.internal || { original: null, final: null }}
          external={dimensions?.external || { original: null, final: null }}
          editTarget="final"
          allowFinalEdit
          requiresOriginalFirst={requiresOriginalFirst}
          editable={isEditable}
          onChange={(change) => onDataChange?.({ ...change, source: 'dimensions' })}
        />
      </View>

      {clientId && !hidePackingItems && (
        <View className="mt-4">
          <OrderItemsSection
            orderId={orderId}
            orderPackageId={orderPackageId}
            orderPkgInstanceId={orderPkgInstanceId}
            clientId={clientId}
            editable={isEditable}
            detectedPrinter={detectedPrinter}
            destination={destination}
            isStandardBox={!isCustomBox}
          />
        </View>
      )}

      <CustomPrintModal
        visible={customPrintModalVisible}
        onClose={() => { setCustomPrintModalVisible(false); setResolvedModalCaption(null); }}
        title="Print Box Label"
        subtitle={`Box #${packageNumber}`}
        initialText={resolvedModalCaption ?? boxLabelCaption}
        onPreview={handlePreviewBoxLabel}
        onPrint={handlePrintBoxLabel}
      />
      {/* Note: live QTY for custom box labels is pre-fetched when the print modal opens */}
      {/* Media Manager Modal */}
      <Modal
        visible={mediaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMediaModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <View className="flex-row justify-between items-center px-4 py-4 border-b border-white/10">
            <View className="flex-1 pr-4">
              <Text className="text-white font-bold text-lg" numberOfLines={1}>
                Box #{packageNumber} Photos
              </Text>
              <Text className="text-white/60 text-xs mt-0.5">
                {media.length} Photos total
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                askSource();
              }}
              className="w-10 h-10 items-center justify-center bg-blue-600 rounded-full mr-2"
            >
              <Camera size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setMediaModalVisible(false)}
              className="w-10 h-10 items-center justify-center bg-white/10 rounded-full"
            >
              <X size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View className="flex-1">
            {loadingMedia ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="white" />
              </View>
            ) : media.length === 0 ? (
              <View className="flex-1 items-center justify-center p-10">
                <Camera size={48} color="rgba(255,255,255,0.2)" />
                <Text className="text-white/40 mt-4 text-center">No photos added to this box yet.</Text>
              </View>
            ) : (
              <ScrollView 
                contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
              >
                {media.map((m) => (
                  <View key={m.id} className="relative" style={{ width: '47%', aspectRatio: 1 }}>
                    <Image
                      source={{ uri: m.image_url }}
                      style={{ width: '100%', height: '100%', borderRadius: 12 }}
                      resizeMode="cover"
                    />
                    <View className="absolute top-2 right-2 flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => setEnlargedImage(m.image_url)}
                        className="bg-blue-600 w-8 h-8 rounded-full items-center justify-center shadow-lg"
                      >
                        <Eye size={16} color="white" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteMedia(m.id)}
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

          {/* Footer button removed to avoid obstruction */}
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
            <Image
              source={{ uri: enlargedImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

export default BoxDetailsTab;

