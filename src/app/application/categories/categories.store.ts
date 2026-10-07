import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Category,
  type CategoryColor,
  type CategoryIcon,
  CategoryRepository,
  OTHER_CATEGORY_ID,
  assertUniqueCategoryName,
  storeKeyOf,
} from '@domain';
import { ID_GENERATOR } from '../shared/clock';

export interface CategoryInput {
  readonly name: string;
  readonly color: CategoryColor;
  readonly icon: CategoryIcon;
}

/** Application service + state for the Categories context. */
@Injectable({ providedIn: 'root' })
export class CategoriesStore {
  private readonly repository = inject(CategoryRepository);
  private readonly newId = inject(ID_GENERATOR);

  private readonly state = signal<readonly Category[]>([]);
  private readonly countsState = signal<ReadonlyMap<string, number>>(new Map());

  readonly categories = computed(() => [...this.state()].sort((a, b) => a.sortOrder - b.sortOrder));
  readonly byId = computed(() => new Map(this.state().map((category) => [category.id, category])));
  readonly receiptCounts = this.countsState.asReadonly();

  async load(): Promise<void> {
    const [categories, counts] = await Promise.all([
      this.repository.list(),
      this.repository.receiptCounts(),
    ]);
    this.state.set(categories);
    this.countsState.set(counts);
  }

  async refreshCounts(): Promise<void> {
    this.countsState.set(await this.repository.receiptCounts());
  }

  /** The category of a receipt; "Other" when it no longer exists. */
  categoryOf(id: string): Category | undefined {
    return this.byId().get(id) ?? this.byId().get(OTHER_CATEGORY_ID);
  }

  async create(input: CategoryInput): Promise<Category> {
    const existing = this.state();
    assertUniqueCategoryName(input.name, existing);
    const lastOrder = Math.max(0, ...existing.filter((c) => !c.isFallback).map((c) => c.sortOrder));
    const category = Category.create({ ...input, id: this.newId(), sortOrder: lastOrder + 1 });
    await this.repository.save(category);
    this.state.update((list) => [...list, category]);
    return category;
  }

  async edit(category: Category, input: CategoryInput): Promise<Category> {
    assertUniqueCategoryName(input.name, this.state(), category.id);
    const next = category.rename(input.name).restyle(input.color, input.icon);
    await this.repository.save(next);
    this.state.update((list) => list.map((c) => (c.id === next.id ? next : c)));
    return next;
  }

  async remove(category: Category): Promise<void> {
    category.assertDeletable();
    await this.repository.delete(category.id);
    this.state.update((list) => list.filter((c) => c.id !== category.id));
    await this.refreshCounts();
  }

  async reorder(orderedIds: readonly string[]): Promise<void> {
    const byId = this.byId();
    const reordered = orderedIds.flatMap((id, index) => {
      const category = byId.get(id);
      return category ? [category.moveTo(index)] : [];
    });
    const moved = new Set(orderedIds);
    this.state.update((list) => [...reordered, ...list.filter((c) => !moved.has(c.id))]);
    await this.repository.saveOrder(reordered);
  }

  storeRules(): Promise<ReadonlyMap<string, string>> {
    return this.repository.storeRules();
  }

  async alwaysUseForStore(store: string, categoryId: string): Promise<void> {
    const storeKey = storeKeyOf(store);
    if (storeKey.length > 0) {
      await this.repository.saveStoreRule({ storeKey, categoryId });
    }
  }
}
