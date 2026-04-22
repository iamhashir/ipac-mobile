import { Alert } from 'react-native';

export interface QrPrintSizePreset {
  id: 'brother-12' | 'brother-36';
  label: string;
  labelWidthMm: number;
  moduleScale: number;
  marginModules: number;
  feedDots: number;
  logoPlacement: 'above-qr' | 'inside-qr';
}

export const QR_PRINT_SIZE_PRESETS: QrPrintSizePreset[] = [
  {
    id: 'brother-12',
    label: '12 mm (Full QR Only)',
    labelWidthMm: 12,
    moduleScale: 2,
    marginModules: 1,
    feedDots: 16,
    logoPlacement: 'above-qr',
  },
  {
    id: 'brother-36',
    label: '36 mm (Full QR Only)',
    labelWidthMm: 36,
    moduleScale: 4,
    marginModules: 2,
    feedDots: 32,
    logoPlacement: 'inside-qr',
  },
];

const PRESET_BROTHER_12 = QR_PRINT_SIZE_PRESETS[0];
const PRESET_BROTHER_36 = QR_PRINT_SIZE_PRESETS[1];

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
      'Pick the Brother QR label format for this print.',
      [
        {
          text: PRESET_BROTHER_12.label,
          onPress: () => finish(PRESET_BROTHER_12),
        },
        {
          text: PRESET_BROTHER_36.label,
          onPress: () => finish(PRESET_BROTHER_36),
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
