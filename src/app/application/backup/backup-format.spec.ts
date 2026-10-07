import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, Money, Receipt } from '@domain';
import { AppError } from '../shared/app-error';
import { parseBackup, serializeBackup } from './backup-format';

const receipt = Receipt.rehydrate({
  id: 'r1',
  store: 'Sunrise Bakery',
  purchasedAt: new Date(2026, 9, 6, 13, 42),
  total: Money.of(1475, 'USD'),
  tax: Money.of(118, 'USD'),
  categoryId: 'groceries',
  note: 'Team breakfast',
  imagePath: 'images/r1.jpg',
  ocrText: 'SUNRISE BAKERY',
  doubtfulFields: ['date'],
  createdAt: new Date(2026, 9, 6, 13, 45),
  updatedAt: new Date(2026, 9, 6, 13, 45),
});

describe('backup format', () => {
  it('round-trips every aggregate', () => {
    const json = serializeBackup(
      {
        settings: { ...DEFAULT_SETTINGS, currency: 'EUR' },
        categories: DEFAULT_CATEGORIES,
        storeRules: [{ storeKey: 'sunrise bakery', categoryId: 'groceries' }],
        receipts: [receipt],
      },
      new Date(2026, 9, 7),
    );
    const restored = parseBackup(json);
    expect(restored.settings.currency).toBe('EUR');
    expect(restored.categories.map((c) => c.id)).toEqual(DEFAULT_CATEGORIES.map((c) => c.id));
    expect(restored.storeRules).toEqual([{ storeKey: 'sunrise bakery', categoryId: 'groceries' }]);
    expect(restored.receipts[0]?.snapshot()).toEqual(receipt.snapshot());
  });

  it('drops store rules that point to a missing category', () => {
    const json = serializeBackup(
      {
        settings: DEFAULT_SETTINGS,
        categories: DEFAULT_CATEGORIES,
        storeRules: [{ storeKey: 'acme', categoryId: 'gone' }],
        receipts: [],
      },
      new Date(),
    );
    expect(parseBackup(json).storeRules).toEqual([]);
  });

  it.each([
    ['not json', '{'],
    ['another file', '{"format":"other"}'],
    ['a newer version', '{"format":"scanreceipt-backup","version":99}'],
    [
      'a damaged receipt',
      '{"format":"scanreceipt-backup","version":1,"categories":[],"storeRules":[],"receipts":[{"id":1}]}',
    ],
  ])('rejects %s', (_label, json) => {
    expect(() => parseBackup(json)).toThrow(AppError);
  });
});
