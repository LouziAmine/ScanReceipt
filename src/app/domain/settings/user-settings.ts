import { type WeekStart } from '../shared-kernel/date-range';
import { type CurrencyCode } from '../shared-kernel/money';
import { type DateOrder } from '../receipts/reading/receipt-reader';

export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type ImageQuality = 'standard' | 'high';

/** Value object: the person's preferences. */
export interface UserSettings {
  readonly currency: CurrencyCode;
  readonly dateFormat: DateFormat;
  readonly weekStartsOn: WeekStart;
  readonly defaultCategoryId: string;
  readonly imageQuality: ImageQuality;
  readonly warnOnLowConfidence: boolean;
  readonly backupReminder: boolean;
  readonly lastBackupAt: string | null;
  readonly receiptsAtLastBackup: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  weekStartsOn: 0,
  defaultCategoryId: 'other',
  imageQuality: 'high',
  warnOnLowConfidence: true,
  backupReminder: false,
  lastBackupAt: null,
  receiptsAtLastBackup: 0,
};

export function dateOrderOf(format: DateFormat): DateOrder {
  switch (format) {
    case 'MM/DD/YYYY':
      return 'MDY';
    case 'DD/MM/YYYY':
      return 'DMY';
    case 'YYYY-MM-DD':
      return 'YMD';
  }
}
