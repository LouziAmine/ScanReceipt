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
import { MoneyPipe } from '../../shared/money.pipe';
import { fromLocalIso, toLocalIso } from '../../shared/dates';

/** Calendar where days with receipts are marked; shows the chosen day's total. */
@Component({
  selector: 'app-date-picker-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="close()">Cancel</ion-button>
        </ion-buttons>
        <ion-title>Pick a date</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="shortcuts">
        <ion-button size="small" fill="outline" (click)="select(today)">Today</ion-button>
        <ion-button size="small" fill="outline" (click)="select(yesterday)">Yesterday</ion-button>
      </div>
      <ion-datetime
        presentation="date"
        size="cover"
        [max]="maxIso"
        [value]="selectedIso()"
        [highlightedDates]="highlight"
        (ionChange)="onChange($event.detail.value)"
      />
      <div class="info" aria-live="polite">
        <strong>{{ selectedLabel() }}</strong>
        @if (selectedTotal(); as day) {
          <span>{{ day.count }} {{ day.count === 1 ? 'receipt' : 'receipts' }}</span>
          <span class="amount">{{ day.totalCents | money: currency() }}</span>
        } @else {
          <span class="muted">No receipts on this day</span>
        }
      </div>
    </ion-content>
    <ion-footer class="ion-no-border">
      <ion-toolbar class="ion-padding-horizontal">
        <ion-button expand="block" (click)="confirm()">Show this day</ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    .shortcuts {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .info {
      margin-top: 16px;
      padding: 14px 16px;
      border-radius: var(--app-radius-md);
      background: var(--app-surface);
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      strong {
        flex: 1 1 100%;
      }
    }
  `,
})
export class DatePickerModalComponent implements OnInit {
  private readonly modal = inject(ModalController);
  private readonly query = inject(PeriodSummaryQuery);
  protected readonly currency = inject(SettingsStore).currency;

  readonly initial = input(new Date());

  protected readonly today = startOfDay(new Date());
  protected readonly yesterday = addDays(this.today, -1);
  protected readonly maxIso = toLocalIso(new Date()).slice(0, 10);
  protected readonly selected = signal(this.today);
  private readonly totals = signal<ReadonlyMap<string, DailyTotal>>(new Map());

  protected readonly selectedIso = computed(() => toLocalIso(this.selected()).slice(0, 10));
  protected readonly selectedTotal = computed(() =>
    this.totals().get(localDayKey(this.selected())),
  );
  protected readonly selectedLabel = computed(() =>
    new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(
      this.selected(),
    ),
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
    return this.modal.dismiss(null, 'cancel');
  }

  protected confirm(): Promise<boolean> {
    return this.modal.dismiss(this.selected(), 'select');
  }
}
