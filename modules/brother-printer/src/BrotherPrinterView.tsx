import { requireNativeView } from 'expo';
import * as React from 'react';

import { BrotherPrinterViewProps } from './BrotherPrinter.types';

const NativeView: React.ComponentType<BrotherPrinterViewProps> =
  requireNativeView('BrotherPrinter');

export default function BrotherPrinterView(props: BrotherPrinterViewProps) {
  return <NativeView {...props} />;
}
