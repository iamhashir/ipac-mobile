import React from 'react';
import type { StyleProp } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';

/**
 * CachedImage — the app-wide image component for remote media (box/item photos,
 * avatars, etc.). Wraps expo-image with on-device memory + disk caching.
 *
 * WHY THIS EXISTS: media is stored in Supabase storage and the app regenerates a
 * fresh `createSignedUrl` (a NEW token query-string) every fetch. React Native's
 * <Image> caches by full URL, so a changing token = a permanent cache miss = the
 * same photo re-downloaded on every render (the bandwidth/data blowup packers hit).
 *
 * expo-image lets us key the cache by a STABLE `cacheKey` (the media row id / storage
 * path) that survives token changes, so a photo is downloaded once and then served
 * from disk/memory forever. Always pass a stable `cacheKey` (e.g. `media.id`) — when
 * it is omitted expo-image falls back to the (unstable) uri and caching won't stick.
 */

type ContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

interface CachedImageProps {
  /** The (possibly signed, possibly changing) URL to load. */
  uri: string | null | undefined;
  /** Stable identifier for the underlying file (media.id / storage path). */
  cacheKey?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ContentFit;
  /** Fired when the image fails to load (e.g. expired URL / network). */
  onError?: () => void;
  accessibilityLabel?: string;
  /** Cross-fade duration in ms; 0 disables. */
  transitionMs?: number;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  uri,
  cacheKey,
  style,
  contentFit = 'cover',
  onError,
  accessibilityLabel,
  transitionMs = 150,
}) => {
  if (!uri) return null;

  return (
    <Image
      source={{ uri, cacheKey: cacheKey ?? undefined }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={transitionMs}
      onError={onError ? () => onError() : undefined}
      accessibilityLabel={accessibilityLabel}
    />
  );
};

export default CachedImage;
