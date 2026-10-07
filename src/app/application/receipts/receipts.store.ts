import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type Receipt,
  type ReceiptCriteria,
  ReceiptRepository,
  type ReceiptTotals,
  isFilterActive,
  periodRange,
} from '@domain';
import { SettingsStore } from '../settings/settings.store';
import { CLOCK } from '../shared/clock';

const PAGE_SIZE = 40;
const NO_TOTALS: ReceiptTotals = { count: 0, totalCents: 0, otherCurrencyCount: 0 };

/** Read side of the Receipts context: the list, its filter, search, paging and summaries. */
@Injectable({ providedIn: 'root' })
export class ReceiptsStore {
  private readonly repository = inject(ReceiptRepository);
  private readonly settings = inject(SettingsStore);
  private readonly now = inject(CLOCK);

  private readonly filterState = signal<ReceiptCriteria>({ sort: 'newest' });
  private readonly searchState = signal('');
  private readonly itemsState = signal<readonly Receipt[]>([]);
  private readonly hasMoreState = signal(false);
  private readonly loadingState = signal(false);
  private readonly monthTotalsState = signal<ReceiptTotals>(NO_TOTALS);
  private readonly reviewCountState = signal(0);
  private readonly matchingTotalsState = signal<ReceiptTotals>(NO_TOTALS);
  private requestId = 0;

  readonly filter = this.filterState.asReadonly();
  readonly search = this.searchState.asReadonly();
  readonly items = this.itemsState.asReadonly();
  readonly hasMore = this.hasMoreState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly monthTotals = this.monthTotalsState.asReadonly();
  readonly needsReviewCount = this.reviewCountState.asReadonly();
  readonly matchingTotals = this.matchingTotalsState.asReadonly();
  readonly filterActive = computed(() => isFilterActive(this.filterState()));

  private readonly criteria = computed<ReceiptCriteria>(() => {
    const text = this.searchState().trim();
    return text.length > 0 ? { ...this.filterState(), text } : this.filterState();
  });

  async setFilter(filter: ReceiptCriteria): Promise<void> {
    this.filterState.set(filter);
    await this.refresh();
  }

  async setSearch(text: string): Promise<void> {
    this.searchState.set(text);
    await this.refresh();
  }

  /** How many receipts a filter would show, without applying it. */
  async preview(filter: ReceiptCriteria): Promise<number> {
    return (await this.repository.totals(filter, this.settings.currency())).count;
  }

  async refresh(): Promise<void> {
    const request = ++this.requestId;
    this.loadingState.set(true);
    try {
      const criteria = this.criteria();
      const currency = this.settings.currency();
      const [page, month, review, matching] = await Promise.all([
        this.repository.search({ ...criteria, limit: PAGE_SIZE + 1, offset: 0 }),
        this.repository.totals({ range: periodRange('month', this.now()) }, currency),
        this.repository.totals({ onlyNeedsReview: true }, currency),
        this.repository.totals(criteria, currency),
      ]);
      // A newer refresh started while this one was running: drop the stale result.
      if (request !== this.requestId) return;
      this.itemsState.set(page.slice(0, PAGE_SIZE));
      this.hasMoreState.set(page.length > PAGE_SIZE);
      this.monthTotalsState.set(month);
      this.reviewCountState.set(review.count);
      this.matchingTotalsState.set(matching);
    } finally {
      if (request === this.requestId) this.loadingState.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (!this.hasMoreState() || this.loadingState()) return;
    const request = this.requestId;
    const offset = this.itemsState().length;
    const page = await this.repository.search({ ...this.criteria(), limit: PAGE_SIZE + 1, offset });
    if (request !== this.requestId) return;
    this.itemsState.update((items) => [...items, ...page.slice(0, PAGE_SIZE)]);
    this.hasMoreState.set(page.length > PAGE_SIZE);
  }

  async findById(id: string): Promise<Receipt | null> {
    return this.itemsState().find((r) => r.id === id) ?? this.repository.findById(id);
  }

  firstNeedingReview(): Promise<Receipt | undefined> {
    return this.repository
      .search({ onlyNeedsReview: true, sort: 'newest', limit: 1 })
      .then((r) => r[0]);
  }
}
