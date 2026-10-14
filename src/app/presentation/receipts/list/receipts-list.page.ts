import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { environment } from '@env/environment';
import { CategoriesStore, PeriodSummaryQuery, ReceiptsStore, SettingsStore } from '@application';
import { type ReceiptCriteria, addDays, localDayKey, presetRange, startOfDay } from '@domain';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFab } from '@ionic/angular/ion-fab';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonItem } from '@ionic/angular/ion-item';
import { IonList } from '@ionic/angular/ion-list';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { Platform } from '@ionic/angular/platform';
import type {
  InfiniteScrollCustomEvent,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular';
import { formatMonthYear } from '../../shared/dates';
import { LongPressDirective } from '../../shared/long-press.directive';
import { AmountsPipe } from '../../shared/amounts';
import { t } from '../../i18n/i18n';
import { PluralPipe, TranslatePipe } from '../../i18n/translate.pipe';
import { ReceiptRowComponent } from '../../shared/receipt-row.component';
import { FilterModalComponent } from '../filter/filter.modal';
import { groupReceipts } from '../group-receipts';
import { DailySpendingChartComponent, type DaySpending } from './daily-spending-chart.component';
import { isDarkAppearance } from '../../shared/appearance';
import { WebAppService } from '../../shared/web-app.service';
import { ScanLauncher } from '../scan-launcher.service';

type QuickFilter = 'all' | 'this_month' | `category:${string}`;

@Component({
  selector: 'app-receipts-list',
  templateUrl: './receipts-list.page.html',
  styleUrl: './receipts-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DailySpendingChartComponent,
    PluralPipe,
    TranslatePipe,
    RouterLink,
    AmountsPipe,
    ReceiptRowComponent,
    LongPressDirective,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFooter,
    IonSpinner,
  ],
})
export class ReceiptsListPage implements ViewWillEnter {
  protected readonly store = inject(ReceiptsStore);
  protected readonly categories = inject(CategoriesStore);
  private readonly settings = inject(SettingsStore);
  private readonly scanLauncher = inject(ScanLauncher);
  private readonly router = inject(Router);
  private readonly modals = inject(ModalController);
  private readonly actionSheets = inject(ActionSheetController);

  /** iOS gets a bottom bar with Scan + Photos; Android a Material extended FAB. */
  protected readonly isIos = inject(Platform).is('ios');
  /** Browser demo on GitHub Pages: explains what only the mobile app can do. */
  protected readonly webDemo = environment.webDemo;
  /** In the demo: "Install the app" (home screen icon, opens offline). */
  protected readonly webApp = inject(WebAppService);
  protected readonly currency = this.settings.currency;
  /** Header toggle: moon while light (switch to dark), sun while dark (switch to light). */
  protected readonly dark = isDarkAppearance();
  private readonly summaries = inject(PeriodSummaryQuery);
  /** "30 days" chart on the line of the first section; open or closed is remembered. */
  protected readonly chartDays = CHART_DAYS;
  protected readonly chartOpen = signal(readChartOpen());
  protected readonly dailySpending = resource({
    // Reloads when the list changes (scan, edit, delete) or the currency changes.
    params: () =>
      this.chartOpen()
        ? { items: this.store.items(), today: startOfDay(this.now()), currency: this.currency() }
        : undefined,
    loader: async ({ params }): Promise<DaySpending[]> => {
      const from = addDays(params.today, -(CHART_DAYS - 1));
      const totals = await this.summaries.dailyTotals({ from, to: addDays(params.today, 1) });
      const byDay = new Map(totals.map((t) => [t.day, t]));
      return Array.from({ length: CHART_DAYS }, (_, i) => {
        const date = addDays(from, i);
        const total = byDay.get(localDayKey(date));
        return { date, cents: total?.totalCents ?? 0, count: total?.count ?? 0 };
      });
    },
  });
  protected readonly now = signal(new Date());
  protected readonly monthLabel = computed(() => formatMonthYear(this.now()));
  protected readonly groups = computed(() => groupReceipts(this.store.items(), this.now()));
  protected readonly quickCategories = computed(() =>
    this.categories
      .categories()
      .filter((c) => !c.isFallback)
      .slice(0, 3),
  );
  protected readonly isEmpty = computed(
    () => !this.store.loading() && this.store.items().length === 0,
  );

  protected readonly hasSearchOrFilter = computed(
    () => this.store.filterActive() || this.store.search().length > 0,
  );
  protected readonly activeQuick = computed<QuickFilter | null>(() => {
    const filter = this.store.filter();
    if (!this.store.filterActive()) return 'all';
    const range = filter.range;
    const onlyRange = range && !filter.categoryIds?.length && !filter.onlyNeedsReview;
    if (
      onlyRange &&
      range.from.getTime() === presetRange('this_month', this.now()).from.getTime()
    ) {
      return 'this_month';
    }
    const ids = filter.categoryIds ?? [];
    const [only] = ids;
    return ids.length === 1 && !filter.range && only ? `category:${only}` : null;
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ionViewWillEnter(): void {
    this.now.set(new Date());
  }

  protected onSearch(value: string | null | undefined): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    // Debounced: one query per pause in typing, not one per key.
    this.searchTimer = setTimeout(() => void this.store.setSearch(value ?? ''), 250);
  }

  protected async applyQuick(quick: QuickFilter): Promise<void> {
    let filter: ReceiptCriteria = { sort: 'newest' };
    if (quick === 'this_month') {
      filter = { ...filter, range: presetRange('this_month', new Date()) };
    } else if (quick.startsWith('category:')) {
      filter = { ...filter, categoryIds: [quick.slice('category:'.length)] };
    }
    await this.store.setFilter(filter);
  }

  protected applyCategory(categoryId: string): Promise<void> {
    return this.applyQuick(`category:${categoryId}`);
  }

  protected toggleChart(): void {
    const open = !this.chartOpen();
    this.chartOpen.set(open);
    try {
      localStorage.setItem(CHART_KEY, open ? '1' : '0');
    } catch {
      // Private browsing: the choice just isn't remembered.
    }
  }

  protected async install(): Promise<void> {
    await this.webApp.install();
  }

  /** Forces Light or Dark; "Same as device" stays available in Settings. */
  protected async toggleTheme(): Promise<void> {
    await this.settings.update({ theme: this.dark() ? 'light' : 'dark' });
  }

  protected async openFilter(): Promise<void> {
    const modal = await this.modals.create({
      component: FilterModalComponent,
      componentProps: { initial: this.store.filter() },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<ReceiptCriteria>();
    if (role === 'apply' && data) {
      await this.store.setFilter(data);
    }
  }

  protected async openMore(): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: t('My receipts'),
      buttons: [
        { text: t('Select receipts'), icon: 'checkmark-circle', data: '/receipts/select' },
        { text: t('Import from photos'), icon: 'images-outline', data: 'photos' },
        { text: t('Export all'), icon: 'share-outline', data: '/export' },
        { text: t('Manage categories'), icon: 'pricetags-outline', data: '/categories' },
        { text: t('Backup & restore'), icon: 'archive-outline', data: '/backup' },
        { text: t('Settings'), icon: 'settings-outline', data: '/settings' },
        { text: t('Cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();
    if (data === 'photos') {
      await this.scanLauncher.start('photos');
    } else if (data) {
      await this.router.navigateByUrl(data);
    }
  }

  protected async reviewNow(): Promise<void> {
    const receipt = await this.store.firstNeedingReview();
    if (receipt) {
      await this.router.navigate(['/receipts', receipt.id, 'edit'], {
        queryParams: { review: true },
      });
    }
  }

  protected scan(source: 'camera' | 'photos' = 'camera'): void {
    void this.scanLauncher.start(source);
  }

  protected startSelection(receiptId: string): void {
    void this.router.navigate(['/receipts/select'], { queryParams: { preselect: receiptId } });
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    this.now.set(new Date());
    await this.store.refresh();
    await event.target.complete();
  }

  protected async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    await this.store.loadMore();
    await event.target.complete();
  }
}

const CHART_DAYS = 30;
const CHART_KEY = 'receipts.dailyChartOpen';

function readChartOpen(): boolean {
  try {
    return localStorage.getItem(CHART_KEY) === '1';
  } catch {
    return false;
  }
}
