/**
 * Pure helpers for catalog / packed-item quantities.
 *
 * Shared by OrderItemsSection and CatalogBrowserModal — these were previously
 * copy-pasted verbatim in both files.
 */

export const toFiniteNumberOrNull = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const getRemainingExpectedQty = (catalogItem: any): number | null => {
  const expectedQty = toFiniteNumberOrNull(catalogItem?.expected_qty);
  if (expectedQty === null || expectedQty <= 0) return null;

  const packedQty = toFiniteNumberOrNull(catalogItem?.packed_qty) ?? 0;
  const remaining = Math.max(0, expectedQty - packedQty);
  return Math.round(remaining * 100) / 100;
};

export const isCatalogItemFullyPacked = (catalogItem: any): boolean => {
  const remaining = getRemainingExpectedQty(catalogItem);
  return remaining !== null && remaining <= 0;
};
