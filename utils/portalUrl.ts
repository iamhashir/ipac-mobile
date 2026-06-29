/**
 * Portal URL helpers — the customer-facing scan URL (`/portal/scan/<token>`).
 *
 * Centralized here so the packer screens that generate item/box QR codes share one
 * definition instead of copy-pasting it (previously duplicated verbatim in
 * OrderItemsSection and QRGeneratorSection).
 */

const normalizePortalBaseUrl = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'https://ipac-admin.vercel.app';

  return trimmed.replace(/\/portal\/projects\/?$/i, '').replace(/\/+$/, '');
};

export const PORTAL_BASE_URL = normalizePortalBaseUrl(
  process.env.EXPO_PUBLIC_PORTAL_BASE_URL || 'https://ipac-admin.vercel.app',
);

export const buildPortalScanUrl = (token: string): string =>
  `${PORTAL_BASE_URL}/portal/scan/${encodeURIComponent(token)}`;
