import { NativeModule, requireNativeModule } from 'expo';

import {
  BrotherNativePrintOptions,
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
    labelWidthMm: number,
    printOptions?: BrotherNativePrintOptions
  ): Promise<BrotherPrintLabelResult>;
  getPrinterStatusAsync(address: string, modelName: string | null): Promise<BrotherStatusResult>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<BrotherPrinterModule>('BrotherPrinter');
