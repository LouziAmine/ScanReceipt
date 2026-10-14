import { Injectable, inject } from '@angular/core';
import { type CurrencyCode, localDayKey } from '@domain';
import { ExchangeRateProvider } from '../ports/exchange-rate-provider.port';

/**
 * The rate to convert a receipt paid in another currency into the person's one, at its
 * purchase day. Only the date is sent, never receipt data.
 */
@Injectable({ providedIn: 'root' })
export class ExchangeRateQuery {
  private readonly provider = inject(ExchangeRateProvider);

  /** Units of `to` for one unit of `from` on the day of `purchasedAt`; null when offline. */
  async rate(from: CurrencyCode, to: CurrencyCode, purchasedAt: Date): Promise<number | null> {
    if (from === to) return 1;
    try {
      const perEuro = await this.provider.ratesOn(localDayKey(purchasedAt));
      const source = perEuro.get(from);
      const target = perEuro.get(to);
      return source !== undefined && target !== undefined ? target / source : null;
    } catch {
      return null;
    }
  }
}
