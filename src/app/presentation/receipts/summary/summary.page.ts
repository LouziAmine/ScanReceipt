import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriesStore, PeriodSummaryQuery, ReceiptsStore, SettingsStore } from '@application';
import {
  CATEGORY_COLORS,
  type PeriodUnit,
  addDays,
  localDayKey,
  periodRange,
  shiftPeriod,
  startOfDay,
} from '@domain';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonList } from '@ionic/angular/ion-list';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { MoneyPipe } from '../../shared/money.pipe';
import { ReceiptRowComponent } from '../../shared/receipt-row.component';
import { DatePickerModalComponent } from './date-picker.modal';

const UNITS: readonly { value: PeriodUnit; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

@Component({
  selector: 'app-summary',
  templateUrl: './summary.page.html',
  styleUrl: './summary.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MoneyPipe,
    ReceiptRowComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonList,
    IonItem,
    IonSpinner,
  ],
})
export class SummaryPage {
  private readonly query = inject(PeriodSummaryQuery);
  private readonly settings = inject(SettingsStore);
  private readonly receipts = inject(ReceiptsStore);
  protected readonly categories = inject(CategoriesStore);
  private readonly modals = inject(ModalController);

  protected readonly units = UNITS;
  protected readonly colors = CATEGORY_COLORS;
  protected readonly currency = this.settings.currency;
  protected readonly now = new Date();
  protected readonly unit = signal<PeriodUnit>('month');
  protected readonly anchor = signal(startOfDay(new Date()));

  protected readonly range = computed(() =>
    periodRange(this.unit(), this.anchor(), this.settings.settings().weekStartsOn),
  );
  protected readonly isCurrent = computed(() => this.range().to.getTime() > Date.now());

  protected readonly summary = resource({
    // Re-runs when the period changes or any receipt is saved.
    params: () => ({ range: this.range(), version: this.receipts.items() }),
    loader: ({ params }) => this.query.summarize(params.range),
  });

  protected readonly label = computed(() => {
    const { from, to } = this.range();
    switch (this.unit()) {
      case 'day':
        return new Intl.DateTimeFormat(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(from);
      case 'week': {
        const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
        return `${fmt.format(from)} – ${fmt.format(addDays(to, -1))}`;
      }
      case 'month':
        return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(from);
      case 'year':
        return String(from.getFullYear());
    }
  });

  /** The 7 days of a week, with their totals, for the week strip. */
  protected readonly weekDays = computed(() => {
    if (this.unit() !== 'week') return [];
    const totals = new Map((this.summary.value()?.byDay ?? []).map((d) => [d.day, d.totalCents]));
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(this.range().from, i);
      return {
        date,
        name: weekday.format(date),
        number: date.getDate(),
        cents: totals.get(localDayKey(date)) ?? 0,
        future: date.getTime() > Date.now(),
      };
    });
  });

  protected readonly maxCategoryCents = computed(() =>
    Math.max(1, ...(this.summary.value()?.byCategory ?? []).map((c) => c.totalCents)),
  );

  protected shift(steps: number): void {
    this.anchor.set(shiftPeriod(this.unit(), this.anchor(), steps));
  }

  protected setUnit(value: unknown): void {
    if (value === 'day' || value === 'week' || value === 'month' || value === 'year') {
      this.unit.set(value);
    }
  }

  protected openDay(date: Date): void {
    this.unit.set('day');
    this.anchor.set(date);
  }

  protected async pickDate(): Promise<void> {
    const modal = await this.modals.create({
      component: DatePickerModalComponent,
      componentProps: { initial: this.anchor() },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<Date>();
    if (role === 'select' && data) {
      this.openDay(data);
    }
  }
}
