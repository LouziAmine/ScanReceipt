import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, Money, Receipt, type ReceiptSnapshot } from '@domain';
import { receiptsToCsv } from './receipt-csv';

const receipt = (overrides: Partial<ReceiptSnapshot>): Receipt =>
  Receipt.rehydrate({
    id: '1',
    store: 'Corner Café',
    purchasedAt: new Date(2026, 9, 6, 9, 15),
    total: Money.of(685, 'USD'),
    tax: null,
    categoryId: 'dining',
    note: '',
    imagePath: '',
    ocrText: '',
    doubtfulFields: [],
    createdAt: new Date(2026, 9, 6),
    updatedAt: new Date(2026, 9, 6),
    ...overrides,
  });

describe('receiptsToCsv', () => {
  it('writes a header and one row per receipt', () => {
    const lines = receiptsToCsv([receipt({})], DEFAULT_CATEGORIES)
      .trimEnd()
      .split('\r\n');
    expect(lines[0]).toBe('﻿Date,Store,Category,Total,Sales tax,Currency,Needs review,Note');
    expect(lines[1]).toBe('2026-10-06 09:15,Corner Café,Dining,6.85,,USD,no,');
  });

  it('quotes commas and quotes', () => {
    expect(receiptsToCsv([receipt({ store: 'Page, "Ink"' })], DEFAULT_CATEGORIES)).toContain(
      '"Page, ""Ink"""',
    );
  });

  it('neutralises spreadsheet formulas', () => {
    expect(receiptsToCsv([receipt({ note: '=HYPERLINK("x")' })], DEFAULT_CATEGORIES)).toContain(
      `"'=HYPERLINK(""x"")"`,
    );
  });
});
