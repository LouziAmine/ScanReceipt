import { Pipe, type PipeTransform } from '@angular/core';
import { type ReceiptTotals } from '@domain';
import { isolateLatin, locale } from '../i18n/i18n';

const formatters = new Map<string, Intl.NumberFormat>();

/** "$14.75" for 1475 USD, in the language of the screens. */
export function formatMoney(cents: number, currency: string): string {
  const key = `${locale()}|${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale(), { style: 'currency', currency });
    formatters.set(key, formatter);
  }
  return isolateLatin(formatter.format(cents / 100));
}

/** An exchange rate with the digits that matter: "0.1381", "10.84", "1,573.2". */
export function formatRate(rate: number): string {
  return isolateLatin(
    new Intl.NumberFormat(locale(), { maximumSignificantDigits: 4 }).format(rate),
  );
}

/**
 * A total with the amounts it could not include, never added to it:
 * "1,450.00 MAD + $120.00". The view's currency comes first, even at zero when alone.
 */
export function formatTotals(
  totals: ReceiptTotals,
  currency: string,
  format: (cents: number, currency: string) => string = formatMoney,
): string {
  const counted = totals.count - totals.otherCurrencyCount > 0;
  const parts = [
    ...(counted || totals.others.length === 0 ? [format(totals.totalCents, currency)] : []),
    ...totals.others.map((other) => format(other.cents, other.currency)),
  ];
  return parts.join(' + ');
}

/** `{{ totals | amounts: 'USD' }}` -> "$120.00 + 1,450.00 MAD". Not pure: follows the language. */
@Pipe({ name: 'amounts', pure: false })
export class AmountsPipe implements PipeTransform {
  transform(totals: ReceiptTotals | null | undefined, currency: string): string {
    return totals ? formatTotals(totals, currency) : '';
  }
}
