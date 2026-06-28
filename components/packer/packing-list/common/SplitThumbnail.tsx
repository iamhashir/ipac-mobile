import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Camera, FileText } from 'lucide-react-native';
import { CachedImage } from '../../../ui/CachedImage';

interface SplitThumbnailProps {
  media: any[];
  onPress: () => void;
  onCameraPress: () => void;
  size?: number;
}

export const SplitThumbnail: React.FC<SplitThumbnailProps> = ({ 
  media, 
  onPress, 
  onCameraPress,
  size = 64
}) => {
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [media?.[0]?.image_url]);

  if (!media || media.length === 0) {
    return (
      <TouchableOpacity
        onPress={onCameraPress}
        style={{ width: size, height: size }}
        className="bg-slate-100 rounded-lg items-center justify-center border border-dashed border-slate-300 mr-2"
      >
        <Camera size={size * 0.3} color="#64748b" />
        <Text style={{ fontSize: size * 0.12 }} className="text-slate-500 mt-1 font-bold uppercase text-center px-1">Add Pic</Text>
      </TouchableOpacity>
    );
  }

  const firstImage = media[0];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ width: size, height: size }}
      className="bg-slate-200 rounded-lg overflow-hidden mr-2 relative"
    >
      {firstImage?.image_url && !hasError ? (
        <CachedImage
          uri={firstImage.image_url}
          cacheKey={firstImage?.id != null ? String(firstImage.id) : undefined}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <View className="flex-1 items-center justify-center bg-slate-100">
          <FileText size={size * 0.3} color="#94a3b8" />
        </View>
      )}
      {media.length > 1 && (
        <View className="absolute top-1 right-1 bg-blue-600 px-1.5 py-1 rounded-md border border-white shadow-sm">
          <Text className="text-white font-black text-[10px]">+{media.length - 1}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
