import { PermissionsAndroid, Platform } from 'react-native';
import * as Print from 'expo-print';
import qrcode from 'qrcode-generator';

const DEFAULT_POST_PRINT_DELAY_MS = 1200;
const DEFAULT_LABEL_WIDTH_MM = 36;
const BROTHER_NAME_HINTS = ['brother', 'pt-', 'ql-', 'rj-', 'td-', 'pj-', 'mw-'];

type PrintConnectionPreference = 'auto' | 'bluetooth' | 'wifi';
type QrLogoPlacement = 'auto' | 'none' | 'above-qr' | 'inside-qr';
type AndroidPermission = (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];

type BrotherEnumMap = {
  type?: string;
  code?: number;
  label?: string;
};

type BrotherChannel = {
  channelType?: BrotherEnumMap;
  channelInfo?: string;
  extraInfo?: {
    ModelName?: string;
    SerialNumber?: string;
    NodeName?: string;
    MacAddress?: string;
    Location?: string;
  };
};

type BrotherSearchResult = {
  channels?: BrotherChannel[];
  error?: BrotherEnumMap;
};

type BrotherPrintError = {
  code?: BrotherEnumMap;
  errorDescription?: string;
};

type BrotherPrintSettingsResult = {
  enumMap?: BrotherEnumMap;
};

type OfficialBrotherSdk = {
  startBluetoothSearch?: () => Promise<BrotherSearchResult>;
  startNetworkSearch?: (
    duration: number,
    printerList?: string[],
    isTethering?: boolean
  ) => Promise<BrotherSearchResult>;
  newBluetoothChannelWithMacAddress?: (macAddress: string) => Promise<BrotherChannel>;
  newWifiChannel?: (ipAddress: string) => Promise<BrotherChannel>;
  newPrintSettings?: (printerModel: string) => Promise<BrotherPrintSettingsResult>;
  printPDFFileWithChannel?: (channel: BrotherChannel, path: string) => Promise<BrotherPrintError>;
};

export interface BrotherDetectedPrinter {
  modelName: string;
  address: string;
  serialNumber?: string;
  connectionType: 'bluetooth' | 'wifi' | 'unknown';
  channelType?: string;
  detectedAtMs: number;
}

export interface BrotherDirectPrintOptions {
  labelWidthMm?: number;
  qrImageBase64?: string;
  moduleScale?: number;
  marginModules?: number;
  caption?: string;
  logoPlacement?: QrLogoPlacement;
  logoText?: string;
  preferredConnection?: PrintConnectionPreference;
  printerAddressHint?: string;
  postPrintDelayMs?: number;
  onStatus?: (status: string) => void;

  // Compatibility placeholders to avoid breaking existing call sites.
  autoCut?: boolean;
  halfCut?: boolean;
  cutAtEnd?: boolean;
  specialTape?: boolean;
  chainPrint?: boolean;
  autoCutForEachPageCount?: number;
  density?: number;
  feedDots?: number;
  protocolOverride?: 'auto' | 'm-series' | 'm110';
  dataWriteMode?: 'auto' | 'withResponse' | 'withoutResponse';
  maxRasterLinesPerBlock?: number;
  m110MediaType?: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeModelName = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '');

const createBrotherError = (code: string, message: string): Error => {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
};

const extractBrotherErrorCode = (rawMessage: string): string | null => {
  const message = rawMessage.trim();
  const separatorIndex = message.indexOf(':');
  const token = separatorIndex > 0 ? message.slice(0, separatorIndex).trim() : message;
  return token.startsWith('BROTHER_') ? token : null;
};

const normalizeBrotherError = (error: unknown, fallbackMessage: string): Error => {
  let raw = String((error as any)?.message || error || fallbackMessage).trim();

  const userInfo = (error as any)?.userInfo;
  if (userInfo) {
    console.log('[Brother SDK Error]', JSON.stringify(userInfo, null, 2));
    const infoError = userInfo.error;
    if (infoError) {
      if (infoError.label) {
        raw += ` (Label: ${infoError.label})`;
      } else if (infoError.code?.label) {
        raw += ` (Label: ${infoError.code.label})`;
      }

      if (infoError.errorDescription) {
        raw += ` - ${infoError.errorDescription}`;
      }
    }
  }

  const lowered = raw.toLowerCase();
  const taggedCode = extractBrotherErrorCode(raw);

  if (taggedCode === 'BROTHER_OUT_OF_PAPER' || lowered.includes('paperempty') || lowered.includes('no paper')) {
    return createBrotherError('BROTHER_OUT_OF_PAPER', 'Printer is out of tape or paper. Load media and retry.');
  }

  if (taggedCode === 'BROTHER_COVER_OPEN' || lowered.includes('coveropen') || lowered.includes('cover open')) {
    return createBrotherError('BROTHER_COVER_OPEN', 'Printer cover is open. Close the cover and retry.');
  }

  if (taggedCode === 'BROTHER_BATTERY_LOW' || (lowered.includes('battery') && lowered.includes('weak'))) {
    return createBrotherError('BROTHER_BATTERY_LOW', 'Printer battery is low. Charge or replace the battery and retry.');
  }

  if (
    taggedCode === 'BROTHER_LABEL_SETTINGS_INVALID' ||
    lowered.includes('unsupported') ||
    lowered.includes('printsettings') ||
    lowered.includes('unknownprintermodel') ||
    lowered.includes('wronglabel')
  ) {
    return createBrotherError(
      'BROTHER_LABEL_SETTINGS_INVALID',
      'Label settings are not compatible with the selected printer profile. Reconnect the printer, confirm media width, and retry.'
    );
  }

  if (taggedCode === 'BROTHER_OPEN_STREAM_FAILURE' || lowered.includes('openstreamfailure') || lowered.includes('portnotsupported')) {
    return createBrotherError(
      'BROTHER_OPEN_STREAM_FAILURE',
      'Could not open a Bluetooth printer stream. Pair the printer in Android Bluetooth settings, then reconnect and retry.'
    );
  }

  if (taggedCode === 'BROTHER_SEARCH_NOTPERMITTED' || lowered.includes('notpermitted') || lowered.includes('permission denied')) {
    return createBrotherError(
      'BROTHER_PERMISSION_DENIED',
      'Bluetooth permission is denied. Enable Nearby devices permission for this app and retry.'
    );
  }

  if (lowered.includes('native module') || lowered.includes('cannot find native module') || lowered.includes('expo go')) {
    return createBrotherError(
      'BROTHER_DEV_BUILD_REQUIRED',
      'Brother printing requires a Development Build. Expo Go is not supported for this feature.'
    );
  }

  if (taggedCode) {
    const readable = raw.replace(`${taggedCode}:`, '').trim() || fallbackMessage;
    return createBrotherError(taggedCode, readable);
  }

  return createBrotherError('BROTHER_PRINT_FAILED', raw || fallbackMessage);
};

const loadOfficialBrotherSdk = (): OfficialBrotherSdk => {
  try {
    const loaded = require('official-react-brother-print-sdk/js/NativeBrotherPrintSDK');
    const sdk = (loaded?.default ?? loaded) as OfficialBrotherSdk;

    if (!sdk) {
      throw new Error('Official Brother SDK module is unavailable.');
    }

    return sdk;
  } catch {
    throw createBrotherError(
      'BROTHER_DEV_BUILD_REQUIRED',
      'Brother printing requires a Development Build with official-react-brother-print-sdk linked. Expo Go is not supported.'
    );
  }
};

const ensureAndroidBluetoothPermissions = async (
  onStatus?: (status: string) => void
): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const requiredPermissions: AndroidPermission[] = [];
  const { BLUETOOTH_CONNECT, BLUETOOTH_SCAN, ACCESS_FINE_LOCATION } = PermissionsAndroid.PERMISSIONS;

  if (BLUETOOTH_CONNECT) requiredPermissions.push(BLUETOOTH_CONNECT);
  if (BLUETOOTH_SCAN) requiredPermissions.push(BLUETOOTH_SCAN);

  const androidVersionRaw = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  const androidVersion = Number.isFinite(androidVersionRaw) ? androidVersionRaw : 0;

  if (androidVersion < 31 && ACCESS_FINE_LOCATION) {
    requiredPermissions.push(ACCESS_FINE_LOCATION);
  }

  const uniquePermissions = [...new Set(requiredPermissions)] as AndroidPermission[];
  if (uniquePermissions.length === 0) return true;

  const alreadyGranted = await Promise.all(
    uniquePermissions.map((permission) => PermissionsAndroid.check(permission))
  );
  const missingPermissions = uniquePermissions.filter((_, index) => !alreadyGranted[index]);

  if (missingPermissions.length === 0) return true;

  onStatus?.('Requesting Android Bluetooth permissions...');
  const requestResult = await PermissionsAndroid.requestMultiple(missingPermissions);
  const denied = missingPermissions.filter(
    (permission) =>
      requestResult[permission as keyof typeof requestResult] !== PermissionsAndroid.RESULTS.GRANTED
  );

  if (denied.length > 0) {
    onStatus?.('Bluetooth permission denied. Enable Nearby devices permission in Android settings.');
    return false;
  }

  return true;
};

const toAddressKey = (value: string) => normalizeText(value);
const looksLikeIpAddress = (value: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value.trim());
const looksLikeMacAddress = (value: string) => /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value.trim());

const inferConnectionType = (
  channelTypeLabel: string,
  address: string
): BrotherDetectedPrinter['connectionType'] => {
  const loweredType = normalizeText(channelTypeLabel);
  if (loweredType.includes('wifi')) return 'wifi';
  if (loweredType.includes('bluetooth')) return 'bluetooth';

  if (looksLikeIpAddress(address)) return 'wifi';
  if (looksLikeMacAddress(address)) return 'bluetooth';

  return 'unknown';
};

const mapNativeChannel = (channel: BrotherChannel) => {
  const extraInfo = channel?.extraInfo || {};
  const modelName = String(extraInfo.ModelName || 'Brother Printer').trim() || 'Brother Printer';
  const serialNumber = String(extraInfo.SerialNumber || '').trim() || undefined;
  const channelInfo = String(channel?.channelInfo || '').trim();
  const macAddress = String(extraInfo.MacAddress || '').trim();
  const nodeName = String(extraInfo.NodeName || '').trim();
  const address = macAddress || channelInfo || nodeName || serialNumber || 'unknown';
  const channelTypeLabel = String(channel?.channelType?.label || '').trim();

  const printer: BrotherDetectedPrinter = {
    modelName,
    address,
    serialNumber,
    connectionType: inferConnectionType(channelTypeLabel, address),
    channelType: channelTypeLabel || undefined,
    detectedAtMs: Date.now(),
  };

  return { printer, channel };
};

const matchesHint = (printer: BrotherDetectedPrinter, hint: string) => {
  const token = normalizeText(hint);
  if (!token) return false;

  const fields = [printer.address, printer.modelName, printer.serialNumber]
    .filter(Boolean)
    .map(normalizeText);

  return fields.some((field) => field.includes(token));
};

const isLikelyBrotherPrinter = (printer: BrotherDetectedPrinter): boolean => {
  const values = [printer.modelName, printer.address, printer.serialNumber]
    .filter(Boolean)
    .map(normalizeText);

  return values.some((value) => BROTHER_NAME_HINTS.some((hint) => value.includes(hint)));
};

let detectedBrotherPrinter: BrotherDetectedPrinter | null = null;
let detectedBrotherChannel: BrotherChannel | null = null;
const discoveredChannelsByAddress = new Map<string, BrotherChannel>();

const cacheDiscoveredChannels = (entries: Array<{ printer: BrotherDetectedPrinter; channel: BrotherChannel }>) => {
  for (const entry of entries) {
    discoveredChannelsByAddress.set(toAddressKey(entry.printer.address), entry.channel);
  }
};

const withDetectedPrinterDefaults = (
  options: BrotherDirectPrintOptions
): BrotherDirectPrintOptions => {
  const cached = detectedBrotherPrinter;
  const printerAddressHint = String(options.printerAddressHint || '').trim() || cached?.address;

  return {
    ...options,
    printerAddressHint,
  };
};

const resolveLabelWidthMm = (labelWidthMm: unknown): number => {
  const parsed = Number(labelWidthMm);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LABEL_WIDTH_MM;

  if (parsed <= 12) return 12;
  if (parsed <= 18) return 18;
  if (parsed <= 24) return 24;
  return 36;
};

const pickPreferredPrinter = (
  printers: BrotherDetectedPrinter[],
  options: BrotherDirectPrintOptions
): BrotherDetectedPrinter | null => {
  if (printers.length === 0) return null;

  const hint = String(options.printerAddressHint || '').trim();
  if (hint) {
    const hinted = printers.find((printer) => matchesHint(printer, hint));
    if (hinted) return hinted;
  }

  return [...printers].sort((first, second) => {
    const modelDiff = normalizeModelName(first.modelName).localeCompare(normalizeModelName(second.modelName));
    if (modelDiff !== 0) return modelDiff;

    return first.address.localeCompare(second.address);
  })[0];
};

const extractEnumLabel = (value: unknown) => String((value as any)?.label || '').trim();

const ensurePrintSettingsResult = (result: BrotherPrintSettingsResult | undefined, modelName: string) => {
  const label = extractEnumLabel(result?.enumMap);
  if (!label || label === 'NoError') return;

  throw createBrotherError(
    'BROTHER_LABEL_SETTINGS_INVALID',
    `Brother rejected print settings for model ${modelName} (${label}).`
  );
};

const ensurePrintResult = (result: BrotherPrintError | undefined) => {
  const label = extractEnumLabel(result?.code);
  if (!label || label === 'NoError') return;

  const description = String(result?.errorDescription || '').trim();
  const normalizedCode = `BROTHER_${label.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`;
  throw createBrotherError(normalizedCode, description || `Brother printer returned ${label}.`);
};

const buildModelCandidates = (modelName: string): string[] => {
  const raw = String(modelName || '').trim();
  const normalized = normalizeModelName(raw);
  const withHyphen = normalized.includes('-')
    ? normalized
    : normalized.replace(/^([A-Z]{2})([A-Z0-9].+)$/, '$1-$2');

  const candidates: string[] = [];
  const push = (value: string) => {
    const cleaned = String(value || '').trim();
    if (!cleaned) return;
    if (!candidates.includes(cleaned)) candidates.push(cleaned);
  };

  push(raw);
  push(withHyphen);
  push(normalized);

  const alphanumeric = normalized.replace(/[^A-Z0-9]/g, '');

  if (alphanumeric.startsWith('PTE920BT')) {
    push('PT-E920BT');
    push('PT-P910BT');
    push('PT-P900W');
    push('PT-P950NW');
    push('PT-E560BT');
    push('PT-E550W');
  }

  if (alphanumeric.startsWith('QL')) {
    push(`QL-${alphanumeric.slice(2)}`);
  }

  return candidates;
};

const preparePrintSettings = async (
  sdk: OfficialBrotherSdk,
  printerModelName: string,
  labelWidthMm: number,
  onStatus?: (status: string) => void
): Promise<string> => {
  if (typeof sdk.newPrintSettings !== 'function') {
    throw createBrotherError('BROTHER_SDK_API_MISSING', 'Official Brother SDK newPrintSettings API is unavailable.');
  }

  const candidates = buildModelCandidates(printerModelName);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      onStatus?.(`Preparing print profile for ${candidate}...`);
      const result = await sdk.newPrintSettings(candidate);
      ensurePrintSettingsResult(result, candidate);

      // Tell Native SDK to skip querying the physical hardware for its exact model string.
      // This allows fallback profile bindings (like P910BT profiling for E920BT) to successfully map and bypass `PrinterModelError`.
      if (typeof sdk.updatePrintSettings === 'function') {
        try {
          const overrideOptions: any = { skipStatusCheck: true };
          if (candidate.startsWith('PT-')) {
            overrideOptions.emulatePtLabelSize = `Width${labelWidthMm}mm`;
          }
          await sdk.updatePrintSettings(overrideOptions);
        } catch (updateError) {
          console.warn('[Brother Print] Failed to inject settings override:', updateError);
        }
      }

      return candidate;
    } catch (error) {
      lastError = error;
    }
  }

  throw normalizeBrotherError(lastError, 'Unable to initialize print settings for the selected Brother model.');
};

const runSearch = async (
  sdk: OfficialBrotherSdk,
  mode: 'bluetooth' | 'wifi',
  onStatus?: (status: string) => void
): Promise<BrotherChannel[]> => {
  if (mode === 'bluetooth') {
    if (typeof sdk.startBluetoothSearch !== 'function') {
      throw createBrotherError('BROTHER_SDK_API_MISSING', 'Official Brother SDK Bluetooth search API is unavailable.');
    }

    onStatus?.('Searching Brother printers via Bluetooth...');
    const result = await sdk.startBluetoothSearch();
    return Array.isArray(result?.channels) ? result.channels : [];
  }

  if (typeof sdk.startNetworkSearch !== 'function') {
    throw createBrotherError('BROTHER_SDK_API_MISSING', 'Official Brother SDK network search API is unavailable.');
  }

  onStatus?.('Searching Brother printers via network...');
  const result = await sdk.startNetworkSearch(5, undefined, false);
  return Array.isArray(result?.channels) ? result.channels : [];
};

export const getDetectedBrotherPrinter = (): BrotherDetectedPrinter | null => detectedBrotherPrinter;

export const clearDetectedBrotherPrinter = (): void => {
  detectedBrotherPrinter = null;
  detectedBrotherChannel = null;
};

export async function listBrotherPrinters(
  options: BrotherDirectPrintOptions = {}
): Promise<BrotherDetectedPrinter[]> {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  if (Platform.OS !== 'android') {
    throw new Error('Brother printing currently supports Android only in this app flow.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const onStatus = effectiveOptions.onStatus;

  try {
    const sdk = loadOfficialBrotherSdk();

    const hasPermissions = await ensureAndroidBluetoothPermissions(onStatus);
    if (!hasPermissions) {
      throw createBrotherError(
        'BROTHER_PERMISSION_DENIED',
        'Bluetooth permission is denied. Enable Nearby devices permission and retry.'
      );
    }

    const searchOrder: Array<'bluetooth' | 'wifi'> =
      effectiveOptions.preferredConnection === 'wifi'
        ? ['wifi']
        : effectiveOptions.preferredConnection === 'bluetooth'
          ? ['bluetooth']
          : ['bluetooth', 'wifi'];

    let discoveredChannels: BrotherChannel[] = [];
    for (const mode of searchOrder) {
      try {
        const channels = await runSearch(sdk, mode, onStatus);
        discoveredChannels = channels;
        if (channels.length > 0) break;
      } catch (searchError) {
        if (mode === searchOrder[searchOrder.length - 1]) {
          throw searchError;
        }
      }
    }

    const mappedEntries = discoveredChannels.map(mapNativeChannel);
    const likelyBrotherEntries = mappedEntries.filter((entry) => isLikelyBrotherPrinter(entry.printer));
    const finalEntries = likelyBrotherEntries.length > 0 ? likelyBrotherEntries : mappedEntries;

    cacheDiscoveredChannels(finalEntries);

    const printers = finalEntries.map((entry) => entry.printer);
    onStatus?.(`Discovered ${printers.length} printer candidate(s).`);
    return printers;
  } catch (error) {
    throw normalizeBrotherError(error, 'Failed to search Brother printers.');
  }
}

export async function detectBrotherPrinter(
  options: BrotherDirectPrintOptions = {}
): Promise<BrotherDetectedPrinter> {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  if (Platform.OS !== 'android') {
    throw new Error('Brother printing currently supports Android only in this app flow.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);

  const canReuseCached =
    !!detectedBrotherPrinter &&
    (!effectiveOptions.printerAddressHint ||
      matchesHint(detectedBrotherPrinter, effectiveOptions.printerAddressHint));

  if (canReuseCached && detectedBrotherPrinter) {
    effectiveOptions.onStatus?.(
      `Using selected printer ${detectedBrotherPrinter.modelName} (${detectedBrotherPrinter.address}).`
    );
    return detectedBrotherPrinter;
  }

  const printers = await listBrotherPrinters(effectiveOptions);
  const selected = pickPreferredPrinter(printers, effectiveOptions);

  if (!selected) {
    throw createBrotherError(
      'BROTHER_PRINTER_NOT_FOUND',
      'No Brother printer found. Open Connect Printer, select your printer, and retry.'
    );
  }

  detectedBrotherPrinter = selected;
  detectedBrotherChannel =
    discoveredChannelsByAddress.get(toAddressKey(selected.address)) || null;

  return selected;
}

const resolveActiveBrotherPrinter = async (
  options: BrotherDirectPrintOptions
): Promise<BrotherDetectedPrinter> => {
  const effectiveOptions = withDetectedPrinterDefaults(options);

  const canReuseCached =
    !!detectedBrotherPrinter &&
    (!effectiveOptions.printerAddressHint ||
      matchesHint(detectedBrotherPrinter, effectiveOptions.printerAddressHint));

  if (canReuseCached && detectedBrotherPrinter) {
    return detectedBrotherPrinter;
  }

  const detected = await detectBrotherPrinter(effectiveOptions);
  detectedBrotherPrinter = detected;
  return detected;
};

const resolvePrinterChannel = async (
  sdk: OfficialBrotherSdk,
  printer: BrotherDetectedPrinter,
  options: BrotherDirectPrintOptions
): Promise<BrotherChannel> => {
  const addressKey = toAddressKey(printer.address);

  if (detectedBrotherChannel && detectedBrotherPrinter && toAddressKey(detectedBrotherPrinter.address) === addressKey) {
    return detectedBrotherChannel;
  }

  const discoveredChannel = discoveredChannelsByAddress.get(addressKey);
  if (discoveredChannel) {
    detectedBrotherChannel = discoveredChannel;
    return discoveredChannel;
  }

  const preferredConnection =
    options.preferredConnection && options.preferredConnection !== 'auto'
      ? options.preferredConnection
      : printer.connectionType;

  const tryBluetooth = async () => {
    if (typeof sdk.newBluetoothChannelWithMacAddress !== 'function') {
      return null;
    }
    if (!looksLikeMacAddress(printer.address)) {
      return null;
    }
    return sdk.newBluetoothChannelWithMacAddress(printer.address);
  };

  const tryWifi = async () => {
    if (typeof sdk.newWifiChannel !== 'function') {
      return null;
    }
    if (!looksLikeIpAddress(printer.address)) {
      return null;
    }
    return sdk.newWifiChannel(printer.address);
  };

  const attempts: Array<() => Promise<BrotherChannel | null>> = [];
  if (preferredConnection === 'wifi') {
    attempts.push(tryWifi, tryBluetooth);
  } else if (preferredConnection === 'bluetooth') {
    attempts.push(tryBluetooth, tryWifi);
  } else {
    attempts.push(tryBluetooth, tryWifi);
  }

  for (const attempt of attempts) {
    const channel = await attempt();
    if (channel) {
      discoveredChannelsByAddress.set(addressKey, channel);
      detectedBrotherChannel = channel;
      return channel;
    }
  }

  const refreshedPrinter = await detectBrotherPrinter({
    ...options,
    printerAddressHint: printer.address,
  });

  const refreshedChannel = discoveredChannelsByAddress.get(toAddressKey(refreshedPrinter.address));
  if (refreshedChannel) {
    detectedBrotherChannel = refreshedChannel;
    return refreshedChannel;
  }

  throw createBrotherError(
    'BROTHER_CHANNEL_RESOLVE_FAILED',
    'Unable to resolve a printer channel for the selected Brother printer.'
  );
};

const buildQrSvgMarkup = (value: string, moduleScale: number, marginModules: number) => {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();

  const scale = Math.max(1, Math.round(moduleScale));
  const margin = Math.max(0, Math.round(marginModules));
  const moduleCount = qr.getModuleCount();
  const totalModules = moduleCount + margin * 2;
  const size = totalModules * scale;

  const rects: string[] = [];
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.isDark(row, col)) continue;
      const x = (col + margin) * scale;
      const y = (row + margin) * scale;
      rects.push(`<rect x="${x}" y="${y}" width="${scale}" height="${scale}" />`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/>${rects.join('')}</svg>`;
};

const normalizeBase64Image = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const match = trimmed.match(/^data:[^;]+;base64,(.+)$/i);
  return match?.[1] || trimmed;
};

const computeItemFontSizePx = (itemTextLength: number, labelWidthMm: number): number => {
  const length = Math.max(1, itemTextLength);

  if (labelWidthMm <= 12) {
    const base = 30;
    if (length <= 5) return base;
    if (length <= 7) return 26;
    if (length <= 9) return 22;
    if (length <= 11) return 19;
    return 17;
  }

  const base = 74;
  if (length <= 5) return base;
  if (length <= 7) return 64;
  if (length <= 9) return 56;
  if (length <= 11) return 48;
  return 42;
};

const buildQrHtml = (value: string, options: BrotherDirectPrintOptions) => {
  const labelWidthMm = resolveLabelWidthMm(options.labelWidthMm);
  const widthPx = Math.max(170, Math.round((labelWidthMm / 25.4) * 360));

  // Required layouts:
  // 12mm -> [Logo] -> [QR] -> [Item Number]
  // 36mm -> [QR with centered logo] -> [Item Number]
  const is12mm = labelWidthMm <= 12;
  const logoPlacement: QrLogoPlacement = 'inside-qr';

  const logoText = escapeHtml(String(options.logoText || 'IPAC').trim());
  const itemNumber = String(options.caption || '').trim();
  const safeItemNumber = escapeHtml(itemNumber);
  const itemNumberFontPx = computeItemFontSizePx(itemNumber.length, labelWidthMm);
  const itemNumberLetterSpacingPx = is12mm ? 0.8 : 2.2;

  const qrSizePx = is12mm ? Math.round(widthPx * 0.96) : Math.round(widthPx * 0.96);
  const qrScale = Math.max(2, Math.round(options.moduleScale ?? (is12mm ? 2 : 4)));
  const qrMargin = Math.max(0, Math.round(options.marginModules ?? (is12mm ? 1 : 2)));

  const providedQrBase64 = normalizeBase64Image(String(options.qrImageBase64 || ''));
  const qrMarkup = providedQrBase64
    ? `<img class="qr-image" src="data:image/png;base64,${providedQrBase64}" alt="QR"/>`
    : buildQrSvgMarkup(value, qrScale, qrMargin);

  const showLogoAbove = logoPlacement === 'above-qr' && logoText.length > 0;
  const showLogoInside = logoPlacement === 'inside-qr' && logoText.length > 0;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: Arial, sans-serif;
      }
      .sheet {
        width: ${widthPx}px;
        min-height: ${widthPx}px;
        padding: 4px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .logo-top {
        font-size: ${is12mm ? 22 : 32}px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #111827;
      }
      .qr-wrap {
        width: ${qrSizePx}px;
        height: ${qrSizePx}px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .qr-wrap.inside {
        position: relative;
      }
      .qr-wrap svg, .qr-wrap .qr-image {
        width: ${qrSizePx}px;
        height: ${qrSizePx}px;
      }
      .logo-inside {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: ${is12mm ? '2px 6px' : '4px 10px'};
        font-size: ${is12mm ? 18 : 28}px;
        line-height: 1;
        font-weight: 700;
        color: #111827;
      }
      .item-number {
        max-width: 100%;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: clip;
        font-size: ${itemNumberFontPx}px;
        letter-spacing: ${itemNumberLetterSpacingPx}px;
        font-weight: 700;
        color: #111827;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="qr-wrap${showLogoInside ? ' inside' : ''}">
        ${qrMarkup}
        ${showLogoInside ? `<div class="logo-inside">${logoText}</div>` : ''}
      </div>
    </div>
  </body>
</html>`;
};

const buildTextHtml = (textValue: string, options: BrotherDirectPrintOptions) => {
  const labelWidthMm = resolveLabelWidthMm(options.labelWidthMm);
  const widthPx = Math.max(170, Math.round((labelWidthMm / 25.4) * 360));
  const safeText = escapeHtml(textValue);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: Arial, sans-serif;
      }
      .sheet {
        width: ${widthPx}px;
        min-height: ${Math.round(widthPx * 1.1)}px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        box-sizing: border-box;
      }
      .text {
        font-size: ${labelWidthMm <= 12 ? 36 : 72}px;
        font-weight: 700;
        letter-spacing: ${labelWidthMm <= 12 ? 1 : 3}px;
        color: #111827;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="text">${safeText}</div>
    </div>
  </body>
</html>`;
};

const printHtmlWithBrother = async (html: string, options: BrotherDirectPrintOptions = {}) => {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  if (Platform.OS !== 'android') {
    throw new Error('Brother printing currently supports Android only in this app flow.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const onStatus = effectiveOptions.onStatus;

  try {
    const sdk = loadOfficialBrotherSdk();
    const printer = await resolveActiveBrotherPrinter(effectiveOptions);
    detectedBrotherPrinter = printer;

    const channel = await resolvePrinterChannel(sdk, printer, effectiveOptions);
    detectedBrotherChannel = channel;

    onStatus?.('Generating printable document...');
    const pdf = await Print.printToFileAsync({ html });
    if (!pdf?.uri) {
      throw createBrotherError('BROTHER_PDF_GENERATION_FAILED', 'Failed to generate printable document.');
    }

    const labelWidthMm = resolveLabelWidthMm(effectiveOptions.labelWidthMm);
    const matchedModel = await preparePrintSettings(sdk, printer.modelName, labelWidthMm, onStatus);

    if (typeof sdk.printPDFFileWithChannel !== 'function') {
      throw createBrotherError('BROTHER_SDK_API_MISSING', 'Official Brother SDK printPDFFileWithChannel API is unavailable.');
    }

    const activeChannel = { ...channel };
    if (activeChannel.extraInfo) {
      activeChannel.extraInfo = { ...activeChannel.extraInfo, ModelName: matchedModel };
    }

    const printablePath = pdf.uri.replace(/^file:\/\//i, '');

    onStatus?.('Sending print job to Brother printer...');
    const printResult = await sdk.printPDFFileWithChannel(activeChannel, printablePath);
    ensurePrintResult(printResult);

    const postDelay = Math.max(
      0,
      Math.round(effectiveOptions.postPrintDelayMs ?? DEFAULT_POST_PRINT_DELAY_MS)
    );
    if (postDelay > 0) {
      await delay(postDelay);
    }

    onStatus?.('Brother print job sent.');
  } catch (error) {
    throw normalizeBrotherError(error, 'Brother print job failed.');
  }
};

export async function printBrotherTextLabelDirect(
  textValue: string,
  options: BrotherDirectPrintOptions = {}
): Promise<void> {
  const text = String(textValue || '').trim();
  if (!text) {
    throw createBrotherError('BROTHER_EMPTY_TEXT', 'Text value is empty.');
  }

  const html = buildTextHtml(text, options);
  await printHtmlWithBrother(html, options);
}

export async function printBrotherQrLabelDirect(
  qrValue: string,
  options: BrotherDirectPrintOptions = {}
): Promise<void> {
  const value = String(qrValue || '').trim();
  if (!value) {
    throw createBrotherError('BROTHER_EMPTY_QR', 'QR value is empty.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const html = buildQrHtml(value, effectiveOptions);
  await printHtmlWithBrother(html, effectiveOptions);
}
