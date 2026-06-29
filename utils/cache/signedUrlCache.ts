import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * In-memory cache for Supabase Storage signed URLs.
 *
 * Media signed URLs are minted with a 1-year expiry, but the app regenerated a NEW
 * one on every media fetch — one network round-trip per photo, every load. Now that
 * expo-image serves cached bytes by a stable cacheKey (see CachedImage), regenerating
 * those URLs is wasted work. Cache the signed URL per (bucket, path) and reuse it for
 * the session, re-minting weekly (far inside the 1-year validity). Memory-only.
 */

interface Entry {
  url: string;
  mintedAt: number;
}

const cache = new Map<string, Entry>();
const EXPIRY_SECONDS = 31536000; // 1 year (matches the existing callers)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // re-mint weekly — always well inside expiry

/**
 * Return a signed URL for `path`, reusing a cached one while it's fresh. On a refresh
 * error it falls back to the stale cached URL (still valid for ~1 year), else null.
 */
export const getCachedSignedUrl = async (
  supabase: SupabaseClient,
  bucket: string,
  path: string | null | undefined,
): Promise<string | null> => {
  if (!path) return null;
  const key = `${bucket}/${path}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.mintedAt < MAX_AGE_MS) return hit.url;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, EXPIRY_SECONDS);
  const signedUrl = data?.signedUrl;
  if (error || !signedUrl) return hit?.url ?? null; // keep the stale URL on a refresh error
  cache.set(key, { url: signedUrl, mintedAt: Date.now() });
  return signedUrl;
};

/** Drop a cached entry (e.g. when a media file is replaced/deleted). */
export const invalidateSignedUrl = (bucket: string, path: string | null | undefined): void => {
  if (path) cache.delete(`${bucket}/${path}`);
};
