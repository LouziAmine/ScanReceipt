import { describe, expect, it } from 'vitest';
import { parseRates, ratesUrls, releaseFor } from './currency-api';

describe('currency API', () => {
  it('asks for the purchase day, or the first kept day for older receipts', () => {
    expect(releaseFor('2026-10-14')).toBe('2026-10-14');
    expect(releaseFor('2023-05-01')).toBe('2024-03-02');
  });

  it('has a fallback URL on a second CDN', () => {
    expect(ratesUrls('2026-10-14')).toEqual([
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2026-10-14/v1/currencies/eur.min.json',
      'https://2026-10-14.currency-api.pages.dev/v1/currencies/eur.min.json',
    ]);
  });

  it('keeps the rates of supported currencies only', () => {
    const rates = parseRates({
      date: '2026-10-14',
      eur: { eur: 1, mad: 10.8, usd: 1.16, btc: 0.00001, xyz: 3, jpy: 'bad', aed: -1 },
    });
    expect(rates).toEqual(
      new Map([
        ['EUR', 1],
        ['MAD', 10.8],
        ['USD', 1.16],
      ]),
    );
  });

  it('reads nothing from an unexpected answer', () => {
    expect(parseRates(null).size).toBe(0);
    expect(parseRates({ date: '2026-10-14' }).size).toBe(0);
  });
});
