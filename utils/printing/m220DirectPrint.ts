import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import Constants from 'expo-constants';
import qrcode from 'qrcode-generator';

const BLE_SCAN_TIMEOUT_MS = 12000;
const BLE_CHUNK_SIZE = 64;
const BLE_CHUNK_DELAY_MS = 40;
const DEFAULT_POST_PRINT_DELAY_MS = 1800;
const DEFAULT_MAX_RASTER_LINES_PER_BLOCK = 1200;
let hasLoggedWriteFallbackWarning = false;
const BLE_SERVICE_UUID_CANDIDATES = [
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];
const WRITE_CHARACTERISTIC_SUFFIX = 'ff02';
const NOTIFY_CHARACTERISTIC_SUFFIX = 'ff01';

const M220_WIDTH_BYTES = 72; // 576px @ 203 DPI
const DEFAULT_LABEL_WIDTH_MM = 40;

const LABEL_WIDTH_TO_BYTES: Record<number, number> = {
  30: 30,
  40: 40,
  50: 50,
  60: 60,
  70: 70,
  72: 72,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type PrintProtocol = 'm-series' | 'm110';
type RasterAlignment = 'left' | 'center' | 'right';

const resolveWidthBytes = (labelWidthMm?: number): number => {
  if (!labelWidthMm) return LABEL_WIDTH_TO_BYTES[DEFAULT_LABEL_WIDTH_MM];

  const rounded = Math.round(labelWidthMm);
  if (LABEL_WIDTH_TO_BYTES[rounded]) return LABEL_WIDTH_TO_BYTES[rounded];

  const approxBytes = Math.round((rounded * 203) / 25.4 / 8);
  return clamp(approxBytes, 24, M220_WIDTH_BYTES);
};

const normalizeUuid = (uuid: string) => uuid.toLowerCase().replace(/-/g, '');
const uuidEndsWith = (uuid: string, suffix: string) => normalizeUuid(uuid).endsWith(normalizeUuid(suffix));

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isExpoGoRuntime = (): boolean => {
  const ownership = Constants.appOwnership;
  const execution = (Constants as any).executionEnvironment;
  return ownership === 'expo' || execution === 'storeClient';
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

    out += chars[(triplet >> 18) & 0x3f];
    out += chars[(triplet >> 12) & 0x3f];
    out += i + 1 < bytes.length ? chars[(triplet >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? chars[triplet & 0x3f] : '=';
  }

  return out;
};

const isLikelyPhomemo = (device: Device): boolean => {
  const name = `${device.name ?? ''} ${device.localName ?? ''}`.toUpperCase();
  if (!name) return false;

  return (
    name.includes('M220') ||
    name.includes('PHOMEMO') ||
    name.startsWith('M') ||
    name.startsWith('Q')
  );
};

const scoreDevice = (device: Device): number => {
  const name = `${device.name ?? ''} ${device.localName ?? ''}`.toUpperCase();

  if (name.includes('M220')) return 0;
  if (name.startsWith('M')) return 1;
  if (name.includes('PHOMEMO')) return 2;
  if (name.startsWith('Q')) return 3;

  return 9;
};

const densityToHeatTime = (density: number): number => {
  const d = clamp(Math.round(density), 1, 8);
  return clamp(38 + d * 10, 40, 140);
};

const densityToM110Level = (density: number): number => clamp(Math.round(5 + clamp(density, 1, 8) * 1.25), 1, 15);

const cmdInit = () => new Uint8Array([0x1b, 0x40]);
const cmdDensity = (density: number) => new Uint8Array([0x1d, 0x7c, clamp(Math.round(density), 1, 8)]);
const cmdHeatSettings = (density: number) => new Uint8Array([0x1b, 0x37, 0x07, densityToHeatTime(density), 0x02]);
const cmdLineSpacing = (dots: number) => new Uint8Array([0x1b, 0x33, clamp(Math.round(dots), 0, 255)]);
const cmdM110Speed = (speed: number) => new Uint8Array([0x1b, 0x4e, 0x0d, clamp(Math.round(speed), 1, 10)]);
const cmdM110Density = (density: number) => new Uint8Array([0x1b, 0x4e, 0x04, clamp(Math.round(density), 1, 15)]);
const cmdM110MediaType = (type: number) => new Uint8Array([0x1f, 0x11, clamp(Math.round(type), 0, 255)]);
const cmdM110Footer = () => new Uint8Array([0x1f, 0xf0, 0x05, 0x00, 0x1f, 0xf0, 0x03, 0x00]);
const cmdFeed = (dots: number) => new Uint8Array([0x1b, 0x4a, clamp(Math.round(dots), 0, 255)]);
const cmdRasterHeader = (widthBytes: number, heightLines: number) =>
  new Uint8Array([
    0x1d,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    heightLines & 0xff,
    (heightLines >> 8) & 0xff,
  ]);

interface RasterResult {
  data: Uint8Array;
  widthBytes: number;
  heightLines: number;
}

const TEXT_GLYPH_WIDTH = 5;
const TEXT_GLYPH_HEIGHT = 7;
const TEXT_GLYPH_SPACING = 1;

const TEXT_GLYPHS_5X7: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '?': ['01110', '10001', '00010', '00100', '00100', '00000', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00001', '00001', '00001', '00001', '10001', '10001', '01110'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '11100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
  '/': ['00001', '00010', '00100', '01000', '10000', '00000', '00000'],
  ':': ['00000', '00110', '00110', '00000', '00110', '00110', '00000'],
};

const buildQrRaster = (
  value: string,
  widthBytes: number,
  preferredScale = 8,
  marginModules = 4,
  maxContentWidthBytes?: number,
  alignment: RasterAlignment = 'center'
): RasterResult => {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const totalModules = moduleCount + marginModules * 2;
  const widthPixels = widthBytes * 8;
  const maxContentWidthPixels = clamp((maxContentWidthBytes ?? widthBytes) * 8, 8, widthPixels);

  const maxScale = Math.max(1, Math.floor(maxContentWidthPixels / totalModules));
  const moduleScale = clamp(preferredScale, 1, maxScale);

  const qrPixels = totalModules * moduleScale;
  const offsetX =
    alignment === 'left'
      ? 0
      : alignment === 'right'
        ? Math.max(0, widthPixels - qrPixels)
        : Math.floor((widthPixels - qrPixels) / 2);
  const heightLines = qrPixels;

  const raster = new Uint8Array(widthBytes * heightLines);

  const setBlackPixel = (x: number, y: number) => {
    if (x < 0 || x >= widthPixels || y < 0 || y >= heightLines) return;

    const byteIndex = y * widthBytes + Math.floor(x / 8);
    const bitMask = 1 << (7 - (x % 8));
    raster[byteIndex] |= bitMask;
  };

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.isDark(row, col)) continue;

      const pixelXStart = offsetX + (marginModules + col) * moduleScale;
      const pixelYStart = (marginModules + row) * moduleScale;

      for (let dy = 0; dy < moduleScale; dy += 1) {
        for (let dx = 0; dx < moduleScale; dx += 1) {
          setBlackPixel(pixelXStart + dx, pixelYStart + dy);
        }
      }
    }
  }

  return { data: raster, widthBytes, heightLines };
};

const buildTextRaster = (
  value: string,
  widthBytes: number,
  preferredScale = 6,
  horizontalMarginDots = 12,
  verticalMarginDots = 14,
  alignment: RasterAlignment = 'center'
): RasterResult => {
  const lines = String(value)
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.trimEnd());

  const safeLines = lines.length > 0 ? lines : ['?'];
  const widthPixels = widthBytes * 8;
  const safeHorizontalMargin = clamp(Math.round(horizontalMarginDots), 0, Math.floor(widthPixels / 3));
  const safeVerticalMargin = clamp(Math.round(verticalMarginDots), 0, 120);

  const getLineUnits = (line: string): number => {
    const printableLine = line.length > 0 ? line : ' ';
    return printableLine.length * TEXT_GLYPH_WIDTH + Math.max(0, printableLine.length - 1) * TEXT_GLYPH_SPACING;
  };

  const maxLineUnits = Math.max(1, ...safeLines.map(getLineUnits));
  const maxTextWidthPixels = Math.max(8, widthPixels - safeHorizontalMargin * 2);
  const maxScale = Math.max(1, Math.floor(maxTextWidthPixels / maxLineUnits));
  const scale = clamp(Math.round(preferredScale), 1, maxScale);
  const lineGapPixels = Math.max(1, Math.floor(scale / 2));

  const textHeightPixels =
    safeLines.length * TEXT_GLYPH_HEIGHT * scale + Math.max(0, safeLines.length - 1) * lineGapPixels;
  const heightLines = Math.max(1, textHeightPixels + safeVerticalMargin * 2);

  const raster = new Uint8Array(widthBytes * heightLines);

  const setBlackPixel = (x: number, y: number) => {
    if (x < 0 || x >= widthPixels || y < 0 || y >= heightLines) return;

    const byteIndex = y * widthBytes + Math.floor(x / 8);
    const bitMask = 1 << (7 - (x % 8));
    raster[byteIndex] |= bitMask;
  };

  safeLines.forEach((line, lineIndex) => {
    const printableLine = line.length > 0 ? line : ' ';
    const lineWidthUnits = getLineUnits(printableLine);
    const lineWidthPixels = lineWidthUnits * scale;

    const startX =
      alignment === 'left'
        ? safeHorizontalMargin
        : alignment === 'right'
          ? Math.max(0, widthPixels - safeHorizontalMargin - lineWidthPixels)
          : Math.max(0, Math.floor((widthPixels - lineWidthPixels) / 2));

    const startY = safeVerticalMargin + lineIndex * (TEXT_GLYPH_HEIGHT * scale + lineGapPixels);

    for (let charIndex = 0; charIndex < printableLine.length; charIndex += 1) {
      const char = printableLine[charIndex];
      const glyph = TEXT_GLYPHS_5X7[char] ?? TEXT_GLYPHS_5X7['?'];
      const charX = startX + charIndex * (TEXT_GLYPH_WIDTH + TEXT_GLYPH_SPACING) * scale;

      for (let row = 0; row < TEXT_GLYPH_HEIGHT; row += 1) {
        const rowPattern = glyph[row] ?? '00000';
        for (let col = 0; col < TEXT_GLYPH_WIDTH; col += 1) {
          if (rowPattern[col] !== '1') continue;

          const pixelXStart = charX + col * scale;
          const pixelYStart = startY + row * scale;

          for (let dy = 0; dy < scale; dy += 1) {
            for (let dx = 0; dx < scale; dx += 1) {
              setBlackPixel(pixelXStart + dx, pixelYStart + dy);
            }
          }
        }
      }
    }
  });

  return { data: raster, widthBytes, heightLines };
};

const ensureBluetoothPermissions = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);

  if (androidVersion >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    const scanGranted = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
    const connectGranted = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;

    if (!scanGranted || !connectGranted) {
      throw new Error('Bluetooth permissions are required for direct printing.');
    }

    return;
  }

  const fineLocation = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  if (fineLocation !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Location permission is required for Bluetooth scanning on this Android version.');
  }
};

const waitForPoweredOn = async (manager: BleManager): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const sub = manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        sub.remove();
        resolve();
      }
    }, true);

    setTimeout(() => {
      try {
        sub.remove();
      } catch (_) {
        // Ignore cleanup errors.
      }
      reject(new Error('Bluetooth is not powered on. Please enable Bluetooth and retry.'));
    }, 8000);
  });
};

const scanForBestPrinter = async (
  manager: BleManager,
  timeoutMs: number,
  onStatus?: (status: string) => void
): Promise<Device> => {
  return new Promise<Device>((resolve, reject) => {
    const candidates = new Map<string, Device>();
    let settled = false;

    const cleanup = async () => {
      try {
        await manager.stopDeviceScan();
      } catch (_) {
        // Ignore cleanup errors.
      }
    };

    const finishWithDevice = async (device: Device) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await cleanup();
      resolve(device);
    };

    const finishWithError = async (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await cleanup();
      reject(err);
    };

    const timer = setTimeout(async () => {
      const ranked = Array.from(candidates.values()).sort((a, b) => scoreDevice(a) - scoreDevice(b));
      if (ranked.length === 0) {
        await finishWithError(new Error('No Phomemo-compatible printer found. Ensure M220 is on and not connected to another app.'));
        return;
      }

      const topName = ranked[0].name || ranked[0].localName || ranked[0].id;
      onStatus?.(`Printer found: ${topName}`);

      await finishWithDevice(ranked[0]);
    }, timeoutMs);

    onStatus?.('Searching for nearby M220 printer...');

    try {
      manager.startDeviceScan(null, { allowDuplicates: false }, async (error, scannedDevice) => {
        if (error) {
          await finishWithError(new Error(error.message || 'Bluetooth scan failed.'));
          return;
        }

        if (!scannedDevice || !isLikelyPhomemo(scannedDevice)) return;

        candidates.set(scannedDevice.id, scannedDevice);

        const name = `${scannedDevice.name ?? ''} ${scannedDevice.localName ?? ''}`.toUpperCase();
        if (name.includes('M220')) {
          onStatus?.(`Printer found: ${scannedDevice.name || scannedDevice.localName || scannedDevice.id}`);
          await finishWithDevice(scannedDevice);
        }
      });
    } catch (scanError: any) {
      void finishWithError(new Error(scanError?.message || 'Unable to start Bluetooth scan.'));
    }
  });
};

interface ConnectedPrinter {
  device: Device;
  serviceUUID: string;
  writeCharacteristic: Characteristic;
  notifyCharacteristic: Characteristic | null;
}

const resolvePrintProtocol = (device: Device, protocolOverride?: 'auto' | PrintProtocol): PrintProtocol => {
  if (protocolOverride === 'm-series' || protocolOverride === 'm110') {
    return protocolOverride;
  }

  const upperName = `${device.name ?? ''} ${device.localName ?? ''}`.toUpperCase();

  // M220 devices frequently broadcast as Q-prefixed serial strings and require
  // the M110 command set, including the footer, to flush buffered print jobs.
  if (upperName.startsWith('Q') || upperName.startsWith('M220') || upperName.includes('M220')) {
    return 'm110';
  }

  if (upperName.includes('M110') || upperName.includes('M120')) {
    return 'm110';
  }

  return 'm-series';
};

const resolvePrinterHeadWidthBytes = (device: Device, protocol: PrintProtocol): number => {
  const upperName = `${device.name ?? ''} ${device.localName ?? ''}`.toUpperCase();

  // M220 family keeps a 72-byte head even when using M110 command framing.
  if (upperName.startsWith('Q') || upperName.includes('M220') || upperName.includes('M221')) return 72;
  if (upperName.includes('M250') || upperName.includes('M260')) return 72;
  if (upperName.includes('M200')) return 76;
  if (protocol === 'm110' || upperName.includes('M110') || upperName.includes('M120')) return 48;
  if (upperName.includes('M02') || upperName.includes('T02')) return 48;
  if (upperName.includes('M03') || upperName.includes('M04')) return 54;

  // Unknown M-series devices default to 72 bytes, matching myphomemo's default profile.
  return M220_WIDTH_BYTES;
};

const resolveRasterAlignment = (device: Device): RasterAlignment => {
  const upperName = `${device.name ?? ''} ${device.localName ?? ''}`.toUpperCase();

  if (upperName.startsWith('Q') || upperName.startsWith('M220') || upperName.includes('M110S')) {
    return 'right';
  }

  return 'center';
};

const findWritableCharacteristic = async (device: Device): Promise<ConnectedPrinter> => {
  const connected = await device.connect();
  const ready = await connected.discoverAllServicesAndCharacteristics();
  const services = await ready.services();

  const scoredServices = [...services].sort((a, b) => {
    const aIdx = BLE_SERVICE_UUID_CANDIDATES.findIndex((uuid) => normalizeUuid(uuid) === normalizeUuid(a.uuid));
    const bIdx = BLE_SERVICE_UUID_CANDIDATES.findIndex((uuid) => normalizeUuid(uuid) === normalizeUuid(b.uuid));
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  for (const service of scoredServices) {
    const chars = await ready.characteristicsForService(service.uuid);

    const preferred = chars.find(
      (char) => uuidEndsWith(char.uuid, WRITE_CHARACTERISTIC_SUFFIX) && (char.isWritableWithoutResponse || char.isWritableWithResponse)
    );

    const writeChar = preferred ?? chars.find((char) => char.isWritableWithoutResponse || char.isWritableWithResponse);
    if (!writeChar) continue;

    // Subscribe to the notify characteristic (ff01) so the BLE bridge forwards
    // data to the print head. Some Phomemo bridges hold the UART in reset until
    // the host enables notifications (CCCD = 0x0001).
    const notifyChar = chars.find((char) => uuidEndsWith(char.uuid, NOTIFY_CHARACTERISTIC_SUFFIX) && char.isNotifiable) ?? null;
    if (notifyChar) {
      try {
        // monitorCharacteristicForService is synchronous (returns Subscription).
        // Calling it writes the CCCD descriptor, enabling BLE notifications on the
        // printer's ff01 characteristic so the UART bridge forwards data to the print head.
        ready.monitorCharacteristicForService(
          service.uuid,
          notifyChar.uuid,
          () => { /* status notifications — ignored */ }
        );
      } catch (_) {
        // Non-fatal: proceed even if notifications can't be enabled.
      }
    }

    return { device: ready, serviceUUID: service.uuid, writeCharacteristic: writeChar, notifyCharacteristic: notifyChar };
  }

  throw new Error('Connected to printer, but no writable characteristic was found.');
};

type WriteMode = 'auto' | 'withResponse' | 'withoutResponse';

const writePacket = async (printer: ConnectedPrinter, data: Uint8Array, mode: WriteMode = 'auto'): Promise<void> => {
  const payloadBase64 = bytesToBase64(data);

  const canWriteWithoutResponse = printer.writeCharacteristic.isWritableWithoutResponse;
  const canWriteWithResponse = printer.writeCharacteristic.isWritableWithResponse;

  if (mode === 'withResponse') {
    if (canWriteWithResponse) {
      try {
        await printer.device.writeCharacteristicWithResponseForService(
          printer.serviceUUID,
          printer.writeCharacteristic.uuid,
          payloadBase64
        );
        return;
      } catch (writeWithResponseError: any) {
        if (!canWriteWithoutResponse) {
          throw writeWithResponseError;
        }

        // Some M220 firmwares advertise WR but reject it at runtime on ff02.
        // Fall back to WNR for this packet so the print job can continue.
        if (!hasLoggedWriteFallbackWarning) {
          hasLoggedWriteFallbackWarning = true;
          console.warn(
            '[M220 Direct Print] write-with-response failed, falling back to write-without-response.',
            writeWithResponseError?.message || writeWithResponseError
          );
        }
        await delay(25);
        await printer.device.writeCharacteristicWithoutResponseForService(
          printer.serviceUUID,
          printer.writeCharacteristic.uuid,
          payloadBase64
        );
        return;
      }
    }

    if (canWriteWithoutResponse) {
      await printer.device.writeCharacteristicWithoutResponseForService(
        printer.serviceUUID,
        printer.writeCharacteristic.uuid,
        payloadBase64
      );
      return;
    }

    throw new Error('Connected to printer, but write characteristic does not allow write-with-response or write-without-response.');
  }

  if (mode === 'withoutResponse') {
    if (canWriteWithoutResponse) {
      await printer.device.writeCharacteristicWithoutResponseForService(
        printer.serviceUUID,
        printer.writeCharacteristic.uuid,
        payloadBase64
      );
      return;
    }

    if (canWriteWithResponse) {
      await printer.device.writeCharacteristicWithResponseForService(
        printer.serviceUUID,
        printer.writeCharacteristic.uuid,
        payloadBase64
      );
      return;
    }
  }

  if (canWriteWithResponse) {
    await printer.device.writeCharacteristicWithResponseForService(
      printer.serviceUUID,
      printer.writeCharacteristic.uuid,
      payloadBase64
    );
    return;
  }

  if (canWriteWithoutResponse) {
    await printer.device.writeCharacteristicWithoutResponseForService(
      printer.serviceUUID,
      printer.writeCharacteristic.uuid,
      payloadBase64
    );
    return;
  }

  throw new Error('Connected to printer, but write characteristic does not allow writes.');
};

const writeRasterInBlocks = async (
  printer: ConnectedPrinter,
  raster: RasterResult,
  dataWriteMode: WriteMode,
  maxLinesPerBlock: number,
  onStatus?: (status: string) => void
): Promise<void> => {
  const safeMaxLines = clamp(Math.round(maxLinesPerBlock), 1, 4096);
  if (raster.heightLines > safeMaxLines) {
    throw new Error(
      `Raster is ${raster.heightLines} lines, exceeding single GS v 0 limit (${safeMaxLines}). Reduce QR size/scale and retry.`
    );
  }

  // Send header with the SAME mode as data so there is no mode-switch gap
  // mid-stream that could cause the BLE bridge to flush its UART buffer.
  await writePacket(printer, cmdRasterHeader(raster.widthBytes, raster.heightLines), dataWriteMode);
  await delay(20);

  onStatus?.(`Streaming ${raster.data.length} raster bytes in one GS v 0 job...`);
  for (let offset = 0; offset < raster.data.length; offset += BLE_CHUNK_SIZE) {
    const chunk = raster.data.slice(offset, Math.min(offset + BLE_CHUNK_SIZE, raster.data.length));
    await writePacket(printer, chunk, dataWriteMode);
    await delay(BLE_CHUNK_DELAY_MS);
  }

  await delay(80);
};

export interface M220DirectPrintOptions {
  density?: number;
  feedDots?: number;
  moduleScale?: number;
  marginModules?: number;
  scanTimeoutMs?: number;
  labelWidthMm?: number;
  postPrintDelayMs?: number;
  protocolOverride?: 'auto' | PrintProtocol;
  m110MediaType?: number;
  dataWriteMode?: WriteMode;
  maxRasterLinesPerBlock?: number;
  onStatus?: (status: string) => void;
}

export async function printM220TextLabelDirect(
  textValue: string,
  options: M220DirectPrintOptions = {}
): Promise<void> {
  const text = String(textValue || '').trim();
  if (!text) {
    throw new Error('Text value is empty.');
  }

  if (Platform.OS === 'web') {
    throw new Error('Direct BLE printing is not available on web.');
  }

  if (isExpoGoRuntime()) {
    throw new Error(
      'Direct BLE printing is not supported in Expo Go. Use a Development Build (Dev Client) and run with `expo start --dev-client`.'
    );
  }

  await ensureBluetoothPermissions();

  const manager = new BleManager();
  let printer: ConnectedPrinter | null = null;

  try {
    options.onStatus?.('Checking Bluetooth state...');
    await waitForPoweredOn(manager);

    const device = await scanForBestPrinter(manager, options.scanTimeoutMs ?? BLE_SCAN_TIMEOUT_MS, options.onStatus);
    options.onStatus?.(`Connecting to ${device.name || device.localName || 'printer'}...`);
    printer = await findWritableCharacteristic(device);
    options.onStatus?.(`Using characteristic ${printer.writeCharacteristic.uuid.toLowerCase()} (${printer.writeCharacteristic.isWritableWithResponse ? 'WR' : ''}${printer.writeCharacteristic.isWritableWithoutResponse ? '/WNR' : ''})`);

    options.onStatus?.('Pinging printer bridge (battery query)...');
    try {
      await writePacket(printer, new Uint8Array([0x1f, 0x11, 0x08]), 'withResponse');
    } catch (_) {
      // Non-fatal — printer may not respond; proceed anyway.
    }
    await delay(200);

    const protocol = resolvePrintProtocol(device, options.protocolOverride);
    options.onStatus?.(`Using ${protocol === 'm110' ? 'M110-style' : 'M-series'} print protocol...`);

    const printerHeadWidthBytes = resolvePrinterHeadWidthBytes(device, protocol);
    const rasterAlignment = resolveRasterAlignment(device);
    const maxRasterLinesPerBlock = options.maxRasterLinesPerBlock ?? DEFAULT_MAX_RASTER_LINES_PER_BLOCK;

    const textRaster = buildTextRaster(
      text,
      printerHeadWidthBytes,
      options.moduleScale ?? 6,
      (options.marginModules ?? 2) * 8,
      14,
      rasterAlignment
    );

    options.onStatus?.(`Prepared text raster ${textRaster.widthBytes}x${textRaster.heightLines} lines.`);

    const density = clamp(Math.round(options.density ?? 6), 1, 8);
    const feedDots = clamp(Math.round(options.feedDots ?? 48), 0, 255);
    const postPrintDelayMs = clamp(Math.round(options.postPrintDelayMs ?? DEFAULT_POST_PRINT_DELAY_MS), 200, 4000);
    const requestedWriteMode: WriteMode = options.dataWriteMode ?? 'withResponse';
    const dataWriteMode: WriteMode = 'withResponse';

    if (requestedWriteMode !== 'withResponse') {
      options.onStatus?.('Forcing write-with-response for raster text reliability.');
    }

    options.onStatus?.('Sending text print initialization...');
    if (protocol === 'm110') {
      const m110Density = densityToM110Level(density);
      await writePacket(printer, cmdM110Speed(5), 'withResponse');
      await delay(30);

      await writePacket(printer, cmdM110Density(m110Density), 'withResponse');
      await delay(30);

      await writePacket(printer, cmdM110MediaType(options.m110MediaType ?? 10), 'withResponse');
      await delay(30);
    } else {
      await writePacket(printer, cmdInit(), 'withResponse');
      await delay(100);

      await writePacket(printer, cmdHeatSettings(density), 'withResponse');
      await delay(30);

      await writePacket(printer, cmdDensity(density), 'withResponse');
      await delay(40);

      await writePacket(printer, cmdLineSpacing(0), 'withResponse');
      await delay(20);
    }

    options.onStatus?.(`Sending text as raster image: ${text}`);
    await writeRasterInBlocks(printer, textRaster, dataWriteMode, maxRasterLinesPerBlock, options.onStatus);

    if (protocol === 'm110') {
      await delay(300);
      await writePacket(printer, cmdM110Footer(), 'withResponse');
      await delay(postPrintDelayMs);
    } else {
      await delay(300);
      await writePacket(printer, cmdFeed(feedDots), 'withResponse');
      await delay(postPrintDelayMs);
    }

    options.onStatus?.('Text print command sent.');
  } finally {
    if (printer?.device) {
      try {
        const connected = await printer.device.isConnected();
        if (connected) {
          await printer.device.cancelConnection();
        }
      } catch (_) {
        // Ignore disconnect errors.
      }
    }

    try {
      manager.destroy();
    } catch (_) {
      // Ignore manager cleanup errors.
    }
  }
}

export async function printM220QrLabelDirect(
  qrValue: string,
  options: M220DirectPrintOptions = {}
): Promise<void> {
  if (!qrValue || qrValue.trim().length === 0) {
    throw new Error('QR value is empty.');
  }

  if (Platform.OS === 'web') {
    throw new Error('Direct BLE printing is not available on web.');
  }

  if (isExpoGoRuntime()) {
    throw new Error(
      'Direct BLE printing is not supported in Expo Go. Use a Development Build (Dev Client) and run with `expo start --dev-client`.'
    );
  }

  await ensureBluetoothPermissions();

  const manager = new BleManager();
  let printer: ConnectedPrinter | null = null;

  try {
    options.onStatus?.('Checking Bluetooth state...');
    await waitForPoweredOn(manager);

    const device = await scanForBestPrinter(manager, options.scanTimeoutMs ?? BLE_SCAN_TIMEOUT_MS, options.onStatus);
    options.onStatus?.(`Connecting to ${device.name || device.localName || 'printer'}...`);
    printer = await findWritableCharacteristic(device);
    options.onStatus?.(`Using characteristic ${printer.writeCharacteristic.uuid.toLowerCase()} (${printer.writeCharacteristic.isWritableWithResponse ? 'WR' : ''}${printer.writeCharacteristic.isWritableWithoutResponse ? '/WNR' : ''})`);

    // Send a status query to wake the BLE UART bridge before any print commands.
    // Some Phomemo bridges silently discard writes until the host has interacted
    // with them at least once after the notify subscription.
    options.onStatus?.('Pinging printer bridge (battery query)...');
    try {
      await writePacket(printer, new Uint8Array([0x1f, 0x11, 0x08]), 'withResponse');
    } catch (_) {
      // Non-fatal — printer may not respond; proceed anyway.
    }
    await delay(200);
    const protocol = resolvePrintProtocol(device, options.protocolOverride);
    options.onStatus?.(`Using ${protocol === 'm110' ? 'M110-style' : 'M-series'} print protocol...`);

    options.onStatus?.('Connected. Preparing QR label...');

    const labelContentWidthBytes = resolveWidthBytes(options.labelWidthMm ?? DEFAULT_LABEL_WIDTH_MM);
    const printerHeadWidthBytes = resolvePrinterHeadWidthBytes(device, protocol);
    const rasterAlignment = resolveRasterAlignment(device);

    options.onStatus?.(`Raster width ${printerHeadWidthBytes} bytes, content width ${labelContentWidthBytes} bytes, alignment ${rasterAlignment}.`);

    const raster = buildQrRaster(
      qrValue,
      printerHeadWidthBytes,
      options.moduleScale ?? 8,
      options.marginModules ?? 4,
      labelContentWidthBytes,
      rasterAlignment
    );

    const density = clamp(Math.round(options.density ?? 6), 1, 8);
    const feedDots = clamp(Math.round(options.feedDots ?? 32), 0, 255);
    const postPrintDelayMs = clamp(Math.round(options.postPrintDelayMs ?? DEFAULT_POST_PRINT_DELAY_MS), 200, 4000);
    const requestedWriteMode: WriteMode = options.dataWriteMode ?? 'withResponse';
    const dataWriteMode: WriteMode = 'withResponse';
    const maxRasterLinesPerBlock = options.maxRasterLinesPerBlock ?? DEFAULT_MAX_RASTER_LINES_PER_BLOCK;

    if (requestedWriteMode !== 'withResponse') {
      options.onStatus?.('Ignoring non-acknowledged write mode. Forcing write-with-response for raster reliability.');
    }

    options.onStatus?.('Sending data with write-with-response mode...');

    if (protocol === 'm110') {
      const m110Density = densityToM110Level(density);
      await writePacket(printer, cmdM110Speed(5), 'withResponse');
      await delay(30);

      await writePacket(printer, cmdM110Density(m110Density), 'withResponse');
      await delay(30);

      await writePacket(printer, cmdM110MediaType(options.m110MediaType ?? 10), 'withResponse');
      await delay(30);
    } else {
      await writePacket(printer, cmdInit(), 'withResponse');
      await delay(100);

      await writePacket(printer, cmdHeatSettings(density), 'withResponse');
      await delay(30);

      await writePacket(printer, cmdDensity(density), 'withResponse');
      await delay(40);

      await writePacket(printer, cmdLineSpacing(0), 'withResponse');
      await delay(20);
    }

    options.onStatus?.('Sending label data to printer...');
    await writeRasterInBlocks(printer, raster, dataWriteMode, maxRasterLinesPerBlock, options.onStatus);

    if (protocol === 'm110') {
      await delay(300);
      await writePacket(printer, cmdM110Footer(), 'withResponse');
      await delay(postPrintDelayMs);
    } else {
      await delay(300);
      await writePacket(printer, cmdFeed(feedDots), 'withResponse');
      await delay(postPrintDelayMs);
    }

    options.onStatus?.('Print command sent.');
  } finally {
    if (printer?.device) {
      try {
        const connected = await printer.device.isConnected();
        if (connected) {
          await printer.device.cancelConnection();
        }
      } catch (_) {
        // Ignore disconnect errors.
      }
    }

    try {
      manager.destroy();
    } catch (_) {
      // Ignore manager cleanup errors.
    }
  }
}
