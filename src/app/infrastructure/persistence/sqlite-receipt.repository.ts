import { Injectable, inject } from '@angular/core';
import {
  type AmountTotals,
  type CategoryTotal,
  type CurrencyAmount,
  type CurrencyCode,
  type DailyTotal,
  type DateRange,
  type Receipt,
  type ReceiptCriteria,
  ReceiptRepository,
  type ReceiptSort,
  type ReceiptTotals,
  isCurrencyCode,
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

/** Amount sorts in a currency: amounts in it first, then the others grouped by currency. */
const ORDER_BY_AMOUNT_IN_CURRENCY: Partial<Readonly<Record<ReceiptSort, string>>> = {
  amount_desc: 'amount IS NULL, amount DESC, currency, total_cents DESC, purchased_at DESC',
  amount_asc: 'amount IS NULL, amount ASC, currency, total_cents ASC, purchased_at DESC',
};

const COLUMNS =
  'id, store, purchased_at, day, total_cents, tax_cents, currency, original_currency, original_total_cents, original_tax_cents, exchange_rate, category_id, note, image_path, ocr_text, doubtful_fields, created_at, updated_at';

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

  async search(criteria: ReceiptCriteria, currency?: CurrencyCode): Promise<Receipt[]> {
    const source = currency ? amountSource(currency) : { sql: 'receipts', params: [] };
    const { where, params } = whereClause(criteria, currency !== undefined);
    const paging: SqlValue[] = [];
    let limit = '';
    if (criteria.limit !== undefined) {
      limit = ' LIMIT ? OFFSET ?';
      paging.push(criteria.limit, criteria.offset ?? 0);
    }
    const sort = criteria.sort ?? 'newest';
    const order = (currency && ORDER_BY_AMOUNT_IN_CURRENCY[sort]) ?? ORDER_BY[sort];
    const rows = await this.db.query<ReceiptRow>(
      `SELECT ${COLUMNS} FROM ${source.sql} ${where} ORDER BY ${order}${limit}`,
      [...source.params, ...params, ...paging],
    );
    return rows.map(toDomain);
  }

  async totals(criteria: ReceiptCriteria, currency: CurrencyCode): Promise<ReceiptTotals> {
    const source = amountSource(currency);
    const { where, params } = whereClause(criteria, true);
    const othersWhere = where ? `${where} AND amount IS NULL` : 'WHERE amount IS NULL';
    const [totals, others] = await Promise.all([
      this.db.query<TotalsRow>(`SELECT ${TOTALS} FROM ${source.sql} ${where}`, [
        ...source.params,
        ...params,
      ]),
      this.db.query<{ currency: string; cents: number; count: number }>(
        `SELECT currency, SUM(total_cents) AS cents, COUNT(*) AS count FROM ${source.sql}
         ${othersWhere} GROUP BY currency ORDER BY count DESC, currency`,
        [...source.params, ...params],
      ),
    ]);
    return {
      ...toTotals(totals[0]),
      others: others.flatMap((r): CurrencyAmount[] =>
        isCurrencyCode(r.currency)
          ? [{ currency: r.currency, cents: r.cents, count: r.count }]
          : [],
      ),
    };
  }

  async dailyTotals(range: DateRange, currency: CurrencyCode): Promise<DailyTotal[]> {
    const source = amountSource(currency);
    const rows = await this.db.query<TotalsRow & { day: string }>(
      `SELECT day, ${TOTALS} FROM ${source.sql}
       WHERE day >= ? AND day < ? GROUP BY day ORDER BY day`,
      [...source.params, localDayKey(range.from), localDayKey(range.to)],
    );
    return rows.map((r) => ({ day: r.day, ...toTotals(r) }));
  }

  async categoryTotals(
    criteria: ReceiptCriteria,
    currency: CurrencyCode,
  ): Promise<CategoryTotal[]> {
    const source = amountSource(currency);
    const { where, params } = whereClause(criteria, true);
    const rows = await this.db.query<TotalsRow & { category_id: string }>(
      `SELECT category_id, ${TOTALS} FROM ${source.sql} ${where}
       GROUP BY category_id ORDER BY total DESC`,
      [...source.params, ...params],
    );
    return rows.map((r) => ({ categoryId: r.category_id, ...toTotals(r) }));
  }

  async usedCurrencies(): Promise<CurrencyCode[]> {
    const rows = await this.db.query<{ currency: string }>(
      'SELECT currency FROM receipts GROUP BY currency ORDER BY COUNT(*) DESC',
    );
    return rows.map((r) => r.currency).filter(isCurrencyCode);
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

/**
 * The receipts with an `amount` column: the total in `currency`, or NULL for a receipt kept in
 * another one (saved before the person changed currency), which is never added.
 */
function amountSource(currency: CurrencyCode): { sql: string; params: SqlValue[] } {
  return {
    sql: '(SELECT *, CASE WHEN currency = ? THEN total_cents END AS amount FROM receipts) AS receipts',
    params: [currency],
  };
}

const TOTALS = `COUNT(*) AS count,
  COALESCE(SUM(amount), 0) AS total,
  COUNT(*) - COUNT(amount) AS other`;

interface TotalsRow {
  readonly count: number;
  readonly total: number;
  readonly other: number;
}

function toTotals(row: TotalsRow | undefined): AmountTotals {
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

/** `inCurrency`: the receipts come from `amountSource`, so amount bounds apply to `amount`. */
function whereClause(
  criteria: ReceiptCriteria,
  inCurrency: boolean,
): { where: string; params: SqlValue[] } {
  const amount = inCurrency ? 'amount' : 'total_cents';
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
    conditions.push(`${amount} >= ?`);
    params.push(criteria.minCents);
  }
  if (criteria.maxCents !== undefined) {
    conditions.push(`${amount} <= ?`);
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
