import { describe, expect, it } from 'vitest';
import { DomainError } from './domain-error';
import { Money, parseAmount, sumByCurrency } from './money';

describe('Money', () => {
  it.each([
    ['6.85', 685],
    ['$ 6.85', 685],
    ['1,234.56', 123456],
    ['1.234,56', 123456],
    ['12,50', 1250],
    ['1,234', 123400],
    ['42', 4200],
    ['-3.10', -310],
  ])('parses "%s" as %i cents', (raw, cents) => {
    expect(parseAmount(raw)).toBe(cents);
  });

  it('returns null when there is no digit', () => {
    expect(Money.parse('TOTAL', 'USD')).toBeNull();
  });

  it('adds without floating point drift', () => {
    expect(Money.of(10, 'USD').add(Money.of(20, 'USD')).cents).toBe(30);
  });

  it('is compared by value', () => {
    expect(Money.of(685, 'USD').equals(Money.of(685, 'USD'))).toBe(true);
    expect(Money.of(685, 'USD').equals(Money.of(685, 'EUR'))).toBe(false);
  });

  it('refuses to mix currencies', () => {
    expect(() => Money.of(1, 'USD').add(Money.of(1, 'EUR'))).toThrow(DomainError);
  });

  it('refuses fractions of a cent', () => {
    expect(() => Money.of(1.5, 'USD')).toThrow(DomainError);
  });

  it('adds amounts per currency, never across currencies', () => {
    const sums = sumByCurrency([Money.of(1000, 'USD'), Money.of(500, 'EUR'), Money.of(250, 'USD')]);
    expect(sums.map((m) => [m.currency, m.cents])).toEqual([
      ['USD', 1250],
      ['EUR', 500],
    ]);
  });

  it('sums nothing to no amounts', () => {
    expect(sumByCurrency([])).toEqual([]);
  });
});
