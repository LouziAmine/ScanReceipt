import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CATEGORY_COLORS, type Category, type Receipt } from '@domain';
import { MoneyPipe } from './money.pipe';
import { receiptWhen } from './dates';

/** One receipt in a list: paper thumbnail, store, category · time, review badge, amount. */
@Component({
  selector: 'app-receipt-row',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="thumb" aria-hidden="true">
      <span class="line w80 strong"></span>
      <span class="line"></span>
      <span class="line w60"></span>
      <span class="line w50 strong total"></span>
    </span>
    <span class="text">
      <span class="store">{{ receipt().store }}</span>
      <span class="meta">
        <span class="dot" [style.background]="dotColor()"></span>
        {{ category()?.name ?? 'Other' }} · {{ when() }}
        @if (receipt().needsReview) {
          <span class="review-badge">Needs review</span>
        }
      </span>
    </span>
    <span class="amount">{{ receipt().total.cents | money: receipt().currency }}</span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      min-height: 56px;
      padding: 8px 0;
    }
    .thumb {
      width: 42px;
      height: 54px;
      flex: none;
      border-radius: 8px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 9px 8px;
      box-sizing: border-box;
    }
    .line {
      height: 3px;
      border-radius: 2px;
      background: var(--app-border);
    }
    .strong {
      background: var(--app-border-strong);
    }
    .w80 {
      width: 80%;
    }
    .w60 {
      width: 60%;
    }
    .w50 {
      width: 50%;
    }
    .total {
      margin-top: auto;
      align-self: flex-end;
    }
    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .store {
      font-size: 16px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--app-text-muted);
      flex-wrap: wrap;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .amount {
      font-size: 16px;
    }
  `,
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
