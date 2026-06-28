import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '../../utils/cn';
import { CachedImage } from './CachedImage';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number; // pixels
  className?: string;
}

function getInitials(name?: string | null) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts[1]?.[0] || '';
  return (first + last).toUpperCase() || first.toUpperCase() || 'U';
}

export const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 64, className }) => {
  const borderRadius = size / 2;
  if (uri) {
    return (
      <View
        style={{ width: size, height: size, borderRadius, overflow: 'hidden' }}
        className={cn('bg-gray-100 border border-gray-200', className)}
      >
        <CachedImage uri={uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius }} className={cn('bg-gray-200 border border-gray-300 items-center justify-center', className)}>
      <Text className="text-gray-700 font-semibold" style={{ fontSize: size * 0.4 }}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

export default Avatar;