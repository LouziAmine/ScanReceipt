import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, Money, Receipt, type ReceiptSnapshot } from '@domain';
import { receiptToText } from './receipt-text';

const receipt = (overrides: Partial<ReceiptSnapshot>): Receipt =>
  Receipt.rehydrate({
    id: '1',
    store: 'Corner Café',
    purchasedAt: new Date(2026, 9, 6, 9, 15),
    total: Money.of(685, 'USD'),
    tax: null,
    original: null,
    categoryId: 'dining',
    note: '',
    imagePath: '',
    ocrText: '',
    doubtfulFields: [],
    createdAt: new Date(2026, 9, 6),
    updatedAt: new Date(2026, 9, 6),
    ...overrides,
  });

describe('receiptToText', () => {
  it('summarizes a receipt typed by hand, without OCR text', () => {
    expect(receiptToText(receipt({}), DEFAULT_CATEGORIES)).toBe(
      'Corner Café\nDate: 2026-10-06 09:15\nTotal: 6.85 USD\nCategory: Dining',
    );
  });

  it('adds the tax, the note and the OCR text when present', () => {
    const text = receiptToText(
      receipt({
        tax: Money.of(52, 'USD'),
        note: 'Team breakfast',
        ocrText: ' CORNER CAFE\nTOTAL 6.85 ',
      }),
      DEFAULT_CATEGORIES,
    );
    expect(text).toBe(
      'Corner Café\nDate: 2026-10-06 09:15\nTotal: 6.85 USD\nSales tax: 0.52 USD\n' +
        'Category: Dining\nNote: Team breakfast\n\nCORNER CAFE\nTOTAL 6.85',
    );
  });
});
