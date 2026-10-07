import { Injectable, inject } from '@angular/core';
import {
  type CategoryTotal,
  type CurrencyCode,
  type DailyTotal,
  type DateRange,
  type Receipt,
  type ReceiptCriteria,
  ReceiptRepository,
  type ReceiptSort,
  type ReceiptTotals,
  localDayKey,
  parseAmount,
} from '@domain';
import { type ReceiptRow, toDomain, toRow } from './receipt.mapper';
import { type SqlStatement, type SqlValue, SqliteDatabase } from './sqlite-database';

const ORDER_BY: Readonly<Record<ReceiptSort, string>> = {
  newest: 'purchased_at DESC, created_at DESC',
  oldest: 'purchased_at ASC, created_at ASC',
  amount_desc: 'total_cents DESC, purchased_at DESC',
  amount_asc: 'total_cents ASC, purchased_at DESC',
  store_asc: 'store COLLATE NOCASE ASC, purchased_at DESC',
};

const COLUMNS =
  'id, store, purchased_at, day, total_cents, tax_cents, currency, category_id, note, image_path, ocr_text, doubtful_fields, created_at, updated_at';

/** Adapter: the Receipt repository on SQLite. */
@Injectable()
export class SqliteReceiptRepository extends ReceiptRepository {
  private readonly db = inject(SqliteDatabase);

  async findById(id: string): Promise<Receipt | null> {
    const rows = await this.db.query<ReceiptRow>(`SELECT ${COLUMNS} FROM receipts WHERE id = ?`, [
      id,
    ]);
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Receipt[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.query<ReceiptRow>(
      `SELECT ${COLUMNS} FROM receipts WHERE id IN (${placeholders(ids.length)}) ORDER BY ${ORDER_BY.newest}`,
      ids,
    );
    return rows.map(toDomain);
  }

  async search(criteria: ReceiptCriteria): Promise<Receipt[]> {
    const { where, params } = whereClause(criteria);
    const paging: SqlValue[] = [];
    let limit = '';
    if (criteria.limit !== undefined) {
      limit = ' LIMIT ? OFFSET ?';
      paging.push(criteria.limit, criteria.offset ?? 0);
    }
    const rows = await this.db.query<ReceiptRow>(
      `SELECT ${COLUMNS} FROM receipts ${where} ORDER BY ${ORDER_BY[criteria.sort ?? 'newest']}${limit}`,
      [...params, ...paging],
    );
    return rows.map(toDomain);
  }

  async totals(criteria: ReceiptCriteria, currency: CurrencyCode): Promise<ReceiptTotals> {
    const { where, params } = whereClause(criteria);
    const rows = await this.db.query<TotalsRow>(`SELECT ${TOTALS} FROM receipts ${where}`, [
      currency,
      currency,
      ...params,
    ]);
    return toTotals(rows[0]);
  }

  async dailyTotals(range: DateRange, currency: CurrencyCode): Promise<DailyTotal[]> {
    const rows = await this.db.query<TotalsRow & { day: string }>(
      `SELECT day, ${TOTALS} FROM receipts
       WHERE day >= ? AND day < ? GROUP BY day ORDER BY day`,
      [currency, currency, localDayKey(range.from), localDayKey(range.to)],
    );
    return rows.map((r) => ({ day: r.day, ...toTotals(r) }));
  }

  async categoryTotals(
    criteria: ReceiptCriteria,
    currency: CurrencyCode,
  ): Promise<CategoryTotal[]> {
    const { where, params } = whereClause(criteria);
    const rows = await this.db.query<TotalsRow & { category_id: string }>(
      `SELECT category_id, ${TOTALS} FROM receipts ${where}
       GROUP BY category_id ORDER BY total DESC`,
      [currency, currency, ...params],
    );
    return rows.map((r) => ({ categoryId: r.category_id, ...toTotals(r) }));
  }

  async save(receipt: Receipt): Promise<void> {
    await this.db.transaction([upsert(receipt)]);
  }

  async delete(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.run(`DELETE FROM receipts WHERE id IN (${placeholders(ids.length)})`, ids);
  }

  async all(): Promise<Receipt[]> {
    return this.search({ sort: 'oldest' });
  }
}

/** Sums only one currency: dollars and euros are never added together. Takes the currency twice. */
const TOTALS = `COUNT(*) AS count,
  COALESCE(SUM(CASE WHEN currency = ? THEN total_cents END), 0) AS total,
  COALESCE(SUM(CASE WHEN currency <> ? THEN 1 END), 0) AS other`;

interface TotalsRow {
  readonly count: number;
  readonly total: number;
  readonly other: number;
}

function toTotals(row: TotalsRow | undefined): ReceiptTotals {
  return {
    count: row?.count ?? 0,
    totalCents: row?.total ?? 0,
    otherCurrencyCount: row?.other ?? 0,
  };
}

/** Statements replacing every receipt (used by the restore unit of work). */
export function replaceReceiptsStatements(receipts: readonly Receipt[]): SqlStatement[] {
  return [{ sql: 'DELETE FROM receipts' }, ...receipts.map(upsert)];
}

function upsert(receipt: Receipt): SqlStatement {
  const row = toRow(receipt);
  const values = Object.values(row) as SqlValue[];
  return {
    sql: `INSERT OR REPLACE INTO receipts (${Object.keys(row).join(', ')}) VALUES (${placeholders(values.length)})`,
    params: values,
  };
}

function whereClause(criteria: ReceiptCriteria): { where: string; params: SqlValue[] } {
  const conditions: string[] = [];
  const params: SqlValue[] = [];

  const text = criteria.text?.trim();
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const textMatch = [
      "store LIKE ? ESCAPE '\\'",
      "ocr_text LIKE ? ESCAPE '\\'",
      "note LIKE ? ESCAPE '\\'",
    ];
    params.push(like, like, like);
    const amount = /^[$€£]?\s*\d+([.,]\d{1,2})?$/.test(text) ? parseAmount(text) : null;
    if (amount !== null) {
      textMatch.push('total_cents = ?');
      params.push(amount);
    }
    conditions.push(`(${textMatch.join(' OR ')})`);
  }
  if (criteria.range) {
    conditions.push('purchased_at >= ? AND purchased_at < ?');
    params.push(criteria.range.from.getTime(), criteria.range.to.getTime());
  }
  if (criteria.categoryIds && criteria.categoryIds.length > 0) {
    conditions.push(`category_id IN (${placeholders(criteria.categoryIds.length)})`);
    params.push(...criteria.categoryIds);
  }
  if (criteria.minCents !== undefined) {
    conditions.push('total_cents >= ?');
    params.push(criteria.minCents);
  }
  if (criteria.maxCents !== undefined) {
    conditions.push('total_cents <= ?');
    params.push(criteria.maxCents);
  }
  if (criteria.onlyNeedsReview) {
    conditions.push("doubtful_fields <> ''");
  }
  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}
