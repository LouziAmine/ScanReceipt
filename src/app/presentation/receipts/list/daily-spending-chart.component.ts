import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { dateFormat } from '../../i18n/formats';
import { t } from '../../i18n/i18n';
import { PluralPipe, TranslatePipe } from '../../i18n/translate.pipe';
import { MoneyPipe } from '../../shared/money.pipe';

export interface DaySpending {
  readonly date: Date;
  readonly cents: number;
  readonly count: number;
}

/**
 * Column chart of the money spent per day. One series in one color; the readout above the
 * bars gives the exact amount of the selected day (today at first), so no value depends on
 * hovering, and every bar is a button with the same text for screen readers.
 */
@Component({
  selector: 'app-daily-spending-chart',
  imports: [MoneyPipe, PluralPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-spending-chart.component.html',
  styleUrl: './daily-spending-chart.component.scss',
})
export class DailySpendingChartComponent {
  readonly days = input.required<readonly DaySpending[]>();
  readonly currency = input.required<string>();

  /** null = the last day (today) until the person picks another bar. */
  protected readonly picked = signal<number | null>(null);
  protected readonly selectedIndex = computed(() => this.picked() ?? this.days().length - 1);
  protected readonly selected = computed(() => this.days()[this.selectedIndex()]);
  /** A date under every 2nd bar for two weeks, every 5th for a month. */
  protected readonly labelStep = computed(() => (this.days().length > 14 ? 5 : 2));
  // At least one cent, so empty periods still draw a flat chart.
  protected readonly maxCents = computed(() => Math.max(1, ...this.days().map((d) => d.cents)));

  protected dayName(date: Date): string {
    return isToday(date)
      ? t('Today, {weekday}', { weekday: dateFormat({ weekday: 'short' }).format(date) })
      : dateFormat({ weekday: 'long', month: 'short', day: 'numeric' }).format(date);
  }
}

function isToday(date: Date): boolean {
  return date.toDateString() === new Date().toDateString();
}
