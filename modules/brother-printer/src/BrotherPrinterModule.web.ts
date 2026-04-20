import { registerWebModule, NativeModule } from 'expo';

import {
  BrotherPrintLabelResult,
  BrotherPrinterChannel,
  BrotherPrinterModuleEvents,
  BrotherStatusResult,
} from './BrotherPrinter.types';

const unsupported = () => {
  throw new Error('Brother BRLM local module currently supports Android only.');
};

class BrotherPrinterModule extends NativeModule<BrotherPrinterModuleEvents> {
  async searchBluetoothPrintersAsync(): Promise<BrotherPrinterChannel[]> {
    unsupported();
  }

  async printLabelFileAsync(
    _address: string,
    _filePath: string,
    _modelName: string | null,
    _labelWidthMm: number
  ): Promise<BrotherPrintLabelResult> {
    unsupported();
  }

  async getPrinterStatusAsync(_address: string, _modelName: string | null): Promise<BrotherStatusResult> {
    unsupported();
  }
}

export default registerWebModule(BrotherPrinterModule, 'BrotherPrinter');
