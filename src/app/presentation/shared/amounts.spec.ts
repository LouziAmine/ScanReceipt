import { describe, expect, it } from 'vitest';
import { type ReceiptTotals } from '@domain';
import { formatTotals } from './amounts';

const fake = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;
const totals = (patch: Partial<ReceiptTotals>): ReceiptTotals => ({
  count: 0,
  totalCents: 0,
  otherCurrencyCount: 0,
  others: [],
  ...patch,
});

describe('formatTotals', () => {
  it('shows the total alone when every receipt is counted', () => {
    expect(formatTotals(totals({ count: 2, totalCents: 1475 }), 'USD', fake)).toBe('14.75 USD');
  });

  it('shows zero when there is no receipt', () => {
    expect(formatTotals(totals({}), 'MAD', fake)).toBe('0.00 MAD');
  });

  it('adds the other currencies after the total, never into it', () => {
    const value = totals({
      count: 3,
      totalCents: 12000,
      otherCurrencyCount: 2,
      others: [{ currency: 'MAD', cents: 145000, count: 2 }],
    });
    expect(formatTotals(value, 'USD', fake)).toBe('120.00 USD + 1450.00 MAD');
  });

  it('leaves out an empty total when every receipt is in another currency', () => {
    const value = totals({
      count: 2,
      otherCurrencyCount: 2,
      others: [
        { currency: 'MAD', cents: 145000, count: 1 },
        { currency: 'EUR', cents: 1250, count: 1 },
      ],
    });
    expect(formatTotals(value, 'USD', fake)).toBe('1450.00 MAD + 12.50 EUR');
  });
});
