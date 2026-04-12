declare module 'qrcode-generator' {
  interface QRCodeInstance {
    addData(data: string, mode?: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }

  type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  export default function qrcode(typeNumber?: number, errorCorrectionLevel?: ErrorCorrectionLevel): QRCodeInstance;
}
