import { type Category, type Receipt, type StoreRule } from '@domain';

export interface ReplacementData {
  readonly categories: readonly Category[];
  readonly storeRules: readonly StoreRule[];
  readonly receipts: readonly Receipt[];
}

/**
 * Unit of work for restoring a backup: swaps every category, store rule and receipt
 * in one transaction, so an interrupted restore never leaves half of the data replaced.
 */
export abstract class DataReplacer {
  abstract replaceAll(data: ReplacementData): Promise<void>;
}
