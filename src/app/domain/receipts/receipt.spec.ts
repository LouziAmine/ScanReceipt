import { describe, expect, it } from 'vitest';
import { DomainError } from '../shared-kernel/domain-error';
import { Money } from '../shared-kernel/money';
import { type ReceiptDetails, Receipt } from './receipt';

const now = new Date(2026, 9, 7, 10, 0);
const usd = (cents: number): Money => Money.of(cents, 'USD');

const details: ReceiptDetails = {
  store: '  Corner   Café ',
  purchasedAt: new Date(2026, 9, 6, 9, 15),
  total: usd(685),
  tax: usd(50),
  categoryId: 'dining',
  note: '',
};

const record = (overrides: Partial<ReceiptDetails> = {}): Receipt =>
  Receipt.record(
    {
      id: 'r1',
      details: { ...details, ...overrides },
      imagePath: 'receipts/r1.jpg',
      ocrText: 'CORNER CAFE',
      doubtfulFields: ['total', 'date', 'total'],
    },
    now,
  );

describe('Receipt aggregate', () => {
  it('normalizes the store name and de-duplicates doubtful fields', () => {
    const receipt = record();
    expect(receipt.store).toBe('Corner Café');
    expect(receipt.doubtfulFields).toEqual(['date', 'total']);
    expect(receipt.needsReview).toBe(true);
  });

  it('stops needing review once every doubtful field is confirmed', () => {
    const later = new Date(2026, 9, 8);
    const receipt = record().confirm('total', later).confirm('date', later);
    expect(receipt.needsReview).toBe(false);
    expect(receipt.updatedAt).toEqual(later);
  });

  it('is immutable', () => {
    const original = record();
    original.markReviewed(now);
    expect(original.needsReview).toBe(true);
  });

  it.each([
    [{ store: ' ' }, 'store'],
    [{ tax: usd(900) }, 'tax'],
    [{ total: usd(-1) }, 'total'],
    [{ purchasedAt: new Date(2027, 0, 1) }, 'date'],
    [{ purchasedAt: new Date(1999, 0, 1) }, 'date'],
  ] as const)('rejects invalid details %o', (overrides, field) => {
    expect(() => record(overrides)).toThrow(DomainError);
    try {
      record(overrides);
    } catch (error: unknown) {
      expect((error as DomainError).field).toBe(field);
    }
  });

  it('validates revisions with the same rules', () => {
    expect(() => record().revise({ ...details, store: '' }, [], now)).toThrow(DomainError);
  });

  it('keeps identity across changes', () => {
    const receipt = record();
    expect(receipt.moveToCategory('other', now).sameAs(receipt)).toBe(true);
  });
});
