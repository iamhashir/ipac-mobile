/**
 * catalogCache — in-memory stale-while-revalidate cache for the catalog browser's
 * item list (CatalogBrowserModal).
 *
 * The modal re-fetches the catalog on every open (packers open it constantly when
 * adding items). This lets the list paint instantly on reopen while a background
 * revalidate keeps it fresh. Keyed by the load params (client / order / box-mode /
 * destination / search). Memory-only; bounded by the distinct param combinations
 * used in a session.
 */

export interface CatalogCacheEntry {
  items: unknown[];
  hiddenPackedCount: number;
}

const cache = new Map<string, CatalogCacheEntry>();

export const getCatalogCache = (key: string): CatalogCacheEntry | undefined =>
  cache.get(key);

export const setCatalogCache = (key: string, entry: CatalogCacheEntry): void => {
  cache.set(key, entry);
};
