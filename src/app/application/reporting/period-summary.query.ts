import { Injectable, inject } from '@angular/core';
import {
  type CategoryTotal,
  type CurrencyCode,
  type DailyTotal,
  type DateRange,
  type Receipt,
  ReceiptRepository,
  type ReceiptTotals,
} from '@domain';
import { SettingsStore } from '../settings/settings.store';

export interface PeriodSummary {
  readonly range: DateRange;
  readonly totals: ReceiptTotals;
  readonly byCategory: readonly CategoryTotal[];
  readonly byDay: readonly DailyTotal[];
  readonly receipts: readonly Receipt[];
}

/** Read model for the "Totals by day / week / month / year" screen. */
@Injectable({ providedIn: 'root' })
export class PeriodSummaryQuery {
  private readonly repository = inject(ReceiptRepository);
  private readonly settings = inject(SettingsStore);

  /** Amounts are in `currency` (the settings by default); older currencies are listed apart. */
  async summarize(
    range: DateRange,
    currency: CurrencyCode = this.settings.currency(),
  ): Promise<PeriodSummary> {
    const [totals, byCategory, byDay, receipts] = await Promise.all([
      this.repository.totals({ range }, currency),
      this.repository.categoryTotals({ range }, currency),
      this.repository.dailyTotals(range, currency),
      this.repository.search({ range, sort: 'newest', limit: 200 }),
    ]);
    return { range, totals, byCategory, byDay, receipts };
  }

  dailyTotals(range: DateRange): Promise<DailyTotal[]> {
    return this.repository.dailyTotals(range, this.settings.currency());
  }
}
