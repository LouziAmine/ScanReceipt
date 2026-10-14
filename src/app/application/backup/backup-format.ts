import {
  CATEGORY_COLOR_NAMES,
  CATEGORY_ICONS,
  Category,
  type CategoryColor,
  type CategoryIcon,
  type CurrencyCode,
  DEFAULT_SETTINGS,
  Money,
  type OriginalAmount,
  REVIEWABLE_FIELDS,
  Receipt,
  type ReviewableField,
  SUPPORTED_CURRENCIES,
  isCurrencyCode,
  isLanguage,
  type StoreRule,
  THEMES,
  type Theme,
  type UserSettings,
} from '@domain';
import { AppError } from '../shared/app-error';

export const BACKUP_FORMAT = 'scanreceipt-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_DATA_FILE = 'data.json';

export interface BackupContent {
  readonly settings: UserSettings;
  readonly categories: readonly Category[];
  readonly storeRules: readonly StoreRule[];
  /** Receipts whose `imagePath` names an entry of the archive. */
  readonly receipts: readonly Receipt[];
}

export function serializeBackup(content: BackupContent, exportedAt: Date): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    settings: content.settings,
    categories: content.categories.map((c) => c.snapshot()),
    storeRules: content.storeRules,
    receipts: content.receipts.map((receipt) => {
      const s = receipt.snapshot();
      return {
        ...s,
        total: { cents: s.total.cents, currency: s.total.currency },
        tax: s.tax === null ? null : { cents: s.tax.cents, currency: s.tax.currency },
        original:
          s.original === null
            ? null
            : {
                total: { cents: s.original.total.cents, currency: s.original.total.currency },
                tax:
                  s.original.tax === null
                    ? null
                    : { cents: s.original.tax.cents, currency: s.original.tax.currency },
                rate: s.original.rate,
              },
        purchasedAt: s.purchasedAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    }),
  });
}

/** Anti-corruption layer: a backup file comes from outside the app and is checked field by field. */
export function parseBackup(json: string): BackupContent {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error: unknown) {
    throw new AppError('This file is not a ScanReceipt backup.', { cause: error });
  }
  const root = record(raw, 'backup');
  if (root['format'] !== BACKUP_FORMAT) {
    throw new AppError('This file is not a ScanReceipt backup.');
  }
  if (typeof root['version'] !== 'number' || root['version'] > BACKUP_VERSION) {
    throw new AppError(
      'This backup was made by a newer version of the app. Please update the app first.',
    );
  }

  const categories = list(root['categories'], 'categories').map(toCategory);
  const known = new Set(categories.map((c) => c.id));
  const storeRules = list(root['storeRules'], 'store rules').flatMap((entry): StoreRule[] => {
    const r = entry as Partial<StoreRule> | null;
    return typeof r?.storeKey === 'string' &&
      typeof r.categoryId === 'string' &&
      known.has(r.categoryId)
      ? [{ storeKey: r.storeKey, categoryId: r.categoryId }]
      : [];
  });
  return {
    settings: { ...DEFAULT_SETTINGS, ...toSettings(root['settings']) },
    categories,
    storeRules,
    receipts: list(root['receipts'], 'receipts').map(toReceipt),
  };
}

function toCategory(value: unknown): Category {
  const r = record(value, 'category');
  return Category.rehydrate({
    id: text(r['id'], 'category id'),
    name: text(r['name'], 'category name'),
    color: oneOf<CategoryColor>(r['color'], CATEGORY_COLOR_NAMES, 'gray'),
    icon: oneOf<CategoryIcon>(r['icon'], CATEGORY_ICONS, 'pricetag'),
    isCustom: r['isCustom'] === true,
    sortOrder: typeof r['sortOrder'] === 'number' ? r['sortOrder'] : 0,
  });
}

function toReceipt(value: unknown): Receipt {
  const r = record(value, 'receipt');
  const fields = Array.isArray(r['doubtfulFields']) ? (r['doubtfulFields'] as unknown[]) : [];
  return Receipt.rehydrate({
    id: text(r['id'], 'receipt id'),
    store: text(r['store'], 'store'),
    purchasedAt: date(r['purchasedAt']),
    total: money(r['total']),
    tax: r['tax'] === null || r['tax'] === undefined ? null : money(r['tax']),
    original: original(r['original']),
    categoryId: text(r['categoryId'], 'category'),
    note: typeof r['note'] === 'string' ? r['note'] : '',
    imagePath: text(r['imagePath'], 'photo'),
    ocrText: typeof r['ocrText'] === 'string' ? r['ocrText'] : '',
    doubtfulFields: fields.filter((f): f is ReviewableField =>
      REVIEWABLE_FIELDS.includes(f as ReviewableField),
    ),
    createdAt: date(r['createdAt']),
    updatedAt: date(r['updatedAt']),
  });
}

function toSettings(value: unknown): Partial<UserSettings> {
  if (typeof value !== 'object' || value === null) return {};
  const r = value as Record<string, unknown>;
  const keys = Object.keys(DEFAULT_SETTINGS) as (keyof UserSettings)[];
  const accepted = keys.filter(
    (key) =>
      (key === 'theme'
        ? THEMES.includes(r[key] as Theme)
        : key === 'currency'
          ? isCurrencyCode(r[key])
          : key === 'language'
            ? isLanguage(r[key])
            : typeof r[key] === typeof DEFAULT_SETTINGS[key]) ||
      (key === 'lastBackupAt' && typeof r[key] === 'string'),
  );
  return Object.fromEntries(accepted.map((key) => [key, r[key]]));
}

/** The amounts before conversion; backups made before conversions have none. */
function original(value: unknown): OriginalAmount | null {
  if (value === null || value === undefined) return null;
  const r = record(value, 'amount');
  const rate = r['rate'];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new AppError('The backup is damaged (amount).');
  }
  return {
    total: money(r['total']),
    tax: r['tax'] === null || r['tax'] === undefined ? null : money(r['tax']),
    rate,
  };
}

function money(value: unknown): Money {
  const r = record(value, 'amount');
  const cents = r['cents'];
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) {
    throw new AppError('The backup is damaged (amount).');
  }
  return Money.of(cents, oneOf<CurrencyCode>(r['currency'], SUPPORTED_CURRENCIES, 'USD'));
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError('The backup is damaged ({what}).', { params: { what } });
  }
  return value as Record<string, unknown>;
}

function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value))
    throw new AppError('The backup is damaged ({what}).', { params: { what } });
  return value;
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string')
    throw new AppError('The backup is damaged ({what}).', { params: { what } });
  return value;
}

function date(value: unknown): Date {
  const parsed = typeof value === 'string' ? new Date(value) : new Date(Number.NaN);
  if (Number.isNaN(parsed.getTime())) throw new AppError('The backup is damaged (date).');
  return parsed;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
