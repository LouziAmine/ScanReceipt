import { describe, expect, it } from 'vitest';
import { DomainError } from '../shared-kernel/domain-error';
import { Category, DEFAULT_CATEGORIES, OTHER_CATEGORY_ID } from './category';
import { assertUniqueCategoryName } from './category-naming';
import { suggestCategory } from './category-suggester';

const create = (name: string): Category =>
  Category.create({ id: 'c1', name, color: 'teal', icon: 'cafe', sortOrder: 5 });

describe('Category aggregate', () => {
  it('creates custom categories with a trimmed name', () => {
    const category = create('  Coffee   runs ');
    expect(category.name).toBe('Coffee runs');
    expect(category.isCustom).toBe(true);
  });

  it('rejects empty and over-long names', () => {
    expect(() => create('  ')).toThrow(DomainError);
    expect(() => create('x'.repeat(31))).toThrow(DomainError);
  });

  it('protects the fallback category', () => {
    const other = DEFAULT_CATEGORIES.find((c) => c.id === OTHER_CATEGORY_ID);
    expect(() => other?.assertDeletable()).toThrow(DomainError);
    expect(() => {
      create('Coffee').assertDeletable();
    }).not.toThrow();
  });

  it('keeps names unique, ignoring case and accents', () => {
    expect(() => {
      assertUniqueCategoryName('groceries', DEFAULT_CATEGORIES);
    }).toThrow(DomainError);
    expect(() => {
      assertUniqueCategoryName('Groceries', DEFAULT_CATEGORIES, 'groceries');
    }).not.toThrow();
  });
});

describe('suggestCategory', () => {
  const noRules = new Map<string, string>();

  it('applies a store rule first', () => {
    const rules = new Map([['sunrise bakery', 'dining']]);
    expect(suggestCategory('SUNRISE BAKERY!', '', rules, DEFAULT_CATEGORIES, 'other')).toEqual({
      categoryId: 'dining',
      source: 'store-rule',
    });
  });

  it('matches keywords in the store name, then in the OCR text', () => {
    expect(
      suggestCategory('Elm Street Pharmacy', '', noRules, DEFAULT_CATEGORIES, 'other').categoryId,
    ).toBe('health');
    expect(
      suggestCategory('Shop 21', 'UNLEADED FUEL', noRules, DEFAULT_CATEGORIES, 'other').categoryId,
    ).toBe('transportation');
  });

  it('uses the default category when nothing matches or a rule points to a deleted category', () => {
    expect(suggestCategory('Acme', 'item 1.00', noRules, DEFAULT_CATEGORIES, 'other').source).toBe(
      'default',
    );
    expect(
      suggestCategory('Acme', '', new Map([['acme', 'gone']]), DEFAULT_CATEGORIES, 'other').source,
    ).toBe('default');
  });
});
