import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Printer } from 'lucide-react-native';
import OrderPackingInfo, { BoxInfoDetails } from './order_packing_info';
import OrderPackingDimensions from './order_packing_dimensions';
import { DimensionsTriple } from '../common/DimensionsBox';
import OrderPackingItems from '../section_02_packing_items/order_packing_items';
import OrderItemsSection from './items/OrderItemsSection';
import TwoTierEditableCard from '../common/TwoTierEditableCard';
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
}

const normalizeReferenceValue = (value: unknown): string | null => {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
};

const BoxDetailsTab: React.FC<BoxDetailsTabProps> = ({ orderId, orderPackageId, orderPkgInstanceId = null, packageNumber, description, info, dimensions, originalPkgInfoId, finalPkgInfoId, onAttachPics, originalBoxTypeId, finalBoxTypeId, originalPackingTypeId, finalPackingTypeId, useSeiFlow = false, reference = null, instanceReference = null, status, isOrderCompleted, projectType = 'standard', onStatusChange, onReferenceChange, onDataChange, hidePackingItems = false, hasPortal = false, clientId = null }) => {
  const [printingIpacTest, setPrintingIpacTest] = useState(false);
  const isEditable = status !== 'packed' && !isOrderCompleted;
  const requiresOriginalFirst = projectType === 'maintenance' || projectType === 'survey';
  const referenceEditTarget: 'original' | 'final' = 'final';

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
      const { data, error } = await db.uploadMediaToStorage(orderPackageId, uri, 'package', notes);
      if (error) {
        Alert.alert('Upload failed', 'Could not upload image to storage.');
      } else {
        Alert.alert('Uploaded', 'Image uploaded successfully.');
      }
    } catch (e) {
      Alert.alert('Upload error', 'Unexpected error while uploading.');
    }
  };

  const handlePrintIpacTest = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Brother printing is not available on web.');
      return;
    }

    try {
      setPrintingIpacTest(true);
      const brotherPrintModule = require('../../../../utils/printing/brotherDirectPrint') as {
        getDetectedBrotherPrinter?: () => {
          modelName: string;
          address: string;
          connectionType: 'bluetooth' | 'wifi' | 'unknown';
        } | null;
        printBrotherTextLabelDirect?: (textValue: string, options?: any) => Promise<void>;
      };
      const { getDetectedBrotherPrinter, printBrotherTextLabelDirect } = brotherPrintModule;

      if (typeof printBrotherTextLabelDirect !== 'function') {
        throw new Error('Brother print module loaded but printBrotherTextLabelDirect is unavailable. Restart Metro with cache clear.');
      }

      const connectedPrinter =
        typeof getDetectedBrotherPrinter === 'function' ? getDetectedBrotherPrinter() : null;

      if (!connectedPrinter?.address) {
        Alert.alert(
          'Connect Printer First',
          'Use the Connect Printer button in the items section, then retry this test print.'
        );
        return;
      }

      await printBrotherTextLabelDirect('A', {
        printerAddressHint: connectedPrinter.address,
        preferredConnection: connectedPrinter.connectionType,
        labelWidthMm: 36,
        postPrintDelayMs: 3000,
        onStatus: (statusText: string) => console.log(`[Brother Test A] ${statusText}`),
      });

      Alert.alert(
        'Direct Print Sent',
        `Test label text "A" was sent to ${connectedPrinter.modelName} (${connectedPrinter.address}).`
      );
    } catch (e: any) {
      console.error('Error printing test label "A" with Brother SDK:', e);
      const message = String(e?.message || 'Unable to print test label "A".');

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
      setPrintingIpacTest(false);
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
                onPress={handlePrintIpacTest}
                disabled={printingIpacTest}
                className="px-3 py-1 rounded border border-teal-700 bg-teal-100 justify-center items-center"
              >
                {printingIpacTest ? (
                  <ActivityIndicator size="small" color="#0f766e" />
                ) : (
                  <View className="flex-row items-center">
                    <Printer size={16} color="#0f766e" />
                    <Text className="text-teal-800 text-sm font-semibold ml-1">Test A</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {!isOrderCompleted && (
              <>
            <TouchableOpacity 
              onPress={askSource} 
              accessibilityLabel="Attach images"
              className="bg-primary-500 px-3 py-2 rounded flex items-center justify-center"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <Camera size={20} color="#ffffff" />
            </TouchableOpacity>
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

      <View className="mt-4" style={{ width: 260 }}>
        <View className="mb-2 rounded border border-blue-100 bg-blue-50 px-3 py-2">
          <Text className="text-xs font-semibold text-blue-800">IPAC Instance Reference</Text>
          <Text className="text-sm text-blue-900">{instanceReference || '—'}</Text>
        </View>

        <TwoTierEditableCard
          label="Reference"
          original={reference}
          final={reference}
          type="text"
          editTarget={referenceEditTarget}
          editable={isEditable && !!onReferenceChange}
          onChange={async (value) => {
            await onReferenceChange?.(normalizeReferenceValue(value));
          }}
        />
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

      {!hidePackingItems && !hasPortal && (
        <View className="mt-4">
          <OrderPackingItems 
            orderPackageId={orderPackageId} 
            onAttachPics={onAttachPics} 
            editable={isEditable}
          />
        </View>
      )}

      {hasPortal && clientId && (
        <View className="mt-4">
          <OrderItemsSection 
            orderId={orderId}
            orderPackageId={orderPackageId} 
            orderPkgInstanceId={orderPkgInstanceId}
            clientId={clientId}
            editable={isEditable}
          />
        </View>
      )}
    </View>
  );
};

export default BoxDetailsTab;

