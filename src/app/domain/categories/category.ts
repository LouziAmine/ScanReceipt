import { DomainError } from '../shared-kernel/domain-error';

export const CATEGORY_COLORS = {
  teal: { hex: '#0F766E', tint: '#CCE8E3' },
  green: { hex: '#16A34A', tint: '#DCFCE7' },
  orange: { hex: '#C2410C', tint: '#FFEDD5' },
  blue: { hex: '#1D4ED8', tint: '#DBEAFE' },
  pink: { hex: '#BE185D', tint: '#FCE7F3' },
  indigo: { hex: '#4338CA', tint: '#E0E7FF' },
  purple: { hex: '#6D28D9', tint: '#EDE9FE' },
  amber: { hex: '#92400E', tint: '#FEF3C7' },
  gray: { hex: '#4B5157', tint: '#EEF0ED' },
} as const;
export type CategoryColor = keyof typeof CATEGORY_COLORS;
export const CATEGORY_COLOR_NAMES = Object.keys(CATEGORY_COLORS) as CategoryColor[];

export const CATEGORY_ICONS = [
  'cart',
  'restaurant',
  'car',
  'medkit',
  'briefcase',
  'cafe',
  'home',
  'film',
  'laptop',
  'gift',
  'shirt',
  'pricetag',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/** The fallback category: it can never be deleted, so no receipt is ever orphaned. */
export const OTHER_CATEGORY_ID = 'other';

const MAX_NAME_LENGTH = 30;

export interface CategorySnapshot {
  readonly id: string;
  readonly name: string;
  readonly color: CategoryColor;
  readonly icon: CategoryIcon;
  readonly isCustom: boolean;
  readonly sortOrder: number;
}

export interface CreateCategory {
  readonly id: string;
  readonly name: string;
  readonly color: CategoryColor;
  readonly icon: CategoryIcon;
  readonly sortOrder: number;
}

/** Aggregate root of the Categories context. Immutable. */
export class Category {
  private constructor(private readonly props: CategorySnapshot) {}

  static create(input: CreateCategory): Category {
    return new Category({ ...input, name: Category.validName(input.name), isCustom: true });
  }

  static rehydrate(snapshot: CategorySnapshot): Category {
    return new Category(snapshot);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get color(): CategoryColor {
    return this.props.color;
  }
  get icon(): CategoryIcon {
    return this.props.icon;
  }
  get isCustom(): boolean {
    return this.props.isCustom;
  }
  get sortOrder(): number {
    return this.props.sortOrder;
  }
  get isFallback(): boolean {
    return this.props.id === OTHER_CATEGORY_ID;
  }

  rename(name: string): Category {
    return new Category({ ...this.props, name: Category.validName(name) });
  }

  restyle(color: CategoryColor, icon: CategoryIcon): Category {
    return new Category({ ...this.props, color, icon });
  }

  moveTo(sortOrder: number): Category {
    return new Category({ ...this.props, sortOrder });
  }

  /** Deleting a category moves its receipts to "Other", which itself cannot go. */
  assertDeletable(): void {
    if (this.isFallback) {
      throw new DomainError('"Other" cannot be deleted: it keeps receipts without a category.');
    }
  }

  snapshot(): CategorySnapshot {
    return this.props;
  }

  private static validName(name: string): string {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) {
      throw new DomainError('Enter a category name.', 'name');
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      throw new DomainError(`A category name is limited to ${MAX_NAME_LENGTH} characters.`, 'name');
    }
    return trimmed;
  }
}

export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'groceries', name: 'Groceries', color: 'green', icon: 'cart', sortOrder: 0 },
  { id: 'dining', name: 'Dining', color: 'orange', icon: 'restaurant', sortOrder: 1 },
  { id: 'transportation', name: 'Transportation', color: 'blue', icon: 'car', sortOrder: 2 },
  { id: 'health', name: 'Health', color: 'pink', icon: 'medkit', sortOrder: 3 },
  { id: 'office', name: 'Office supplies', color: 'indigo', icon: 'briefcase', sortOrder: 4 },
  { id: OTHER_CATEGORY_ID, name: 'Other', color: 'gray', icon: 'pricetag', sortOrder: 99 },
].map((seed) =>
  Category.rehydrate({ ...(seed as Omit<CategorySnapshot, 'isCustom'>), isCustom: false }),
);
