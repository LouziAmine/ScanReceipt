import { normalizeKey } from '../shared-kernel/text';
import { type Category } from './category';
import { storeKeyOf } from './store-rule';

export type SuggestionSource = 'store-rule' | 'keywords' | 'default';

export interface CategorySuggestion {
  readonly categoryId: string;
  readonly source: SuggestionSource;
}

/** Keywords that point to a default category, checked against the store name then the OCR text. */
const KEYWORDS: readonly (readonly [categoryId: string, pattern: RegExp])[] = [
  [
    'groceries',
    /grocer|market|supermarket|food|fresh|bakery|boulangerie|epicerie|carrefour|walmart|costco|aldi|lidl|kroger|safeway/,
  ],
  [
    'dining',
    /cafe|coffee|restaurant|ristorante|pizza|burger|bistro|grill|sushi|\bbar\b|diner|starbucks|mcdonald/,
  ],
  [
    'transportation',
    /\bgas\b|fuel|petrol|shell|chevron|exxon|parking|taxi|uber|lyft|metro|transit|toll|station/,
  ],
  ['health', /pharmacy|pharmacie|drug|clinic|medical|dental|cvs|walgreens|health/],
  ['office', /office|books?|stationery|staples|print|paper/],
];

/** Domain service: picks a category for a scanned receipt. A store rule always wins. */
export function suggestCategory(
  store: string,
  ocrText: string,
  storeRules: ReadonlyMap<string, string>,
  categories: readonly Category[],
  defaultCategoryId: string,
): CategorySuggestion {
  const known = new Set(categories.map((category) => category.id));
  const ruled = storeRules.get(storeKeyOf(store));
  if (ruled !== undefined && known.has(ruled)) {
    return { categoryId: ruled, source: 'store-rule' };
  }

  for (const haystack of [normalizeKey(store), normalizeKey(ocrText)]) {
    const hit = KEYWORDS.find(([id, pattern]) => known.has(id) && pattern.test(haystack));
    if (hit) {
      return { categoryId: hit[0], source: 'keywords' };
    }
  }
  return { categoryId: defaultCategoryId, source: 'default' };
}
