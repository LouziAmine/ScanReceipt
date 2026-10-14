import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { SaveReceiptUseCase, ScanReceiptUseCase } from '@application';
import { type Money, type Receipt, type ReviewableField, doubtfulFieldsOf } from '@domain';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { NavController } from '@ionic/angular/nav-controller';
import { t } from '../../i18n/i18n';
import { PluralPipe, TranslatePipe } from '../../i18n/translate.pipe';
import { CurrencyConversionService } from '../../shared/currency-conversion.service';
import { FeedbackService } from '../../shared/feedback.service';
import { ReceiptImageComponent } from '../../shared/receipt-image.component';
import {
  type ReceiptFormInitial,
  ReceiptFormComponent,
} from '../../scan/receipt-form/receipt-form.component';
import { receiptResource } from '../receipt-resource';

/** Edits any field; with `?review=true` it is the "check the doubtful field" screen. */
@Component({
  selector: 'app-receipt-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PluralPipe,
    ReceiptFormComponent,
    ReceiptImageComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
    IonSpinner,
  ],
  templateUrl: './receipt-edit.page.html',
  styleUrl: './receipt-edit.page.scss',
})
export class ReceiptEditPage {
  private readonly saver = inject(SaveReceiptUseCase);
  private readonly scan = inject(ScanReceiptUseCase);
  private readonly feedback = inject(FeedbackService);
  private readonly conversion = inject(CurrencyConversionService);
  private readonly nav = inject(NavController);
  private readonly form = viewChild(ReceiptFormComponent);

  readonly id = input.required<string>();
  /** Query parameter `?review=true`. */
  readonly review = input(false, { transform: booleanAttribute });

  private readonly loaded = receiptResource(this.id);
  /** The receipt being edited; replaced locally after a new photo. */
  protected readonly current = linkedSignal<Receipt | null | undefined>(() => this.loaded.value());
  protected readonly busy = signal(false);
  protected readonly remaining = computed(() => this.form()?.doubtfulCount() ?? 0);
  private ocrText: string | null = null;

  /** Built once per receipt: reloading the list must not reset what the person typed. */
  protected readonly initial = linkedSignal<string | undefined, ReceiptFormInitial | null>({
    source: () => this.current()?.id,
    computation: () => {
      const r = this.current();
      if (!r) return null;
      // A converted receipt is edited with the amounts printed on it.
      const paid = printedAmounts(r);
      return {
        store: r.store,
        purchasedAt: r.purchasedAt,
        totalCents: paid.total.cents,
        taxCents: paid.tax?.cents ?? null,
        currency: paid.total.currency,
        categoryId: r.categoryId,
        note: r.note,
        doubtfulFields: r.doubtfulFields,
      };
    },
  });

  protected async cancel(): Promise<void> {
    await this.nav.pop();
  }

  protected async save(): Promise<void> {
    const receipt = this.current();
    const result = this.form()?.value();
    if (!receipt || !result) {
      await this.feedback.toast(t('Please fill in the store and the total.'));
      return;
    }
    this.busy.set(true);
    try {
      const value = await this.conversion.toPersonCurrency(result.value, receipt);
      if (!value) return;
      const saved = await this.saver.revise(receipt, value, this.ocrText ?? undefined);
      await this.nav.pop();
      if (receipt.needsReview && !saved.needsReview) {
        await this.feedback.toastWithUndo(t('Receipt marked as reviewed'), () =>
          this.saver.restore(receipt),
        );
      } else {
        await this.feedback.toast(t('Changes saved'));
      }
    } catch (error: unknown) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async replacePhoto(receipt: Receipt): Promise<void> {
    this.busy.set(true);
    try {
      const updated = await this.saver.replacePhoto(receipt);
      if (updated) {
        this.current.set(updated);
        await this.rerunOcr(updated);
      }
    } catch (error: unknown) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async rerunOcr(receipt: Receipt): Promise<void> {
    const result = await this.feedback.busy(t('Reading the receipt…'), () =>
      this.scan.reread(receipt.imagePath),
    );
    if (!result) return;
    const { reading, text } = result;
    this.ocrText = text;
    const doubtful: ReviewableField[] = doubtfulFieldsOf(reading);
    const paid = printedAmounts(receipt);
    this.form()?.patchFromReading({
      store: reading.store.value ?? receipt.store,
      purchasedAt: reading.purchasedAt.value ?? receipt.purchasedAt,
      totalCents: reading.totalCents.value ?? paid.total.cents,
      taxCents: reading.taxCents.value ?? paid.tax?.cents ?? null,
      currency: reading.currency.value ?? paid.total.currency,
      ...(reading.currency.hint
        ? { currencyHint: { text: reading.currency.hint, params: reading.currency.hintParams } }
        : {}),
      doubtfulFields: doubtful,
    });
    await this.feedback.toast(t('Fields updated from the photo. Check them, then save.'));
  }
}

/** The total and tax as printed on the receipt, before any conversion. */
function printedAmounts(receipt: Receipt): { total: Money; tax: Money | null } {
  return receipt.original ?? { total: receipt.total, tax: receipt.tax };
}
