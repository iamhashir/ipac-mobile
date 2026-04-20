import { PermissionsAndroid, Platform } from 'react-native';
import * as Print from 'expo-print';
import qrcode from 'qrcode-generator';
import BrotherPrinter, {
  BrotherConnectionStateEvent,
  BrotherPrinterChannel,
  BrotherPrinterStatus,
} from '../../modules/brother-printer';

const DEFAULT_POST_PRINT_DELAY_MS = 1200;
const DEFAULT_LABEL_WIDTH_MM = 36;
const BROTHER_NAME_HINTS = ['brother', 'pt-', 'ql-', 'rj-', 'td-', 'pj-', 'mw-'];

type PrintConnectionPreference = 'auto' | 'bluetooth' | 'wifi';
type QrLogoPlacement = 'auto' | 'none' | 'above-qr' | 'inside-qr';

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
  const raw = String((error as any)?.message || error || fallbackMessage).trim();
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

  if (taggedCode === 'BROTHER_OPEN_STREAM_FAILURE' || lowered.includes('openstreamfailure')) {
    return createBrotherError(
      'BROTHER_OPEN_STREAM_FAILURE',
      'Could not open a Bluetooth printer stream. Pair the printer in Android Bluetooth settings, disconnect it from other devices, then reconnect and retry.'
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

const statusMessageFromNativeEvent = (event: BrotherConnectionStateEvent): string | null => {
  const state = String(event?.state || '').trim();
  const address = String(event?.address || '').trim();
  const modelName = String(event?.modelName || '').trim();
  const suffix = [modelName, address].filter(Boolean).join(' ');

  switch (state) {
    case 'searching':
      return 'Searching paired Brother printers...';
    case 'discovered':
      return event.message || 'Printer discovery completed.';
    case 'connecting':
      return suffix ? `Connecting to ${suffix}...` : 'Connecting to printer...';
    case 'connected':
      return suffix ? `Connected to ${suffix}.` : 'Connected to printer.';
    case 'status_check':
      return 'Checking printer status...';
    case 'printing':
      return 'Printing label...';
    case 'printed':
      return 'Label printed successfully.';
    case 'disconnected':
      return suffix ? `Disconnected from ${suffix}.` : 'Printer disconnected.';
    case 'error':
      return event.message || (event.errorCode ? `Printer error (${event.errorCode}).` : 'Printer error.');
    default:
      return null;
  }
};

const addNativeStatusListener = (onStatus?: (status: string) => void): (() => void) => {
  if (typeof onStatus !== 'function') return () => {};

  const addListener = (BrotherPrinter as any)?.addListener;
  if (typeof addListener !== 'function') return () => {};

  const subscription = addListener.call(
    BrotherPrinter,
    'onConnectionStateChange',
    (event: BrotherConnectionStateEvent) => {
      const statusMessage = statusMessageFromNativeEvent(event);
      if (statusMessage) {
        onStatus(statusMessage);
      }
    }
  );

  return () => {
    try {
      subscription?.remove?.();
    } catch {
      // noop
    }
  };
};

const ensureAndroidBluetoothPermissions = async (
  onStatus?: (status: string) => void
): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const requiredPermissions: string[] = [];
  const { BLUETOOTH_CONNECT, BLUETOOTH_SCAN, ACCESS_FINE_LOCATION } = PermissionsAndroid.PERMISSIONS;

  if (BLUETOOTH_CONNECT) requiredPermissions.push(BLUETOOTH_CONNECT);
  if (BLUETOOTH_SCAN) requiredPermissions.push(BLUETOOTH_SCAN);

  const androidVersionRaw = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  const androidVersion = Number.isFinite(androidVersionRaw) ? androidVersionRaw : 0;

  if (androidVersion < 31 && ACCESS_FINE_LOCATION) {
    requiredPermissions.push(ACCESS_FINE_LOCATION);
  }

  const uniquePermissions = [...new Set(requiredPermissions)];
  if (uniquePermissions.length === 0) return true;

  const alreadyGranted = await Promise.all(
    uniquePermissions.map((permission) => PermissionsAndroid.check(permission))
  );
  const missingPermissions = uniquePermissions.filter((_, index) => !alreadyGranted[index]);

  if (missingPermissions.length === 0) return true;

  onStatus?.('Requesting Android Bluetooth permissions...');
  const requestResult = await PermissionsAndroid.requestMultiple(missingPermissions);
  const denied = missingPermissions.filter(
    (permission) => requestResult[permission] !== PermissionsAndroid.RESULTS.GRANTED
  );

  if (denied.length > 0) {
    onStatus?.('Bluetooth permission denied. Enable Nearby devices permission in Android settings.');
    return false;
  }

  return true;
};

let detectedBrotherPrinter: BrotherDetectedPrinter | null = null;

const mapNativeChannel = (channel: BrotherPrinterChannel): BrotherDetectedPrinter => {
  const address = String(channel.address || '').trim() || 'unknown';
  const normalizedConnection = channel.connectionType === 'bluetooth' ? 'bluetooth' : 'unknown';

  return {
    modelName: String(channel.modelName || 'Brother Printer').trim() || 'Brother Printer',
    address,
    serialNumber: channel.serialNumber,
    connectionType: normalizedConnection,
    channelType: channel.channelType,
    detectedAtMs: Date.now(),
  };
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

export const getDetectedBrotherPrinter = (): BrotherDetectedPrinter | null => detectedBrotherPrinter;

export const clearDetectedBrotherPrinter = (): void => {
  detectedBrotherPrinter = null;
};

export async function listBrotherPrinters(
  options: BrotherDirectPrintOptions = {}
): Promise<BrotherDetectedPrinter[]> {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  if (Platform.OS !== 'android') {
    throw new Error('Brother BRLM module currently supports Android only.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const onStatus = effectiveOptions.onStatus;
  const removeNativeStatusListener = addNativeStatusListener(onStatus);

  try {
    if (effectiveOptions.preferredConnection === 'wifi') {
      throw createBrotherError(
        'BROTHER_WIFI_UNSUPPORTED',
        'WiFi discovery is not enabled in this Android BRLM module. Use Bluetooth.'
      );
    }

    const hasPermissions = await ensureAndroidBluetoothPermissions(onStatus);
    if (!hasPermissions) {
      throw createBrotherError(
        'BROTHER_PERMISSION_DENIED',
        'Bluetooth permission is denied. Enable Nearby devices permission and retry.'
      );
    }

    onStatus?.('Searching Brother printers via Bluetooth...');
    const channels = await BrotherPrinter.searchBluetoothPrintersAsync();
    const mapped = channels.map(mapNativeChannel);

    const likelyBrother = mapped.filter(isLikelyBrotherPrinter);
    const results = likelyBrother.length > 0 ? likelyBrother : mapped;

    onStatus?.(`Discovered ${results.length} printer candidate(s).`);
    return results;
  } catch (error) {
    throw normalizeBrotherError(error, 'Failed to search Bluetooth Brother printers.');
  } finally {
    removeNativeStatusListener();
  }
}

export async function detectBrotherPrinter(
  options: BrotherDirectPrintOptions = {}
): Promise<BrotherDetectedPrinter> {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  if (Platform.OS !== 'android') {
    throw new Error('Brother BRLM module currently supports Android only.');
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
  const logoPlacement: QrLogoPlacement = is12mm ? 'above-qr' : 'inside-qr';

  const logoText = escapeHtml(String(options.logoText || 'IPAC').trim());
  const itemNumber = String(options.caption || '').trim();
  const safeItemNumber = escapeHtml(itemNumber);
  const itemNumberFontPx = computeItemFontSizePx(itemNumber.length, labelWidthMm);
  const itemNumberLetterSpacingPx = is12mm ? 0.8 : 2.2;

  const qrSizePx = is12mm ? Math.round(widthPx * 0.72) : Math.round(widthPx * 0.74);
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
        min-height: ${Math.round(widthPx * 1.45)}px;
        padding: ${is12mm ? 12 : 18}px ${is12mm ? 8 : 14}px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: ${is12mm ? 8 : 12}px;
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
      ${showLogoAbove ? `<div class="logo-top">${logoText}</div>` : ''}
      <div class="qr-wrap${showLogoInside ? ' inside' : ''}">
        ${qrMarkup}
        ${showLogoInside ? `<div class="logo-inside">${logoText}</div>` : ''}
      </div>
      ${safeItemNumber ? `<div class="item-number">${safeItemNumber}</div>` : ''}
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

const throwIfStatusBlocked = (status?: BrotherPrinterStatus) => {
  if (!status) return;

  if (status.outOfPaper) {
    throw createBrotherError('BROTHER_OUT_OF_PAPER', 'Printer is out of tape or paper.');
  }

  if (status.coverOpen) {
    throw createBrotherError('BROTHER_COVER_OPEN', 'Printer cover is open.');
  }

  if (status.batteryLow) {
    throw createBrotherError('BROTHER_BATTERY_LOW', 'Printer battery is low.');
  }
};

const printHtmlWithBrother = async (html: string, options: BrotherDirectPrintOptions = {}) => {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  if (Platform.OS !== 'android') {
    throw new Error('Brother BRLM module currently supports Android only.');
  }

  const effectiveOptions = withDetectedPrinterDefaults(options);
  const onStatus = effectiveOptions.onStatus;
  const removeNativeStatusListener = addNativeStatusListener(onStatus);

  try {
    const printer = await resolveActiveBrotherPrinter(effectiveOptions);
    detectedBrotherPrinter = printer;

    const labelWidthMm = resolveLabelWidthMm(effectiveOptions.labelWidthMm);
    if (Number(effectiveOptions.labelWidthMm) > 36) {
      onStatus?.('PT label width requested above 36mm; using 36mm PT settings.');
    }

    onStatus?.('Generating printable document...');
    const pdf = await Print.printToFileAsync({ html });
    if (!pdf?.uri) {
      throw createBrotherError('BROTHER_PDF_GENERATION_FAILED', 'Failed to generate printable document.');
    }

    onStatus?.('Sending print job to Brother printer...');
    const result = await BrotherPrinter.printLabelFileAsync(
      printer.address,
      pdf.uri,
      printer.modelName || null,
      labelWidthMm
    );

    throwIfStatusBlocked(result?.status);

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
  } finally {
    removeNativeStatusListener();
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
