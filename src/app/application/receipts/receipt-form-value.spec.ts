import { describe, expect, it } from 'vitest';
import { Money } from '@domain';
import { type ReceiptFormValue, toReceiptDetails } from './receipt-form-value';

const value: ReceiptFormValue = {
  store: 'Din Tai Fung',
  purchasedAt: new Date(2026, 9, 12, 19, 30),
  totalCents: 4800,
  taxCents: 360,
  currency: 'CNY',
  categoryId: 'dining',
  note: '',
  doubtfulFields: [],
};

describe('toReceiptDetails', () => {
  it('keeps the amounts as they are without a conversion', () => {
    const details = toReceiptDetails(value);
    expect(details.total).toEqual(Money.of(4800, 'CNY'));
    expect(details.original).toBeNull();
  });

  it("saves the receipt in the person's currency and keeps what was paid", () => {
    const details = toReceiptDetails({ ...value, conversion: { currency: 'USD', rate: 0.1427 } });
    expect(details.total).toEqual(Money.of(685, 'USD'));
    expect(details.tax).toEqual(Money.of(51, 'USD'));
    expect(details.original).toEqual({
      total: Money.of(4800, 'CNY'),
      tax: Money.of(360, 'CNY'),
      rate: 0.1427,
    });
  });
});
