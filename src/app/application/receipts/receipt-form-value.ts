import { type CurrencyCode, Money, type ReceiptDetails, type ReviewableField } from '@domain';

/** What the review and edit forms hand to the use cases (plain values, no domain types). */
export interface ReceiptFormValue {
  readonly store: string;
  readonly purchasedAt: Date;
  readonly totalCents: number;
  readonly taxCents: number | null;
  readonly categoryId: string;
  readonly note: string;
  /** Fields the person has not confirmed yet. */
  readonly doubtfulFields: readonly ReviewableField[];
}

export function toReceiptDetails(value: ReceiptFormValue, currency: CurrencyCode): ReceiptDetails {
  return {
    store: value.store,
    purchasedAt: value.purchasedAt,
    total: Money.of(value.totalCents, currency),
    tax: value.taxCents === null ? null : Money.of(value.taxCents, currency),
    categoryId: value.categoryId,
    note: value.note,
  };
}
