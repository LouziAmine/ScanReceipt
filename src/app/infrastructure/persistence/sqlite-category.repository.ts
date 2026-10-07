import { Injectable, inject } from '@angular/core';
import {
  Category,
  type CategoryColor,
  type CategoryIcon,
  CategoryRepository,
  DEFAULT_CATEGORIES,
  OTHER_CATEGORY_ID,
  type StoreRule,
} from '@domain';
import { type SqlStatement, SqliteDatabase } from './sqlite-database';

/** Persistence model of the Category aggregate. */
interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_custom: number;
  sort_order: number;
}

/** Adapter: the Category repository on SQLite. */
@Injectable()
export class SqliteCategoryRepository extends CategoryRepository {
  private readonly db = inject(SqliteDatabase);

  async list(): Promise<Category[]> {
    let rows = await this.selectAll();
    if (rows.length === 0) {
      // First launch: seed the default categories.
      await this.db.transaction(DEFAULT_CATEGORIES.map(upsert));
      rows = await this.selectAll();
    }
    return rows.map((row) =>
      Category.rehydrate({
        id: row.id,
        name: row.name,
        color: row.color as CategoryColor,
        icon: row.icon as CategoryIcon,
        isCustom: row.is_custom === 1,
        sortOrder: row.sort_order,
      }),
    );
  }

  async save(category: Category): Promise<void> {
    await this.db.transaction([upsert(category)]);
  }

  async delete(id: string): Promise<void> {
    if (id === OTHER_CATEGORY_ID) return;
    await this.db.transaction([
      {
        sql: 'UPDATE receipts SET category_id = ? WHERE category_id = ?',
        params: [OTHER_CATEGORY_ID, id],
      },
      { sql: 'DELETE FROM store_rules WHERE category_id = ?', params: [id] },
      { sql: 'DELETE FROM categories WHERE id = ?', params: [id] },
    ]);
  }

  async saveOrder(categories: readonly Category[]): Promise<void> {
    await this.db.transaction(
      categories.map((c) => ({
        sql: 'UPDATE categories SET sort_order = ? WHERE id = ?',
        params: [c.sortOrder, c.id],
      })),
    );
  }

  async receiptCounts(): Promise<ReadonlyMap<string, number>> {
    const rows = await this.db.query<{ category_id: string; count: number }>(
      'SELECT category_id, COUNT(*) AS count FROM receipts GROUP BY category_id',
    );
    return new Map(rows.map((r) => [r.category_id, r.count]));
  }

  async storeRules(): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db.query<{ store_key: string; category_id: string }>(
      'SELECT store_key, category_id FROM store_rules',
    );
    return new Map(rows.map((r) => [r.store_key, r.category_id]));
  }

  async saveStoreRule(rule: StoreRule): Promise<void> {
    await this.db.run('INSERT OR REPLACE INTO store_rules (store_key, category_id) VALUES (?, ?)', [
      rule.storeKey,
      rule.categoryId,
    ]);
  }

  private selectAll(): Promise<CategoryRow[]> {
    return this.db.query<CategoryRow>(
      'SELECT id, name, color, icon, is_custom, sort_order FROM categories ORDER BY sort_order',
    );
  }
}

/** Statements replacing every category and store rule; "Other" is always kept. */
export function replaceCategoriesStatements(
  categories: readonly Category[],
  rules: readonly StoreRule[],
): SqlStatement[] {
  const withFallback = categories.some((c) => c.isFallback)
    ? categories
    : [...categories, ...DEFAULT_CATEGORIES.filter((c) => c.isFallback)];
  return [
    { sql: 'DELETE FROM store_rules' },
    { sql: 'DELETE FROM categories' },
    ...withFallback.map(upsert),
    ...rules.map((rule) => ({
      sql: 'INSERT INTO store_rules (store_key, category_id) VALUES (?, ?)',
      params: [rule.storeKey, rule.categoryId],
    })),
  ];
}

function upsert(category: Category): SqlStatement {
  return {
    sql: 'INSERT OR REPLACE INTO categories (id, name, color, icon, is_custom, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    params: [
      category.id,
      category.name,
      category.color,
      category.icon,
      category.isCustom ? 1 : 0,
      category.sortOrder,
    ],
  };
}
