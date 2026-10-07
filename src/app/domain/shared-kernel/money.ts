import { DomainError } from './domain-error';

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'MAD'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Value object: an amount in integer minor units (cents) plus its currency.
 * Integer cents mean totals never drift because of floating-point arithmetic.
 */
export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: CurrencyCode,
  ) {}

  static of(cents: number, currency: CurrencyCode): Money {
    if (!Number.isSafeInteger(cents)) {
      throw new DomainError('An amount must be a whole number of cents.');
    }
    return new Money(cents, currency);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(0, currency);
  }

  /** Reads an amount typed by a person ("1,234.56", "12,50", "$ 6.85"). */
  static parse(raw: string, currency: CurrencyCode): Money | null {
    const cents = parseAmount(raw);
    return cents === null ? null : new Money(cents, currency);
  }

  get major(): number {
    return this.cents / 100;
  }

  get isNegative(): boolean {
    return this.cents < 0;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents > other.cents;
  }

  equals(other: Money | null | undefined): boolean {
    return other?.cents === this.cents && other.currency === this.currency;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new DomainError(`Cannot combine ${this.currency} and ${other.currency} amounts.`);
    }
  }
}

/**
 * Adds amounts per currency: dollars and euros are never mixed. One Money per currency,
 * in the order each currency first appears.
 */
export function sumByCurrency(amounts: readonly Money[]): Money[] {
  const sums = new Map<CurrencyCode, Money>();
  for (const amount of amounts) {
    sums.set(amount.currency, sums.get(amount.currency)?.add(amount) ?? amount);
  }
  return [...sums.values()];
}

/**
 * Parses an amount written with either decimal separator. Returns cents, or null when
 * the text holds no usable amount.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(cleaned)) {
    return null;
  }
  const negative = cleaned.startsWith('-');
  const digits = cleaned.replace(/-/g, '');
  const decimalIndex = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
  const decimalsLength = decimalIndex === -1 ? 0 : digits.length - decimalIndex - 1;

  const normalized =
    decimalIndex !== -1 && decimalsLength > 0 && decimalsLength <= 2
      ? `${digits.slice(0, decimalIndex).replace(/[.,]/g, '')}.${digits.slice(decimalIndex + 1)}`
      : digits.replace(/[.,]/g, '');

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round((negative ? -value : value) * 100);
}
