import { type DateRange } from '../shared-kernel/date-range';

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
 * Read models: aggregated figures, not entities. Amounts in different currencies are never
 * added up: `totalCents` covers only the receipts in the requested currency, and the others
 * are counted in `otherCurrencyCount` (they are still part of `count`).
 */
export interface ReceiptTotals {
  readonly count: number;
  readonly totalCents: number;
  readonly otherCurrencyCount: number;
}

export interface DailyTotal extends ReceiptTotals {
  /** Local calendar day, "YYYY-MM-DD". */
  readonly day: string;
}

export interface CategoryTotal extends ReceiptTotals {
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
