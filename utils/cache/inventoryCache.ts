import { Material, Supplier, Tag, UnitOfMeasure } from "../api/inventory";
import { getItem, setItem } from "../storage";

const STORAGE_KEY = 'ipac.inventory.cache.v1';

let cache: {
  materials: Material[];
  suppliers: Supplier[];
  tags: Tag[];
  units: UnitOfMeasure[];
  timestamp: number;
} | null = null;

export async function setInventoryCache(data: {
  materials: Material[];
  suppliers: Supplier[];
  tags: Tag[];
  units: UnitOfMeasure[];
}) {
  cache = { ...data, timestamp: Date.now() };
  try {
    await setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {}
}

export async function getInventoryCache(ttlMs: number = 60000) {
  // Prefer memory cache
  if (cache && Date.now() - cache.timestamp <= ttlMs) return cache;

  // Try storage cache
  try {
    const raw = await getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.timestamp !== 'number') return null;
    if (Date.now() - parsed.timestamp > ttlMs) return null;
    cache = parsed;
    return cache;
  } catch {
    return null;
  }
}

export async function getStaleInventoryCache() {
  // Return cache even if expired
  if (cache) return cache;
  try {
    const raw = await getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    cache = parsed;
    return cache;
  } catch {
    return null;
  }
}

export function clearInventoryCacheSync() {
  cache = null;
}

