import { type Category } from './category';
import { type StoreRule } from './store-rule';

/** Repository of the Category aggregate and its store rules. */
export abstract class CategoryRepository {
  abstract list(): Promise<Category[]>;
  abstract save(category: Category): Promise<void>;
  /** Removes the category and moves its receipts to "Other", atomically. */
  abstract delete(id: string): Promise<void>;
  abstract saveOrder(categories: readonly Category[]): Promise<void>;
  abstract receiptCounts(): Promise<ReadonlyMap<string, number>>;
  abstract storeRules(): Promise<ReadonlyMap<string, string>>;
  abstract saveStoreRule(rule: StoreRule): Promise<void>;
}
