export interface PackageInfoChangeEvent {
  infoId: string | null;
  fields: Record<string, any>;
  orderPackageId?: string;
  updatedFinalInfoId?: string | null;
  isFinal?: boolean;
  scope?: 'internal' | 'external';
  source?: 'info' | 'dimensions';
}
