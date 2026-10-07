import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoriesStore, ReceiptsStore, SettingsStore } from '@application';
import {
  CATEGORY_COLORS,
  type DatePreset,
  type DateRange,
  type ReceiptCriteria,
  type ReceiptSort,
  parseAmount,
  presetRange,
} from '@domain';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonDatetime } from '@ionic/angular/ion-datetime';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonRadio } from '@ionic/angular/ion-radio';
import { IonRadioGroup } from '@ionic/angular/ion-radio-group';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { fromLocalIso, toLocalIso } from '../../shared/dates';

type DateChoice = DatePreset | 'any' | 'custom';

const DATE_CHOICES: readonly { value: DateChoice; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'custom', label: 'Custom range' },
];

const SORTS: readonly { value: ReceiptSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Highest amount' },
  { value: 'amount_asc', label: 'Lowest amount' },
  { value: 'store_asc', label: 'Store name (A–Z)' },
];

@Component({
  selector: 'app-filter-modal',
  templateUrl: './filter.modal.html',
  styleUrl: './filter.modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonFooter,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonToggle,
    IonRadioGroup,
    IonRadio,
    IonDatetime,
  ],
})
export class FilterModalComponent implements OnInit {
  private readonly modal = inject(ModalController);
  private readonly receipts = inject(ReceiptsStore);
  private readonly settings = inject(SettingsStore);
  protected readonly categories = inject(CategoriesStore);

  readonly initial = input<ReceiptCriteria>({ sort: 'newest' });

  protected readonly dateChoices = DATE_CHOICES;
  protected readonly sorts = SORTS;
  protected readonly colors = CATEGORY_COLORS;

  protected readonly dateChoice = signal<DateChoice>('any');
  protected readonly customFrom = signal(
    toLocalIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  protected readonly customTo = signal(toLocalIso(new Date()));
  protected readonly categoryIds = signal<ReadonlySet<string>>(new Set());
  protected readonly minAmount = signal('');
  protected readonly maxAmount = signal('');
  protected readonly sort = signal<ReceiptSort>('newest');
  protected readonly onlyNeedsReview = signal(false);
  protected readonly matchCount = signal<number | null>(null);

  protected readonly criteria = computed<ReceiptCriteria>(() => {
    const range = this.range();
    const ids = [...this.categoryIds()];
    const min = this.minAmount().trim() ? parseAmount(this.minAmount()) : null;
    const max = this.maxAmount().trim() ? parseAmount(this.maxAmount()) : null;
    return {
      sort: this.sort(),
      ...(range ? { range } : {}),
      ...(ids.length > 0 ? { categoryIds: ids } : {}),
      ...(min !== null ? { minCents: min } : {}),
      ...(max !== null ? { maxCents: max } : {}),
      ...(this.onlyNeedsReview() ? { onlyNeedsReview: true } : {}),
    };
  });

  constructor() {
    // Live count on the apply button, so the person knows before leaving the sheet.
    effect(() => {
      const criteria = this.criteria();
      void this.receipts.preview(criteria).then((count) => {
        this.matchCount.set(count);
      });
    });
  }

  ngOnInit(): void {
    const initial = this.initial();
    this.sort.set(initial.sort ?? 'newest');
    this.categoryIds.set(new Set(initial.categoryIds ?? []));
    this.onlyNeedsReview.set(initial.onlyNeedsReview ?? false);
    this.minAmount.set(initial.minCents !== undefined ? (initial.minCents / 100).toFixed(2) : '');
    this.maxAmount.set(initial.maxCents !== undefined ? (initial.maxCents / 100).toFixed(2) : '');
    if (initial.range) {
      const preset = this.matchingPreset(initial.range);
      this.dateChoice.set(preset ?? 'custom');
      if (!preset) {
        this.customFrom.set(toLocalIso(initial.range.from));
        this.customTo.set(toLocalIso(new Date(initial.range.to.getTime() - 1)));
      }
    }
  }

  protected toggleCategory(id: string): void {
    this.categoryIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected reset(): void {
    this.dateChoice.set('any');
    this.categoryIds.set(new Set());
    this.minAmount.set('');
    this.maxAmount.set('');
    this.sort.set('newest');
    this.onlyNeedsReview.set(false);
  }

  protected close(): Promise<boolean> {
    return this.modal.dismiss(null, 'cancel');
  }

  protected apply(): Promise<boolean> {
    return this.modal.dismiss(this.criteria(), 'apply');
  }

  protected asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private range(): DateRange | null {
    const choice = this.dateChoice();
    if (choice === 'any') return null;
    const weekStart = this.settings.settings().weekStartsOn;
    if (choice !== 'custom') return presetRange(choice, new Date(), weekStart);
    const from = fromLocalIso(this.customFrom().slice(0, 10) + 'T00:00');
    const to = fromLocalIso(this.customTo().slice(0, 10) + 'T00:00');
    return { from, to: new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1) };
  }

  private matchingPreset(range: DateRange): DatePreset | null {
    const presets: DatePreset[] = ['this_week', 'this_month', 'last_3_months'];
    return (
      presets.find(
        (p) =>
          presetRange(p, new Date(), this.settings.settings().weekStartsOn).from.getTime() ===
          range.from.getTime(),
      ) ?? null
    );
  }
}
