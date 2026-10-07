import { type CurrencyCode, Money, Receipt, type ReviewableField, localDayKey } from '@domain';

/** Persistence model of the Receipt aggregate (one row of the `receipts` table). */
export interface ReceiptRow {
  id: string;
  store: string;
  purchased_at: number;
  day: string;
  total_cents: number;
  tax_cents: number | null;
  currency: string;
  category_id: string;
  note: string;
  image_path: string;
  ocr_text: string;
  doubtful_fields: string;
  created_at: number;
  updated_at: number;
}

export function toDomain(row: ReceiptRow): Receipt {
  const currency = row.currency as CurrencyCode;
  return Receipt.rehydrate({
    id: row.id,
    store: row.store,
    purchasedAt: new Date(row.purchased_at),
    total: Money.of(row.total_cents, currency),
    tax: row.tax_cents === null ? null : Money.of(row.tax_cents, currency),
    categoryId: row.category_id,
    note: row.note,
    imagePath: row.image_path,
    ocrText: row.ocr_text,
    doubtfulFields:
      row.doubtful_fields === '' ? [] : (row.doubtful_fields.split(',') as ReviewableField[]),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

export function toRow(receipt: Receipt): ReceiptRow {
  return {
    id: receipt.id,
    store: receipt.store,
    purchased_at: receipt.purchasedAt.getTime(),
    day: localDayKey(receipt.purchasedAt),
    total_cents: receipt.total.cents,
    tax_cents: receipt.tax?.cents ?? null,
    currency: receipt.currency,
    category_id: receipt.categoryId,
    note: receipt.note,
    image_path: receipt.imagePath,
    ocr_text: receipt.ocrText,
    doubtful_fields: receipt.doubtfulFields.join(','),
    created_at: receipt.createdAt.getTime(),
    updated_at: receipt.updatedAt.getTime(),
  };
}
