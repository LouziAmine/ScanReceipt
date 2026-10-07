import { type DateRange } from '../shared-kernel/date-range';
import { type CurrencyCode } from '../shared-kernel/money';
import { type Receipt } from './receipt';
import {
  type CategoryTotal,
  type DailyTotal,
  type ReceiptCriteria,
  type ReceiptTotals,
} from './receipt-criteria';

/** Repository of the Receipt aggregate. Implemented by an adapter (SQLite on the device). */
export abstract class ReceiptRepository {
  abstract findById(id: string): Promise<Receipt | null>;
  abstract findByIds(ids: readonly string[]): Promise<Receipt[]>;
  abstract search(criteria: ReceiptCriteria): Promise<Receipt[]>;
  /** Totals in `currency`; receipts in another currency are counted, never added. */
  abstract totals(criteria: ReceiptCriteria, currency: CurrencyCode): Promise<ReceiptTotals>;
  abstract dailyTotals(range: DateRange, currency: CurrencyCode): Promise<DailyTotal[]>;
  abstract categoryTotals(
    criteria: ReceiptCriteria,
    currency: CurrencyCode,
  ): Promise<CategoryTotal[]>;
  abstract save(receipt: Receipt): Promise<void>;
  abstract delete(ids: readonly string[]): Promise<void>;
  abstract all(): Promise<Receipt[]>;
}
