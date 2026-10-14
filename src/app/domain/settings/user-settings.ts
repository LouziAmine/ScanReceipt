import { type WeekStart } from '../shared-kernel/date-range';
import { type CurrencyCode } from '../shared-kernel/money';
import { type DateOrder } from '../receipts/reading/receipt-reader';

export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type ImageQuality = 'standard' | 'high';
/** Light or dark screens; "system" follows the phone or computer setting. */
export type Theme = 'system' | 'light' | 'dark';
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
/** Languages of the screens. English is the default and the language of the source texts. */
export const LANGUAGES = ['en', 'fr', 'ar', 'zh', 'es', 'de', 'pt'] as const;
export type Language = (typeof LANGUAGES)[number];

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

/** Value object: the person's preferences. */
export interface UserSettings {
  readonly language: Language;
  /** Receipts are saved in this currency: those paid in another one are converted. */
  readonly currency: CurrencyCode;
  readonly dateFormat: DateFormat;
  readonly weekStartsOn: WeekStart;
  readonly defaultCategoryId: string;
  readonly imageQuality: ImageQuality;
  readonly theme: Theme;
  readonly warnOnLowConfidence: boolean;
  readonly backupReminder: boolean;
  readonly lastBackupAt: string | null;
  readonly receiptsAtLastBackup: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  weekStartsOn: 0,
  defaultCategoryId: 'other',
  imageQuality: 'high',
  theme: 'system',
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
