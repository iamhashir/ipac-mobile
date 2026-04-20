import { NativeModule, requireNativeModule } from 'expo';

import {
  BrotherPrintLabelResult,
  BrotherPrinterChannel,
  BrotherPrinterModuleEvents,
  BrotherStatusResult,
} from './BrotherPrinter.types';

declare class BrotherPrinterModule extends NativeModule<BrotherPrinterModuleEvents> {
  searchBluetoothPrintersAsync(): Promise<BrotherPrinterChannel[]>;
  printLabelFileAsync(
    address: string,
    filePath: string,
    modelName: string | null,
    labelWidthMm: number
  ): Promise<BrotherPrintLabelResult>;
  getPrinterStatusAsync(address: string, modelName: string | null): Promise<BrotherStatusResult>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<BrotherPrinterModule>('BrotherPrinter');
