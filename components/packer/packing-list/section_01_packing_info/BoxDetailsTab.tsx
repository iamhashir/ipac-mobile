import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import OrderPackingInfo, { BoxInfoDetails } from './order_packing_info';
import OrderPackingDimensions from './order_packing_dimensions';
import { DimensionsTriple } from '../common/DimensionsBox';
import OrderPackingItems from '../section_02_packing_items/order_packing_items';

interface BoxInfoPair {
  original: BoxInfoDetails | null;
  final: BoxInfoDetails | null;
}

interface DimensionPair { original: DimensionsTriple | null; final: DimensionsTriple | null; }

interface BoxDetailsTabProps {
  orderPackageId: string;
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
  status?: string;
  onStatusChange?: () => void;
  onDataChange?: () => void; // Callback when any data changes
}

const BoxDetailsTab: React.FC<BoxDetailsTabProps> = ({ orderPackageId, packageNumber, description, info, dimensions, originalPkgInfoId, finalPkgInfoId, onAttachPics, originalBoxTypeId, finalBoxTypeId, originalPackingTypeId, finalPackingTypeId, status, onStatusChange, onDataChange }) => {
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

  return (
    <View className="bg-white rounded-b-lg p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-800">Box #{packageNumber ?? '—'}</Text>
        <View className="flex-row gap-2">
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
              className="px-3 py-1 rounded bg-orange-500"
            >
              <Text className="text-white text-sm">
                Undo Completion
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={handleMarkComplete} 
              className="px-3 py-1 rounded bg-green-600"
            >
              <Text className="text-white text-sm">
                Mark box as completed
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {description ? (
        <Text className="text-gray-600 mt-2">{description}</Text>
      ) : (
        <Text className="text-gray-500 mt-2">No description provided.</Text>
      )}

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
          editable={status !== 'packed'}
          onChange={onDataChange}
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
          editable={status !== 'packed'}
          onChange={onDataChange}
        />
      </View>

      {/* Packing Items */}
      <View className="mt-4">
        <OrderPackingItems 
          orderPackageId={orderPackageId} 
          onAttachPics={onAttachPics} 
          editable={status !== 'packed'}
        />
      </View>
    </View>
  );
};

export default BoxDetailsTab;

