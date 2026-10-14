import { DomainError } from './domain-error';

/** ISO 4217 currencies in use (plus ANG and BGN, still on older receipts). */
// prettier-ignore
export const SUPPORTED_CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT',
  'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD',
  'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ',
  'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD',
  'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
  'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR',
  'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN',
  'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR',
  'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB',
  'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS',
  'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG',
] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

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

  /** This amount in `currency`, at `rate` units of `currency` for one unit of this one. */
  convert(rate: number, currency: CurrencyCode): Money {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new DomainError('The exchange rate must be more than zero.');
    }
    return new Money(Math.round(this.cents * rate), currency);
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
      throw new DomainError('Cannot combine {a} and {b} amounts.', undefined, {
        a: this.currency,
        b: other.currency,
      });
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
