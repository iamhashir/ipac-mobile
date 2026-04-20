import { PermissionsAndroid, Platform } from 'react-native';
import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';
import qrcode from 'qrcode-generator';
import {
  BrotherPrinterSDK,
  BPChannel,
  BPChannelType,
  BPNetworkSearchOptions,
  BPPrintSettings,
  BPQLLabelSize,
  BPHalftone,
  BPResolution,
} from 'expo-brother-printer-sdk';

const DEFAULT_NETWORK_SEARCH_DURATION_MS = 2000;
const DEFAULT_POST_PRINT_DELAY_MS = 1200;
const DEFAULT_BROTHER_PRINTER_MODELS = [
  'QL-710W',
  'QL-720NW',
  'QL-810W',
  'QL-820NWB',
  'QL-1110NWB',
  'QL-1115NWB',
  'PT-E920BT',
];

const SUPPORTED_DIRECT_PRINT_MODEL_HINT = DEFAULT_BROTHER_PRINTER_MODELS.join(', ');

const BROTHER_NAME_HINTS = ['brother', 'ql-', 'pt-', 'rj-', 'td-', 'pj-', 'mw-'];

type PrintConnectionPreference = 'auto' | 'bluetooth' | 'wifi';
type QrLogoPlacement = 'auto' | 'none' | 'above-qr' | 'inside-qr';

export interface BrotherDetectedPrinter {
  modelName: string;
  address: string;
  serialNumber?: string;
  connectionType: 'bluetooth' | 'wifi' | 'unknown';
  channelType: BPChannelType;
  detectedAtMs: number;
}

export interface BrotherDirectPrintOptions {
  labelWidthMm?: number;
  labelSize?: BPQLLabelSize;
  qrImageBase64?: string;
  moduleScale?: number;
  marginModules?: number;
  caption?: string;
  logoPlacement?: QrLogoPlacement;
  logoText?: string;
  preferredConnection?: PrintConnectionPreference;
  printerAddressHint?: string;
  networkPrinterModels?: string[];
  scanTimeoutMs?: number;
  postPrintDelayMs?: number;
  onStatus?: (status: string) => void;

  // Compatibility placeholders so existing call sites can pass prior options.
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

const channelTypeLabel = (type: BPChannelType) => {
  switch (type) {
    case BPChannelType.BluetoothLowEnergy:
      return 'Bluetooth LE';
    case BPChannelType.BluetoothMFi:
      return 'Bluetooth';
    case BPChannelType.WiFi:
      return 'WiFi';
    default:
      return 'Unknown';
  }
};

const normalizeChannelText = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '-');

const normalizeModelName = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const isPtSeriesModel = (modelName: unknown) =>
  normalizeModelName(modelName).startsWith('PT-');

const isModelSupportedForDirectPrint = (modelName: string) => {
  const normalizedModel = normalizeModelName(modelName);
  if (!normalizedModel) return false;

  return DEFAULT_BROTHER_PRINTER_MODELS.some((supportedModel) =>
    normalizedModel.startsWith(normalizeModelName(supportedModel))
  );
};

const isUnsupportedPrinterModelError = (message: string) =>
  message.toLowerCase().includes('unsupported printer model');

const extractUnsupportedModelFromError = (message: string): string | null => {
  const explicit = message.match(/unsupported printer model\s*:\s*([^\s]+)/i);
  if (explicit?.[1]) return explicit[1].trim();

  const fallback = message.match(/unsupported printer model\s*\(?([^\)]*)\)?/i);
  if (fallback?.[1]) {
    const value = fallback[1].trim();
    return value || null;
  }

  return null;
};

const createUnsupportedModelError = (modelName?: string | null) => {
  const detectedText = modelName ? `Detected model: ${modelName}. ` : '';
  return new Error(
    `This app currently supports direct Brother printing for these models: ${SUPPORTED_DIRECT_PRINT_MODEL_HINT}. ${detectedText}Use one of these models, or extend the native brother SDK wrapper for additional model families.`
  );
};

const getChannelSearchValues = (channel: BPChannel): string[] =>
  [channel.modelName, channel.alias, channel.nodeName, channel.serialNumber, channel.address]
    .filter(Boolean)
    .map((value) => String(value));

const isLikelyBrotherChannel = (
  channel: BPChannel,
  options: BrotherDirectPrintOptions
) => {
  const values = getChannelSearchValues(channel).map(normalizeChannelText);
  if (values.length === 0) return false;

  const hasBrotherHint = values.some((value) =>
    BROTHER_NAME_HINTS.some((hint) => value.includes(hint))
  );
  if (hasBrotherHint) return true;

  const normalizedKnownModels = (options.networkPrinterModels || DEFAULT_BROTHER_PRINTER_MODELS)
    .map((model) => normalizeChannelText(model))
    .filter(Boolean);

  if (normalizedKnownModels.length === 0) return false;

  return values.some((value) =>
    normalizedKnownModels.some((model) => value.includes(model) || model.includes(value))
  );
};

const dedupeChannels = (channels: BPChannel[]): BPChannel[] => {
  const seen = new Set<string>();
  const unique: BPChannel[] = [];

  for (const channel of channels) {
    const key = [
      channel.type,
      normalizeChannelText(channel.address),
      normalizeChannelText(channel.serialNumber),
      normalizeChannelText(channel.modelName),
      normalizeChannelText(channel.nodeName),
      normalizeChannelText(channel.alias),
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(channel);
  }

  return unique;
};

const isBluetoothPermissionDeniedMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('bluetooth_connect permission denied') ||
    normalized.includes('bluetooth_scan permission denied') ||
    (normalized.includes('permission denied') &&
      (normalized.includes('bluetooth') || normalized.includes('nearby devices')))
  );
};

type BluetoothSearchResult = {
  channels: BPChannel[];
  permissionDenied: boolean;
};

const ensureAndroidBluetoothPermissions = async (
  onStatus?: (status: string) => void
): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const requiredPermissions: string[] = [];
  const { BLUETOOTH_CONNECT, BLUETOOTH_SCAN, ACCESS_FINE_LOCATION } =
    PermissionsAndroid.PERMISSIONS;

  if (BLUETOOTH_CONNECT) requiredPermissions.push(BLUETOOTH_CONNECT);
  if (BLUETOOTH_SCAN) requiredPermissions.push(BLUETOOTH_SCAN);

  const androidVersionRaw =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number(Platform.Version);
  const androidVersion = Number.isFinite(androidVersionRaw)
    ? androidVersionRaw
    : 0;

  // Android 11 and below usually need location permission for BT scans.
  if (androidVersion < 31 && ACCESS_FINE_LOCATION) {
    requiredPermissions.push(ACCESS_FINE_LOCATION);
  }

  const uniquePermissions = [...new Set(requiredPermissions)];
  if (uniquePermissions.length === 0) return true;

  const checkResults = await Promise.all(
    uniquePermissions.map((permission) => PermissionsAndroid.check(permission))
  );
  const missingPermissions = uniquePermissions.filter(
    (_, index) => !checkResults[index]
  );

  if (missingPermissions.length === 0) return true;

  onStatus?.('Requesting Android Bluetooth permissions...');
  const requestResults = await PermissionsAndroid.requestMultiple(
    missingPermissions
  );

  const deniedPermissions = missingPermissions.filter(
    (permission) =>
      requestResults[permission] !== PermissionsAndroid.RESULTS.GRANTED
  );

  if (deniedPermissions.length > 0) {
    onStatus?.(
      'Bluetooth permission denied. Enable Nearby devices permission in Android settings.'
    );
    return false;
  }

  return true;
};

let detectedBrotherPrinter: BrotherDetectedPrinter | null = null;
let detectedBrotherChannel: BPChannel | null = null;

const toConnectionPreference = (type: BPChannelType): PrintConnectionPreference | undefined => {
  if (type === BPChannelType.WiFi) return 'wifi';
  if (type === BPChannelType.BluetoothLowEnergy || type === BPChannelType.BluetoothMFi) return 'bluetooth';
  return undefined;
};

const mapChannelToDetectedPrinter = (channel: BPChannel): BrotherDetectedPrinter => {
  const address =
    String(
      channel.address || channel.serialNumber || channel.nodeName || channel.alias || channel.modelName || 'unknown'
    ).trim() || 'unknown';

  let connectionType: BrotherDetectedPrinter['connectionType'] = 'unknown';
  if (channel.type === BPChannelType.WiFi) {
    connectionType = 'wifi';
  } else if (channel.type === BPChannelType.BluetoothLowEnergy || channel.type === BPChannelType.BluetoothMFi) {
    connectionType = 'bluetooth';
  }

  return {
    modelName: String(channel.modelName || 'Brother Printer').trim() || 'Brother Printer',
    address,
    serialNumber: channel.serialNumber,
    connectionType,
    channelType: channel.type,
    detectedAtMs: Date.now(),
  };
};

const withDetectedPrinterDefaults = (options: BrotherDirectPrintOptions): BrotherDirectPrintOptions => {
  const cached = detectedBrotherPrinter;
  const printerAddressHint = String(options.printerAddressHint || '').trim() || cached?.address;
  const preferredConnection = options.preferredConnection ?? (cached ? toConnectionPreference(cached.channelType) : undefined);

  return {
    ...options,
    printerAddressHint,
    preferredConnection,
  };
};

const isNativeModuleError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('native module') ||
    normalized.includes('cannot find native module') ||
    normalized.includes('expo go')
  );
};

const isPrinterModelError = (message: string) =>
  message.toLowerCase().includes('printermodelerror');

const isOpenStreamFailure = (message: string) =>
  message.toLowerCase().includes('openstreamfailure');

const normalizeMacAddress = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase();

const looksLikeMacAddress = (value: string) =>
  /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalizeMacAddress(value));

const getPtCompatibilityModelNames = (modelName: string): string[] => {
  const normalized = normalizeModelName(modelName);
  if (!normalized.startsWith('PT-')) return [];

  const aliases: string[] = [];
  if (normalized.startsWith('PT-E920BT')) {
    aliases.push('PT-E550W', 'PT-E560BT');
  }

  // Keep at least one fallback for generic PT family retries.
  aliases.push('PT-E560BT', 'PT-E550W');

  return [...new Set(aliases.filter(Boolean))];
};

const buildChannelModelCandidates = (channel: BPChannel): BPChannel[] => {
  const modelName = String(channel.modelName || '').trim();
  if (!isPtSeriesModel(modelName)) return [channel];

  const aliases = getPtCompatibilityModelNames(modelName)
    .filter((alias) => normalizeModelName(alias) !== normalizeModelName(modelName));

  const aliasChannels = aliases.map((alias) => ({
    ...channel,
    modelName: alias,
  }));

  return [channel, ...aliasChannels];
};

const buildChannelTransportCandidates = (channel: BPChannel): BPChannel[] => {
  const candidates: BPChannel[] = [];
  const seen = new Set<string>();
  const addCandidate = (candidate: BPChannel) => {
    const key = [
      candidate.type,
      normalizeChannelText(candidate.address),
      normalizeModelName(candidate.modelName),
    ].join('|');

    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  addCandidate(channel);

  if (channel.type === BPChannelType.BluetoothMFi) {
    const macAddress = normalizeMacAddress(channel.address);
    if (macAddress) {
      addCandidate({ ...channel, address: macAddress });
    }

    // Some SDK versions/devices resolve better with a separator-free MAC.
    if (looksLikeMacAddress(macAddress)) {
      addCandidate({ ...channel, address: macAddress.replace(/:/g, '') });
    }

    const bleNames = [channel.alias, channel.modelName, channel.serialNumber]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    for (const bleName of bleNames) {
      addCandidate({
        ...channel,
        type: BPChannelType.BluetoothLowEnergy,
        address: bleName,
      });
    }
  }

  return candidates;
};

const normalizeBrotherError = (error: unknown, fallbackMessage: string) => {
  const raw = String((error as any)?.message || error || fallbackMessage);
  if (isNativeModuleError(raw)) {
    return new Error(
      'Brother printer SDK requires a Development Build. Expo Go is not supported for this feature.'
    );
  }

  if (isOpenStreamFailure(raw)) {
    return new Error(
      'Could not open a printer stream over Bluetooth. Pair the printer in Android Bluetooth settings, make sure it is not connected to another phone, reconnect it in-app, and retry.'
    );
  }

  if (isUnsupportedPrinterModelError(raw)) {
    return createUnsupportedModelError(extractUnsupportedModelFromError(raw));
  }

  return new Error(raw || fallbackMessage);
};

const resolveLabelSize = (options: BrotherDirectPrintOptions): BPQLLabelSize => {
  if (options.labelSize !== undefined) return options.labelSize;

  const width = Number(options.labelWidthMm);
  if (!Number.isFinite(width) || width <= 0) return BPQLLabelSize.RollW62;

  if (width <= 12) return BPQLLabelSize.RollW12;
  if (width <= 29) return BPQLLabelSize.RollW29;
  if (width <= 38) return BPQLLabelSize.RollW38;
  if (width <= 50) return BPQLLabelSize.RollW50;
  if (width <= 54) return BPQLLabelSize.RollW54;
  return BPQLLabelSize.RollW62;
};

const buildPrintSettings = (options: BrotherDirectPrintOptions): BPPrintSettings => ({
  labelSize: resolveLabelSize(options),
  autoCutForEachPageCount: 1,
  autoCut: true,
  cutAtEnd: true,
  resolution: BPResolution.Normal,
  halftone: BPHalftone.PatternDither,
});

const extractBase64PayloadFromDataUrl = (dataUrl: string) => {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/i);
  if (!match?.[2]) {
    throw new Error('Unable to generate QR image payload for Brother printing.');
  }

  return {
    mimeType: String(match[1] || 'image/png').toLowerCase(),
    base64: match[2],
  };
};

const extensionForMimeType = (mimeType: string) => {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
};

const buildQrDataUrl = (value: string, options: BrotherDirectPrintOptions) => {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();

  const moduleScale = Math.max(2, Math.round(options.moduleScale ?? 6));
  const marginModules = Math.max(0, Math.round(options.marginModules ?? 2));
  return qr.createDataURL(moduleScale, marginModules);
};

const writeQrImageToCache = (value: string, options: BrotherDirectPrintOptions) => {
  const fromOption = String(options.qrImageBase64 || '').trim();
  const payload = fromOption
    ? {
        mimeType: 'image/png',
        base64: fromOption,
      }
    : extractBase64PayloadFromDataUrl(buildQrDataUrl(value, options));

  const extension = extensionForMimeType(payload.mimeType);
  const file = new File(
    Paths.cache,
    'brother-qr-print',
    `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  );
  file.create({ overwrite: true, intermediates: true });
  file.write(payload.base64, { encoding: 'base64' });

  return file.uri;
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

const buildQrHtml = (value: string, options: BrotherDirectPrintOptions) => {
  const qrSvg = buildQrSvgMarkup(value, options.moduleScale ?? 6, options.marginModules ?? 2);
  const width = Number(options.labelWidthMm);
  const isNarrowLabel = Number.isFinite(width) && width > 0 && width <= 12;

  const caption = String(options.caption || '').trim();
  const safeCaption = caption ? escapeHtml(caption) : '';

  const logoText = String(options.logoText || 'IPAC').trim();
  const safeLogoText = logoText ? escapeHtml(logoText) : '';
  const requestedPlacement = options.logoPlacement ?? 'auto';
  const logoPlacement =
    requestedPlacement === 'auto'
      ? isNarrowLabel
        ? 'above-qr'
        : 'inside-qr'
      : requestedPlacement;

  const showLogoAbove = safeLogoText && logoPlacement === 'above-qr';
  const showLogoInside = safeLogoText && logoPlacement === 'inside-qr';

  const sheetPaddingY = isNarrowLabel ? 8 : 16;
  const sheetPaddingX = isNarrowLabel ? 6 : 12;
  const topLogoFontSize = isNarrowLabel ? 9 : 12;
  const insideLogoFontSize = isNarrowLabel ? 8 : 11;
  const captionFontSize = isNarrowLabel ? 9 : 11;
  const captionMarginTop = isNarrowLabel ? 4 : 8;
  const insideLogoPadding = isNarrowLabel ? '1px 3px' : '2px 5px';

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
        width: 100%;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: ${sheetPaddingY}px ${sheetPaddingX}px;
        box-sizing: border-box;
      }
      .qr-wrap {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .qr-wrap.inside {
        position: relative;
      }
      .logo-top {
        font-size: ${topLogoFontSize}px;
        font-weight: 700;
        letter-spacing: 0.4px;
        color: #111827;
        margin-bottom: 4px;
      }
      .logo-inside {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: ${insideLogoPadding};
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: ${insideLogoFontSize}px;
        font-weight: 700;
        line-height: 1;
        color: #111827;
      }
      .caption {
        margin-top: ${captionMarginTop}px;
        font-size: ${captionFontSize}px;
        color: #111827;
        text-align: center;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      ${showLogoAbove ? `<div class="logo-top">${safeLogoText}</div>` : ''}
      <div class="qr-wrap${showLogoInside ? ' inside' : ''}">
        ${qrSvg}
        ${showLogoInside ? `<div class="logo-inside">${safeLogoText}</div>` : ''}
      </div>
      ${safeCaption ? `<div class="caption">${safeCaption}</div>` : ''}
    </div>
  </body>
</html>`;
};

const buildTextHtml = (textValue: string) => {
  const safeText = escapeHtml(textValue.trim());
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
        width: 100%;
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        box-sizing: border-box;
      }
      .text {
        font-size: 42px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #000000;
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

const searchBluetoothChannels = async (
  onStatus?: (status: string) => void
): Promise<BluetoothSearchResult> => {
  onStatus?.('Searching Brother printers via Bluetooth...');

  const hasBluetoothPermission = await ensureAndroidBluetoothPermissions(onStatus);
  if (!hasBluetoothPermission) {
    return {
      channels: [],
      permissionDenied: true,
    };
  }

  try {
    const channels = await BrotherPrinterSDK.searchBluetoothPrinters();
    onStatus?.(`Bluetooth devices discovered: ${channels.length}`);
    return {
      channels,
      permissionDenied: false,
    };
  } catch (error) {
    const normalizedError = normalizeBrotherError(
      error,
      'Failed to search Bluetooth Brother printers.'
    );

    if (isBluetoothPermissionDeniedMessage(normalizedError.message)) {
      onStatus?.(
        'Bluetooth permission denied. Enable Nearby devices permission in Android settings.'
      );
      return {
        channels: [],
        permissionDenied: true,
      };
    }

    onStatus?.('Bluetooth search failed.');
    throw normalizedError;
  }
};

type BrotherChannelDiscoveryResult = {
  channels: BPChannel[];
  permissionDenied: boolean;
  rawCount: number;
  filteredCount: number;
};

const discoverBrotherChannels = async (
  options: BrotherDirectPrintOptions
): Promise<BrotherChannelDiscoveryResult> => {
  const preferred = options.preferredConnection ?? 'auto';
  const onStatus = options.onStatus;
  const hint = String(options.printerAddressHint || '').trim();

  const bluetoothSearch =
    preferred === 'wifi'
      ? { channels: [], permissionDenied: false }
      : await searchBluetoothChannels(onStatus);
  const bluetoothChannels = bluetoothSearch.channels;

  const networkChannels = preferred === 'bluetooth' ? [] : await searchNetworkChannels(options, onStatus);

  const combined =
    preferred === 'wifi'
      ? [...networkChannels, ...bluetoothChannels]
      : preferred === 'bluetooth'
        ? [...bluetoothChannels, ...networkChannels]
        : [...bluetoothChannels, ...networkChannels];

  const uniqueChannels = dedupeChannels(combined);
  const brotherChannels = uniqueChannels.filter((channel) => isLikelyBrotherChannel(channel, options));

  const channels =
    brotherChannels.length > 0
      ? brotherChannels
      : hint
        ? uniqueChannels.filter((channel) => matchesHint(channel, hint))
        : [];

  onStatus?.(
    `Discovery summary: ${uniqueChannels.length} device(s), ${brotherChannels.length} Brother candidate(s).`
  );

  return {
    channels,
    permissionDenied: bluetoothSearch.permissionDenied,
    rawCount: uniqueChannels.length,
    filteredCount: brotherChannels.length,
  };
};

const searchNetworkChannels = async (
  options: BrotherDirectPrintOptions,
  onStatus?: (status: string) => void
): Promise<BPChannel[]> => {
  const models = (options.networkPrinterModels || DEFAULT_BROTHER_PRINTER_MODELS)
    .map((value) => value.trim())
    .filter(Boolean);

  const searchOptions: BPNetworkSearchOptions = {
    printerList: models,
    searchDuration: Math.max(500, Math.round(options.scanTimeoutMs ?? DEFAULT_NETWORK_SEARCH_DURATION_MS)),
    isTethering: false,
  };

  onStatus?.('Searching Brother printers via WiFi...');
  try {
    const channels = await BrotherPrinterSDK.searchNetworkPrinters(searchOptions);
    onStatus?.(`WiFi printers found: ${channels.length}`);
    return channels;
  } catch (error) {
    onStatus?.('WiFi search failed.');
    throw normalizeBrotherError(error, 'Failed to search network Brother printers.');
  }
};

const matchesHint = (channel: BPChannel, hint: string) => {
  const token = hint.toLowerCase();
  const values = [channel.address, channel.modelName, channel.serialNumber, channel.nodeName, channel.alias]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return values.some((value) => value.includes(token));
};

const typePriority = (type: BPChannelType, preferred: PrintConnectionPreference) => {
  if (preferred === 'wifi') return type === BPChannelType.WiFi ? 0 : 1;
  if (preferred === 'bluetooth') {
    return type === BPChannelType.BluetoothLowEnergy || type === BPChannelType.BluetoothMFi ? 0 : 1;
  }
  return type === BPChannelType.WiFi ? 0 : 1;
};

const pickPreferredChannel = (
  channels: BPChannel[],
  options: BrotherDirectPrintOptions
): BPChannel | null => {
  if (channels.length === 0) return null;

  const preferred = options.preferredConnection ?? 'auto';
  const hint = String(options.printerAddressHint || '').trim();

  if (hint) {
    const hinted = channels.find((channel) => matchesHint(channel, hint));
    if (hinted) return hinted;
  }

  return [...channels].sort((a, b) => {
    const supportDiff =
      Number(isModelSupportedForDirectPrint(b.modelName)) -
      Number(isModelSupportedForDirectPrint(a.modelName));
    if (supportDiff !== 0) return supportDiff;

    const typeDiff = typePriority(a.type, preferred) - typePriority(b.type, preferred);
    if (typeDiff !== 0) return typeDiff;

    const modelDiff = String(a.modelName || '').localeCompare(String(b.modelName || ''));
    if (modelDiff !== 0) return modelDiff;

    return String(a.address || '').localeCompare(String(b.address || ''));
  })[0];
};

const resolveBrotherChannel = async (options: BrotherDirectPrintOptions): Promise<BPChannel> => {
  const onStatus = options.onStatus;
  const discovery = await discoverBrotherChannels(options);
  const channels = discovery.channels;

  const selected = pickPreferredChannel(channels, options);
  if (!selected) {
    if (discovery.permissionDenied && discovery.filteredCount === 0) {
      throw new Error(
        'Bluetooth permission is denied. Enable Nearby devices permission for this app in Android settings, then retry. If your printer supports WiFi, connect both phone and printer to the same network and retry.'
      );
    }

    throw new Error(
      'No Brother printer found. Open Connect Printer, select your printer from the discovered device list, then retry printing.'
    );
  }

  if (!isModelSupportedForDirectPrint(selected.modelName)) {
    throw createUnsupportedModelError(selected.modelName || null);
  }

  onStatus?.(`Using ${selected.modelName} via ${channelTypeLabel(selected.type)} (${selected.address}).`);
  return selected;
};

const resolveActiveBrotherChannel = async (
  options: BrotherDirectPrintOptions
): Promise<BPChannel> => {
  const canReuseCachedChannel =
    !!detectedBrotherChannel &&
    (!options.printerAddressHint || matchesHint(detectedBrotherChannel, options.printerAddressHint));

  const channel = canReuseCachedChannel
    ? detectedBrotherChannel
    : await resolveBrotherChannel(options);

  if (!channel) {
    throw new Error('No Brother printer channel available. Connect a printer and try again.');
  }

  if (canReuseCachedChannel) {
    options.onStatus?.(
      `Using selected printer ${channel.modelName || 'Brother Printer'} via ${channelTypeLabel(channel.type)} (${channel.address}).`
    );
  }

  detectedBrotherPrinter = mapChannelToDetectedPrinter(channel);
  detectedBrotherChannel = channel;
  return channel;
};

export async function listBrotherPrinters(
  options: BrotherDirectPrintOptions = {}
): Promise<BrotherDetectedPrinter[]> {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const discovery = await discoverBrotherChannels(effectiveOptions);

  return discovery.channels
    .map(mapChannelToDetectedPrinter)
    .sort((first, second) => {
      const typeDiff = typePriority(first.channelType, effectiveOptions.preferredConnection ?? 'auto') -
        typePriority(second.channelType, effectiveOptions.preferredConnection ?? 'auto');
      if (typeDiff !== 0) return typeDiff;

      const modelDiff = first.modelName.localeCompare(second.modelName);
      if (modelDiff !== 0) return modelDiff;

      return first.address.localeCompare(second.address);
    });
}

export const getDetectedBrotherPrinter = (): BrotherDetectedPrinter | null => detectedBrotherPrinter;

export const clearDetectedBrotherPrinter = (): void => {
  detectedBrotherPrinter = null;
  detectedBrotherChannel = null;
};

export async function detectBrotherPrinter(
  options: BrotherDirectPrintOptions = {}
): Promise<BrotherDetectedPrinter> {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const channel = await resolveBrotherChannel(effectiveOptions);
  const detected = mapChannelToDetectedPrinter(channel);
  detectedBrotherPrinter = detected;
  detectedBrotherChannel = channel;
  return detected;
}

const printHtmlWithBrother = async (html: string, options: BrotherDirectPrintOptions = {}) => {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const channel = await resolveActiveBrotherChannel(effectiveOptions);
  const settings = buildPrintSettings(effectiveOptions);

  const pdf = await Print.printToFileAsync({ html });
  if (!pdf?.uri) {
    throw new Error('Failed to generate printable document.');
  }

  effectiveOptions.onStatus?.('Sending print job to Brother printer...');
  try {
    await BrotherPrinterSDK.printPDF(pdf.uri, channel, settings);
  } catch (error) {
    throw normalizeBrotherError(error, 'Brother print job failed.');
  }

  const postDelay = Math.max(0, Math.round(effectiveOptions.postPrintDelayMs ?? DEFAULT_POST_PRINT_DELAY_MS));
  if (postDelay > 0) {
    await delay(postDelay);
  }

  effectiveOptions.onStatus?.('Brother print job sent.');
};

const printQrImageWithBrother = async (
  qrValue: string,
  options: BrotherDirectPrintOptions = {}
) => {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const channel = await resolveActiveBrotherChannel(effectiveOptions);
  const settings = buildPrintSettings(effectiveOptions);
  const imageUri = writeQrImageToCache(qrValue, effectiveOptions);

  effectiveOptions.onStatus?.('Sending QR image to Brother printer...');
  const channelCandidates = buildChannelModelCandidates(channel)
    .flatMap((candidate) => buildChannelTransportCandidates(candidate));

  let lastRetryableError: unknown = null;

  for (let index = 0; index < channelCandidates.length; index += 1) {
    const candidateChannel = channelCandidates[index];
    const attemptLabel =
      `${channelTypeLabel(candidateChannel.type)} ` +
      `${candidateChannel.address} ` +
      `(${candidateChannel.modelName || 'unknown'})`;

    try {
      effectiveOptions.onStatus?.(`Printing with ${attemptLabel}...`);
      await BrotherPrinterSDK.printImage(imageUri, candidateChannel, settings);
      lastRetryableError = null;
      break;
    } catch (error) {
      const message = String((error as any)?.message || error || '');
      const isRetryable = isPrinterModelError(message) || isOpenStreamFailure(message);
      if (isRetryable && index < channelCandidates.length - 1) {
        lastRetryableError = error;
        await delay(500);
        continue;
      }

      throw normalizeBrotherError(error, 'Brother image print job failed.');
    }
  }

  if (lastRetryableError) {
    throw normalizeBrotherError(lastRetryableError, 'Brother image print job failed.');
  }

  const postDelay = Math.max(0, Math.round(effectiveOptions.postPrintDelayMs ?? DEFAULT_POST_PRINT_DELAY_MS));
  if (postDelay > 0) {
    await delay(postDelay);
  }

  effectiveOptions.onStatus?.('Brother print job sent.');
};

export async function printBrotherTextLabelDirect(
  textValue: string,
  options: BrotherDirectPrintOptions = {}
): Promise<void> {
  const text = String(textValue || '').trim();
  if (!text) {
    throw new Error('Text value is empty.');
  }

  const html = buildTextHtml(text);
  await printHtmlWithBrother(html, options);
}

export async function printBrotherQrLabelDirect(
  qrValue: string,
  options: BrotherDirectPrintOptions = {}
): Promise<void> {
  const value = String(qrValue || '').trim();
  if (!value) {
    throw new Error('QR value is empty.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const channel = await resolveActiveBrotherChannel(effectiveOptions);

  if (isPtSeriesModel(channel.modelName)) {
    effectiveOptions.onStatus?.('PT model detected. Using QR image print mode for compatibility.');
    await printQrImageWithBrother(value, effectiveOptions);
    return;
  }

  const html = buildQrHtml(value, effectiveOptions);

  try {
    await printHtmlWithBrother(html, effectiveOptions);
  } catch (error) {
    const message = String((error as any)?.message || error || '');
    if (isPrinterModelError(message)) {
      throw new Error(
        'PDF print mode is not supported by this printer model in the current SDK. Reconnect the printer and retry.'
      );
    }
    throw error;
  }
}
