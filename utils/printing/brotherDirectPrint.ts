import { Platform } from 'react-native';
import * as Print from 'expo-print';
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
  'QL-700',
  'QL-710W',
  'QL-720NW',
  'QL-800',
  'QL-810W',
  'QL-820NWB',
  'QL-1100',
  'QL-1110NWB',
];

type PrintConnectionPreference = 'auto' | 'bluetooth' | 'wifi';

export interface BrotherDirectPrintOptions {
  labelWidthMm?: number;
  labelSize?: BPQLLabelSize;
  moduleScale?: number;
  marginModules?: number;
  caption?: string;
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

const isNativeModuleError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('native module') ||
    normalized.includes('cannot find native module') ||
    normalized.includes('expo go')
  );
};

const normalizeBrotherError = (error: unknown, fallbackMessage: string) => {
  const raw = String((error as any)?.message || error || fallbackMessage);
  if (isNativeModuleError(raw)) {
    return new Error(
      'Brother printer SDK requires a Development Build. Expo Go is not supported for this feature.'
    );
  }
  return new Error(raw || fallbackMessage);
};

const resolveLabelSize = (options: BrotherDirectPrintOptions): BPQLLabelSize => {
  if (options.labelSize !== undefined) return options.labelSize;

  const width = Number(options.labelWidthMm);
  if (!Number.isFinite(width) || width <= 0) return BPQLLabelSize.RollW62;

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
  const caption = String(options.caption || '').trim();
  const safeCaption = caption ? escapeHtml(caption) : '';

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
        padding: 16px 12px;
        box-sizing: border-box;
      }
      .qr-wrap {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .caption {
        margin-top: 8px;
        font-size: 11px;
        color: #111827;
        text-align: center;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="qr-wrap">${qrSvg}</div>
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

const searchBluetoothChannels = async (onStatus?: (status: string) => void): Promise<BPChannel[]> => {
  onStatus?.('Searching Brother printers via Bluetooth...');
  try {
    const channels = await BrotherPrinterSDK.searchBluetoothPrinters();
    onStatus?.(`Bluetooth printers found: ${channels.length}`);
    return channels;
  } catch (error) {
    onStatus?.('Bluetooth search failed.');
    throw normalizeBrotherError(error, 'Failed to search Bluetooth Brother printers.');
  }
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
  return type === BPChannelType.BluetoothLowEnergy || type === BPChannelType.BluetoothMFi ? 0 : 1;
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
    const typeDiff = typePriority(a.type, preferred) - typePriority(b.type, preferred);
    if (typeDiff !== 0) return typeDiff;

    const modelDiff = String(a.modelName || '').localeCompare(String(b.modelName || ''));
    if (modelDiff !== 0) return modelDiff;

    return String(a.address || '').localeCompare(String(b.address || ''));
  })[0];
};

const resolveBrotherChannel = async (options: BrotherDirectPrintOptions): Promise<BPChannel> => {
  const preferred = options.preferredConnection ?? 'auto';
  const onStatus = options.onStatus;

  const bluetoothChannels = preferred === 'wifi' ? [] : await searchBluetoothChannels(onStatus);
  const networkChannels = preferred === 'bluetooth' ? [] : await searchNetworkChannels(options, onStatus);

  const channels =
    preferred === 'wifi'
      ? [...networkChannels, ...bluetoothChannels]
      : preferred === 'bluetooth'
        ? [...bluetoothChannels, ...networkChannels]
        : [...bluetoothChannels, ...networkChannels];

  const selected = pickPreferredChannel(channels, options);
  if (!selected) {
    throw new Error(
      'No Brother printer found. Pair a Brother printer in device Bluetooth settings or connect one on the same WiFi network.'
    );
  }

  onStatus?.(`Using ${selected.modelName} via ${channelTypeLabel(selected.type)} (${selected.address}).`);
  return selected;
};

const printHtmlWithBrother = async (html: string, options: BrotherDirectPrintOptions = {}) => {
  if (Platform.OS === 'web') {
    throw new Error('Brother printing is not available on web.');
  }

  const channel = await resolveBrotherChannel(options);
  const settings = buildPrintSettings(options);

  const pdf = await Print.printToFileAsync({ html });
  if (!pdf?.uri) {
    throw new Error('Failed to generate printable document.');
  }

  options.onStatus?.('Sending print job to Brother printer...');
  try {
    await BrotherPrinterSDK.printPDF(pdf.uri, channel, settings);
  } catch (error) {
    throw normalizeBrotherError(error, 'Brother print job failed.');
  }

  const postDelay = Math.max(0, Math.round(options.postPrintDelayMs ?? DEFAULT_POST_PRINT_DELAY_MS));
  if (postDelay > 0) {
    await delay(postDelay);
  }

  options.onStatus?.('Brother print job sent.');
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

  const html = buildQrHtml(value, options);
  await printHtmlWithBrother(html, options);
}
