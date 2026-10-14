import { type Category, type Receipt, localDayKey } from '@domain';
import { localTime } from './receipt-csv';

/**
 * Plain-text summary for "Copy text": the fields typed or checked by the person, then the
 * raw OCR text when there is one (manual entries and the browser demo have none).
 */
export function receiptToText(receipt: Receipt, categories: readonly Category[]): string {
  const category = categories.find((c) => c.id === receipt.categoryId)?.name;
  const lines = [
    receipt.store,
    `Date: ${localDayKey(receipt.purchasedAt)} ${localTime(receipt.purchasedAt)}`,
    `Total: ${receipt.total.major.toFixed(2)} ${receipt.currency}`,
  ];
  if (receipt.tax !== null) {
    lines.push(`Sales tax: ${receipt.tax.major.toFixed(2)} ${receipt.currency}`);
  }
  const { original } = receipt;
  if (original !== null) {
    lines.push(
      `Paid: ${original.total.major.toFixed(2)} ${original.total.currency} (rate ${original.rate})`,
    );
  }
  if (category) lines.push(`Category: ${category}`);
  if (receipt.note) lines.push(`Note: ${receipt.note}`);
  const ocrText = receipt.ocrText.trim();
  if (ocrText) lines.push('', ocrText);
  return lines.join('\n');
}
