export type BrotherConnectionState =
  | 'searching'
  | 'discovered'
  | 'connecting'
  | 'connected'
  | 'status_check'
  | 'printing'
  | 'printed'
  | 'disconnected'
  | 'error';

export type BrotherConnectionStateEvent = {
  state: BrotherConnectionState | string;
  timestampMs: number;
  address?: string;
  modelName?: string;
  errorCode?: string;
  message?: string;
};

export type BrotherPrinterChannel = {
  modelName: string;
  address: string;
  serialNumber?: string;
  alias?: string;
  channelType?: string;
  connectionType: 'bluetooth' | 'unknown';
};

export type BrotherPrinterStatus = {
  model?: string;
  errorCode?: string;
  batteryStatus?: string;
  statusQueryError?: string;
  outOfPaper: boolean;
  coverOpen: boolean;
  batteryLow: boolean;
  statusKey?: 'outOfPaper' | 'coverOpen' | 'batteryLow';
};

export type BrotherPrintLabelResult = {
  status: BrotherPrinterStatus;
};

export type BrotherStatusResult = {
  status: BrotherPrinterStatus;
};

export type BrotherPrinterModuleEvents = {
  onConnectionStateChange: (params: BrotherConnectionStateEvent) => void;
};
