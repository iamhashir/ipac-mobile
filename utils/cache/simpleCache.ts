import { getItem, setItem, removeItem } from '../storage';

export interface CacheEnvelope<T> {
  data: T;
  timestamp: number;
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  const env: CacheEnvelope<T> = { data, timestamp: Date.now() };
  try { await setItem(key, JSON.stringify(env)); } catch {}
}

export async function getCache<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope<T>;
    if (!env || typeof env.timestamp !== 'number') return null;
    if (Date.now() - env.timestamp > ttlMs) return null;
    return env.data;
  } catch {
    return null;
  }
}

export async function getStaleCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope<T>;
    return env?.data ?? null;
  } catch {
    return null;
  }
}

export async function clearCache(key: string): Promise<void> {
  try { await removeItem(key); } catch {}
}