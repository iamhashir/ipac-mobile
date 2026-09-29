/**
 * boxItemsCache — in-memory stale-while-revalidate cache for a box instance's
 * packed items (used by OrderItemsSection).
 *
 * WHY: the packing screen's tabs render only the active tab (TabLayout), so each
 * box unmounts when you switch away and remounts when you come back — which made
 * OrderItemsSection re-fetch its items every single revisit. This cache lets the
 * list paint instantly from memory on revisit while a background refresh keeps it
 * fresh (the post-pack/confirm reload still runs and overwrites the cache).
 *
 * Memory-only (cleared on app restart); bounded by the number of boxes visited in
 * a session. Keyed by the box instance id (falls back to the order_package id).
 */

const cache = new Map<string, unknown[]>();

export const getBoxItems = (key: string | null | undefined): unknown[] | undefined =>
  key ? cache.get(key) : undefined;

export const setBoxItems = (key: string | null | undefined, rows: unknown[]): void => {
  if (key) cache.set(key, rows);
};

export const clearBoxItems = (key: string | null | undefined): void => {
  if (key) cache.delete(key);
};
