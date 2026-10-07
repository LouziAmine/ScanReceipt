import { normalizeKey } from '../shared-kernel/text';

/** Value object: "always file receipts from this store under this category". */
export interface StoreRule {
  readonly storeKey: string;
  readonly categoryId: string;
}

/** The same store read as "SUNRISE BAKERY" or "Sunrise Bakery!" maps to one key. */
export function storeKeyOf(store: string): string {
  return normalizeKey(store);
}
