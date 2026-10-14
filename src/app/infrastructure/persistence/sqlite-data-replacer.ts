import { Injectable, inject } from '@angular/core';
import { DataReplacer, type ReplacementData } from '@application';
import { replaceCategoriesStatements } from './sqlite-category.repository';
import { replaceReceiptsStatements } from './sqlite-receipt.repository';
import { SqliteDatabase } from './sqlite-database';

/** Adapter: categories, store rules and receipts are replaced in a single SQLite transaction. */
@Injectable()
export class SqliteDataReplacer extends DataReplacer {
  private readonly db = inject(SqliteDatabase);

  async replaceAll(data: ReplacementData): Promise<void> {
    await this.db.transaction([
      ...replaceCategoriesStatements(data.categories, data.storeRules),
      ...replaceReceiptsStatements(data.receipts),
    ]);
  }
}
