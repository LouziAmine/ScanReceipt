import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CATEGORY_COLORS, type Category, type Receipt } from '@domain';
import { TranslatePipe } from '../i18n/translate.pipe';
import { MoneyPipe } from './money.pipe';
import { receiptWhen } from './dates';

/** One receipt in a list: paper thumbnail, store, category · time, review badge, amount. */
@Component({
  selector: 'app-receipt-row',
  imports: [MoneyPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipt-row.component.html',
  styleUrl: './receipt-row.component.scss',
})
export class ReceiptRowComponent {
  readonly receipt = input.required<Receipt>();
  readonly category = input<Category | undefined>();
  readonly now = input.required<Date>();

  protected readonly when = computed(() => receiptWhen(this.receipt().purchasedAt, this.now()));
  protected readonly dotColor = computed(
    () => CATEGORY_COLORS[this.category()?.color ?? 'gray'].hex,
  );
}
