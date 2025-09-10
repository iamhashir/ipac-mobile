import { Material, Supplier, Tag, UnitOfMeasure } from "../api/inventory";

let cache: {
  materials: Material[];
  suppliers: Supplier[];
  tags: Tag[];
  units: UnitOfMeasure[];
  timestamp: number;
} | null = null;

export function setInventoryCache(data: {
  materials: Material[];
  suppliers: Supplier[];
  tags: Tag[];
  units: UnitOfMeasure[];
}) {
  cache = { ...data, timestamp: Date.now() };
}

export function getInventoryCache(ttlMs: number = 60000) {
  if (!cache) return null;
  if (Date.now() - cache.timestamp > ttlMs) return null;
  return cache;
}

export function clearInventoryCache() {
  cache = null;
}

