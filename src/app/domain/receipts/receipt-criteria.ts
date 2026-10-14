import { type DateRange } from '../shared-kernel/date-range';
import { type CurrencyCode } from '../shared-kernel/money';

export type ReceiptSort = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'store_asc';

/** Specification of which receipts to read, in the language of the Filter screen. */
export interface ReceiptCriteria {
  readonly text?: string;
  readonly range?: DateRange;
  readonly categoryIds?: readonly string[];
  readonly minCents?: number;
  readonly maxCents?: number;
  readonly onlyNeedsReview?: boolean;
  readonly sort?: ReceiptSort;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Read models: aggregated figures, not entities. `totalCents` is in the requested currency.
 * Receipts are saved in the person's currency, converted when paid in another one; those kept
 * in an older currency (saved before the person changed it) are counted in
 * `otherCurrencyCount`, never added. They are still part of `count`.
 */
export interface AmountTotals {
  readonly count: number;
  readonly totalCents: number;
  readonly otherCurrencyCount: number;
}

/** What a currency adds up to, for receipts left out of a total. */
export interface CurrencyAmount {
  readonly currency: CurrencyCode;
  readonly cents: number;
  readonly count: number;
}

export interface ReceiptTotals extends AmountTotals {
  /** The receipts left out of `totalCents`, added per currency, most receipts first. */
  readonly others: readonly CurrencyAmount[];
}

export interface DailyTotal extends AmountTotals {
  /** Local calendar day, "YYYY-MM-DD". */
  readonly day: string;
}

export interface CategoryTotal extends AmountTotals {
  readonly categoryId: string;
}

export function isFilterActive(criteria: ReceiptCriteria): boolean {
  return (
    criteria.range !== undefined ||
    (criteria.categoryIds?.length ?? 0) > 0 ||
    criteria.minCents !== undefined ||
    criteria.maxCents !== undefined ||
    criteria.onlyNeedsReview === true ||
    (criteria.sort ?? 'newest') !== 'newest'
  );
}
