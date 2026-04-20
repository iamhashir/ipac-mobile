import * as React from 'react';

import { BrotherPrinterViewProps } from './BrotherPrinter.types';

export default function BrotherPrinterView(props: BrotherPrinterViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
