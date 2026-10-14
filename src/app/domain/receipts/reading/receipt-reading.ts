import { type CurrencyCode } from '../../shared-kernel/money';
import { type ReviewableField } from '../receipt';

export type FieldConfidence = 'high' | 'low' | 'missing';

export interface ReadField<T> {
  readonly value: T | null;
  readonly confidence: FieldConfidence;
  /** Why the reader is unsure, shown to the person next to the field. */
  readonly hint?: string;
  /** Values for the `{name}` placeholders of `hint`. */
  readonly hintParams?: Readonly<Record<string, string>>;
}

/** Value object: what the OCR text says about a receipt, with a confidence per field. */
export interface ReceiptReading {
  readonly store: ReadField<string>;
  readonly purchasedAt: ReadField<Date>;
  readonly totalCents: ReadField<number>;
  readonly taxCents: ReadField<number>;
  /** Read from signs and codes ("€", "DH", "CHF"…); missing when the receipt names none. */
  readonly currency: ReadField<CurrencyCode>;
}

/** Fields a person must check before the receipt counts as verified. */
export function doubtfulFieldsOf(reading: ReceiptReading): ReviewableField[] {
  const fields: ReviewableField[] = [];
  if (reading.store.confidence !== 'high') fields.push('store');
  if (reading.purchasedAt.confidence !== 'high') fields.push('date');
  if (reading.totalCents.confidence !== 'high') fields.push('total');
  // Tax is optional on many receipts: only a value we are unsure of needs a look.
  if (reading.taxCents.confidence === 'low') fields.push('tax');
  return fields;
}
