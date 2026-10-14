import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { PeriodSummaryQuery, SettingsStore } from '@application';
import { type DailyTotal, addDays, localDayKey, periodRange, startOfDay } from '@domain';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonDatetime } from '@ionic/angular/ion-datetime';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { dateFormat } from '../../i18n/formats';
import { locale } from '../../i18n/i18n';
import { PluralPipe, TranslatePipe } from '../../i18n/translate.pipe';
import { MoneyPipe } from '../../shared/money.pipe';
import { fromLocalIso, toLocalIso } from '../../shared/dates';

/** Calendar where days with receipts are marked; shows the chosen day's total. */
@Component({
  selector: 'app-date-picker-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PluralPipe,
    MoneyPipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonDatetime,
    IonFooter,
  ],
  templateUrl: './date-picker.modal.html',
  styleUrl: './date-picker.modal.scss',
})
export class DatePickerModalComponent implements OnInit {
  private readonly modals = inject(ModalController);
  private readonly query = inject(PeriodSummaryQuery);
  protected readonly currency = inject(SettingsStore).currency;

  readonly initial = input(new Date());

  protected readonly today = startOfDay(new Date());
  protected readonly yesterday = addDays(this.today, -1);
  protected readonly locale = locale;
  protected readonly maxIso = toLocalIso(new Date()).slice(0, 10);
  protected readonly selected = signal(this.today);
  private readonly totals = signal<ReadonlyMap<string, DailyTotal>>(new Map());

  protected readonly selectedIso = computed(() => toLocalIso(this.selected()).slice(0, 10));
  protected readonly selectedTotal = computed(() =>
    this.totals().get(localDayKey(this.selected())),
  );
  protected readonly selectedLabel = computed(() =>
    dateFormat({ weekday: 'long', month: 'long', day: 'numeric' }).format(this.selected()),
  );

  /** Marks days that have receipts (ion-datetime calls this for each visible day). */
  protected readonly highlight = (
    isoDate: string,
  ): { textColor: string; backgroundColor: string } | undefined =>
    this.totals().has(isoDate.slice(0, 10))
      ? { textColor: 'var(--app-chip-on-fg)', backgroundColor: 'var(--app-chip-on-bg)' }
      : undefined;

  ngOnInit(): void {
    this.selected.set(startOfDay(this.initial()));
    void this.loadTotals();
  }

  private async loadTotals(): Promise<void> {
    // One year of daily totals is a small query and covers months the person may swipe to.
    const to = addDays(this.today, 1);
    const from = periodRange('year', new Date(to.getFullYear() - 1, to.getMonth(), 1)).from;
    const days = await this.query.dailyTotals({ from, to });
    this.totals.set(new Map(days.map((d) => [d.day, d])));
  }

  protected onChange(value: string | string[] | null | undefined): void {
    if (typeof value === 'string') this.selected.set(fromLocalIso(value.slice(0, 10)));
  }

  protected select(date: Date): void {
    this.selected.set(date);
  }

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected confirm(): Promise<boolean> {
    return this.modals.dismiss(this.selected(), 'select');
  }
}
