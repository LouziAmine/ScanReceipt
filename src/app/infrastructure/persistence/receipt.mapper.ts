import {
  type CurrencyCode,
  Money,
  type OriginalAmount,
  Receipt,
  type ReviewableField,
  localDayKey,
} from '@domain';

/** Persistence model of the Receipt aggregate (one row of the `receipts` table). */
export interface ReceiptRow {
  id: string;
  store: string;
  purchased_at: number;
  day: string;
  total_cents: number;
  tax_cents: number | null;
  currency: string;
  original_currency: string | null;
  original_total_cents: number | null;
  original_tax_cents: number | null;
  exchange_rate: number | null;
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
    original: originalOf(row),
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

function originalOf(row: ReceiptRow): OriginalAmount | null {
  if (
    row.original_currency === null ||
    row.original_total_cents === null ||
    row.exchange_rate === null
  ) {
    return null;
  }
  const currency = row.original_currency as CurrencyCode;
  return {
    total: Money.of(row.original_total_cents, currency),
    tax: row.original_tax_cents === null ? null : Money.of(row.original_tax_cents, currency),
    rate: row.exchange_rate,
  };
}

export function toRow(receipt: Receipt): ReceiptRow {
  const { original } = receipt;
  return {
    id: receipt.id,
    store: receipt.store,
    purchased_at: receipt.purchasedAt.getTime(),
    day: localDayKey(receipt.purchasedAt),
    total_cents: receipt.total.cents,
    tax_cents: receipt.tax?.cents ?? null,
    currency: receipt.currency,
    original_currency: original?.total.currency ?? null,
    original_total_cents: original?.total.cents ?? null,
    original_tax_cents: original?.tax?.cents ?? null,
    exchange_rate: original?.rate ?? null,
    category_id: receipt.categoryId,
    note: receipt.note,
    image_path: receipt.imagePath,
    ocr_text: receipt.ocrText,
    doubtful_fields: receipt.doubtfulFields.join(','),
    created_at: receipt.createdAt.getTime(),
    updated_at: receipt.updatedAt.getTime(),
  };
}
