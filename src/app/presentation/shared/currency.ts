import { isolateLatin, locale } from '../i18n/i18n';

/** "$" for USD, "€" for EUR… in the language of the screens. */
export function currencySymbol(currency: string): string {
  const part = new Intl.NumberFormat(locale(), { style: 'currency', currency })
    .formatToParts(0)
    .find((p) => p.type === 'currency');
  return isolateLatin(part?.value ?? currency);
}

const names = new Map<string, Intl.DisplayNames>();

/** "Moroccan Dirham" for MAD… in the language of the screens; the code itself when unknown. */
export function currencyName(currency: string): string {
  let display = names.get(locale());
  if (!display) {
    display = new Intl.DisplayNames(locale(), { type: 'currency', fallback: 'code' });
    names.set(locale(), display);
  }
  return display.of(currency) ?? currency;
}
