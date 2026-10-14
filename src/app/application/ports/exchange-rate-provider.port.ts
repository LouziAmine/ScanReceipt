import { type CurrencyCode } from '@domain';

/** Daily exchange rates from the internet. Only a date is sent, never receipt data. */
export abstract class ExchangeRateProvider {
  /** Units of each currency for one euro on `day` ("YYYY-MM-DD"). Rejects when offline. */
  abstract ratesOn(day: string): Promise<ReadonlyMap<CurrencyCode, number>>;
}
