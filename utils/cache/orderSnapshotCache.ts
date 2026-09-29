/**
 * orderSnapshotCache.ts
 *
 * Persistent on-device snapshot cache for the packing-list screen.
 *
 * Strategy: stale-while-revalidate (SWR).
 *   1. On mount, read the last successful load from AsyncStorage and paint the
 *      screen immediately ("stale" paint).
 *   2. In parallel, kick off a background network load. When it finishes it
 *      overwrites state and writes a fresh snapshot back here.
 *
 * Storage key: `pkpl:order:{orderId}:v1`
 *   • Bump the `SNAPSHOT_VERSION` constant AND rename the key suffix (e.g. `v2`)
 *     together whenever the Snapshot shape changes. Old keys will be ignored
 *     automatically (version mismatch) and will expire from device storage
 *     without any active cleanup.
 *
 * Size guard: blobs > SIZE_LIMIT_BYTES (~4 MB) are skipped to avoid hitting
 * AsyncStorage's per-entry limit on older Android.
 */

import { getItem, setItem, removeItem } from '../storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Increment this when the Snapshot shape changes. Old snapshots return null. */
const SNAPSHOT_VERSION = 1;

/** Key template — change suffix when bumping version */
const keyFor = (orderId: string) => `pkpl:order:${orderId}:v1`;

/** Maximum serialised size before we skip persisting (bytes, roughly chars on UTF-8 ASCII) */
const SIZE_LIMIT_BYTES = 4 * 1024 * 1024; // 4 MB

/** LRU bound — keep snapshots for the N most recently persisted orders so AsyncStorage
 *  doesn't grow without limit over a long session/lifetime (older orders are evicted on
 *  the next persist; hitting the storage limit would otherwise silently break caching). */
const INDEX_KEY = 'pkpl:order:index:v1';
const MAX_ORDERS = 15;

async function readSnapshotIndex(): Promise<string[]> {
  try {
    const raw = await getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id: unknown): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Mark `orderId` most-recently-used and evict snapshots beyond MAX_ORDERS. Best-effort. */
async function touchSnapshotIndex(orderId: string): Promise<void> {
  try {
    const current = await readSnapshotIndex();
    const next = [orderId, ...current.filter((id) => id !== orderId)];
    const kept = next.slice(0, MAX_ORDERS);
    const evicted = next.slice(MAX_ORDERS);
    await setItem(INDEX_KEY, JSON.stringify(kept));
    for (const id of evicted) {
      await removeItem(keyFor(id));
    }
  } catch {
    // Eviction is best-effort — never affect the UI
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The exact set of state values that `loadData()` in packing-list.tsx sets
 * on a successful fetch, plus cache bookkeeping fields.
 *
 * Deliberately excludes transient / ephemeral UI state:
 *   - `loading`, `checkingToolbox` — spinner flags, always reset on mount
 *   - `activeKey`, `previousKey` — tab navigation, user-driven
 *   - `searchQuery`, `isSearching` — search field, empty on mount
 *   - `globalScannerVisible`, `globalScannerBusy` — modal flags
 *   - `detectedPrinter`, `detectingPrinterLoading` — Bluetooth runtime state
 *   - `duplicateTarget` — modal target, always null on mount
 *   - `selectedInstanceByOverview` — omitted intentionally: loadData sets it
 *     via a functional updater that merges with existing selections; on a fresh
 *     hydrate we want the first-instance default anyway, so we let the
 *     overviewBoxes memo re-derive it from the hydrated overviewInstancesMap.
 *     If the packer had a different instance selected the background revalidate
 *     will restore their selection via the same functional updater logic.
 */
export interface OrderSnapshot {
  /** Version guard — must equal SNAPSHOT_VERSION */
  version: number;
  /** ISO timestamp of when this snapshot was persisted */
  savedAt: string;

  // ── data from loadData() ──────────────────────────────────────────────────
  order: Record<string, unknown> | null;
  orderPackages: unknown[];
  orderPackageOverviews: unknown[];
  overviewInstancesMap: Record<string, unknown[]>;
  pkgInfoMap: Record<string, unknown>;
  boxTypes: Record<string, string>;
  packingTypes: Record<string, string>;
  packTypeHasVacuum: Record<string, boolean>;
  packTypeHasGas: Record<string, boolean>;
  equipmentMap: Record<string, string>;
  boxStartedMap: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read and validate a persisted snapshot for `orderId`.
 * Returns `null` on any error, missing key, parse failure, or version mismatch.
 */
export async function getOrderSnapshot(orderId: string): Promise<OrderSnapshot | null> {
  if (!orderId) return null;
  try {
    const raw = await getItem(keyFor(orderId));
    if (!raw) return null;

    const parsed: OrderSnapshot = JSON.parse(raw);

    // Shape + version validation
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.version !== SNAPSHOT_VERSION ||
      typeof parsed.savedAt !== 'string' ||
      !parsed.order ||
      !Array.isArray(parsed.orderPackages) ||
      !Array.isArray(parsed.orderPackageOverviews)
    ) {
      return null;
    }

    return parsed;
  } catch {
    // Corrupt JSON, storage error, etc — swallow and return null
    return null;
  }
}

/**
 * Persist a snapshot for `orderId`.
 * Never throws — all errors are swallowed so the UI is never affected.
 * Skips persisting if the serialised blob would exceed SIZE_LIMIT_BYTES.
 */
export async function setOrderSnapshot(
  orderId: string,
  snapshot: Omit<OrderSnapshot, 'version' | 'savedAt'>,
): Promise<void> {
  if (!orderId) return;
  try {
    const envelope: OrderSnapshot = {
      version: SNAPSHOT_VERSION,
      savedAt: new Date().toISOString(),
      ...snapshot,
    };
    const serialised = JSON.stringify(envelope);
    if (serialised.length > SIZE_LIMIT_BYTES) {
      console.warn(
        `[orderSnapshotCache] Snapshot for order ${orderId} is ${serialised.length} bytes — exceeds ${SIZE_LIMIT_BYTES} byte limit. Skipping persist.`,
      );
      return;
    }
    await setItem(keyFor(orderId), serialised);
    await touchSnapshotIndex(orderId);
  } catch {
    // Never propagate storage errors to the UI
  }
}

/**
 * Remove the persisted snapshot for `orderId` (e.g. on logout / order close).
 * Silently ignores errors.
 */
export async function clearOrderSnapshot(orderId: string): Promise<void> {
  if (!orderId) return;
  try {
    await removeItem(keyFor(orderId));
  } catch {
    // Swallow
  }
}
