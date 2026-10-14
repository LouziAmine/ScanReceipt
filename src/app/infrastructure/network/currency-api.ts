import { type CurrencyCode, SUPPORTED_CURRENCIES } from '@domain';

/** The free currency API (github.com/fawazahmed0/exchange-api) keeps daily rates from this day. */
export const FIRST_RATES_DAY = '2024-03-02';

/** The release to ask for: the purchase day, or the first one kept for older receipts. */
export function releaseFor(day: string): string {
  return day < FIRST_RATES_DAY ? FIRST_RATES_DAY : day;
}

/** Same data on two CDNs: the second answers when the first is down. */
export function ratesUrls(release: string): string[] {
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${release}/v1/currencies/eur.min.json`,
    `https://${release}.currency-api.pages.dev/v1/currencies/eur.min.json`,
  ];
}

/** Reads `{"date": "...", "eur": {"mad": 10.8, ...}}` into units per euro of our currencies. */
export function parseRates(json: unknown): Map<CurrencyCode, number> {
  const rates = new Map<CurrencyCode, number>();
  if (typeof json !== 'object' || json === null) return rates;
  const eur = (json as Record<string, unknown>)['eur'];
  if (typeof eur !== 'object' || eur === null) return rates;
  const values = eur as Record<string, unknown>;
  for (const code of SUPPORTED_CURRENCIES) {
    const rate = values[code.toLowerCase()];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) rates.set(code, rate);
  }
  return rates;
}
