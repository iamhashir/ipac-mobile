import { Alert } from 'react-native';

export interface QrPrintSizePreset {
  id: '39x29' | '49x49';
  label: string;
  labelWidthMm: number;
  moduleScale: number;
  marginModules: number;
  feedDots: number;
}

export const QR_PRINT_SIZE_PRESETS: QrPrintSizePreset[] = [
  {
    id: '39x29',
    label: '39 x 29 mm',
    labelWidthMm: 39,
    moduleScale: 5,
    marginModules: 2,
    feedDots: 24,
  },
  {
    id: '49x49',
    label: '49 x 49 mm',
    labelWidthMm: 49,
    moduleScale: 7,
    marginModules: 2,
    feedDots: 32,
  },
];

const PRESET_39x29 = QR_PRINT_SIZE_PRESETS[0];
const PRESET_49x49 = QR_PRINT_SIZE_PRESETS[1];

export const chooseQrPrintSizePreset = (): Promise<QrPrintSizePreset | null> => {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (preset: QrPrintSizePreset | null) => {
      if (settled) return;
      settled = true;
      resolve(preset);
    };

    Alert.alert(
      'Choose Label Size',
      'Pick the QR label size for this print.',
      [
        {
          text: PRESET_39x29.label,
          onPress: () => finish(PRESET_39x29),
        },
        {
          text: PRESET_49x49.label,
          onPress: () => finish(PRESET_49x49),
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => finish(null),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => finish(null),
      }
    );
  });
};
