import { Injectable } from '@angular/core';
import { AppError, ExchangeRateProvider } from '@application';
import { type CurrencyCode } from '@domain';
import { parseRates, ratesUrls, releaseFor } from './currency-api';

const TIMEOUT_MS = 10_000;
/** Below this, the answer is not a real rates table. */
const MIN_RATES = 100;

/** Adapter: daily rates from a free, keyless API on public CDNs. Only the date is sent. */
@Injectable()
export class HttpExchangeRateProvider extends ExchangeRateProvider {
  async ratesOn(day: string): Promise<ReadonlyMap<CurrencyCode, number>> {
    // Today's rates are published during the day: until then, the latest ones are used.
    return (
      (await this.fetchRelease(releaseFor(day))) ?? (await this.fetchRelease('latest')) ?? fail()
    );
  }

  /** The rates of a release, or null when it does not exist (yet). Throws when offline. */
  private async fetchRelease(release: string): Promise<ReadonlyMap<CurrencyCode, number> | null> {
    let lastError: Error | null = null;
    for (const url of ratesUrls(release)) {
      try {
        const response = await fetchWithTimeout(url);
        if (response.status === 404) return null;
        if (!response.ok) continue;
        const rates = parseRates(await response.json());
        if (rates.size >= MIN_RATES) return rates;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError ?? new AppError('Exchange rates are not available right now.');
  }
}

function fail(): never {
  throw new AppError('Exchange rates are not available right now.');
}

/** `AbortSignal.timeout` needs iOS 16: a timer works on every supported WebView. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
