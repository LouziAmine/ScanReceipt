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
import { SaveReceiptUseCase, ScanReceiptUseCase, SettingsStore } from '@application';
import { type Receipt, type ReviewableField, doubtfulFieldsOf } from '@domain';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { NavController } from '@ionic/angular/nav-controller';
import { currencySymbol } from '../../shared/currency';
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
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">Cancel</ion-button>
        </ion-buttons>
        <ion-title>{{ review() ? 'Review receipt' : 'Edit receipt' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button [strong]="true" [disabled]="busy()" (click)="save()">Save</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (current(); as r) {
        @if (review()) {
          <span class="chip" [class.ok]="remaining() === 0" role="status">
            {{
              remaining() === 0
                ? 'Ready to save'
                : remaining() + (remaining() === 1 ? ' field to check' : ' fields to check')
            }}
          </span>
        }

        <div class="photo-row">
          <app-receipt-image class="photo" [path]="r.imagePath" [alt]="'Receipt from ' + r.store" />
          <div class="photo-actions">
            <span class="label">Receipt photo</span>
            <ion-button size="small" fill="outline" [disabled]="busy()" (click)="replacePhoto(r)">
              <ion-icon slot="start" name="camera-outline" />
              Replace photo
            </ion-button>
            <ion-button size="small" fill="outline" [disabled]="busy()" (click)="rerunOcr(r)">
              <ion-icon slot="start" name="refresh-outline" />
              Re-run OCR
            </ion-button>
          </div>
        </div>

        @if (initial(); as values) {
          <app-receipt-form [initial]="values" [currencySymbol]="symbol()" />
        }

        <p class="footnote">
          @if (review()) {
            Leaving without saving keeps the "Needs review" status.
          } @else {
            Edit fixes any field the OCR got wrong. Changes are saved on this phone only.
          }
        </p>
      } @else {
        <div class="loading"><ion-spinner name="crescent" /></div>
      }
    </ion-content>
  `,
  styles: `
    .chip {
      display: inline-block;
      margin-bottom: 16px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      background: var(--app-review-bg);
      color: var(--app-review-fg);
      &.ok {
        background: var(--app-chip-on-bg);
        color: var(--app-chip-on-fg);
      }
    }
    .photo-row {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .photo {
      width: 96px;
      height: 124px;
      border-radius: var(--app-radius-md);
      flex: none;
    }
    .photo-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }
    .label {
      font-size: 13px;
      font-weight: 500;
      color: var(--app-text-muted);
    }
    .footnote {
      margin-top: 20px;
      font-size: 13px;
      color: var(--app-text-muted);
    }
    .loading {
      display: flex;
      justify-content: center;
      padding: 48px;
    }
  `,
})
export class ReceiptEditPage {
  private readonly saver = inject(SaveReceiptUseCase);
  private readonly scan = inject(ScanReceiptUseCase);
  private readonly settings = inject(SettingsStore);
  private readonly feedback = inject(FeedbackService);
  private readonly nav = inject(NavController);
  private readonly form = viewChild(ReceiptFormComponent);

  readonly id = input.required<string>();
  /** Query parameter `?review=true`. */
  readonly review = input(false, { transform: booleanAttribute });

  private readonly loaded = receiptResource(this.id);
  /** The receipt being edited; replaced locally after a new photo. */
  protected readonly current = linkedSignal<Receipt | null | undefined>(() => this.loaded.value());
  protected readonly busy = signal(false);
  protected readonly symbol = computed(() =>
    currencySymbol(this.current()?.currency ?? this.settings.currency()),
  );
  protected readonly remaining = computed(() => this.form()?.doubtfulCount() ?? 0);
  private ocrText: string | null = null;

  /** Built once per receipt: reloading the list must not reset what the person typed. */
  protected readonly initial = linkedSignal<string | undefined, ReceiptFormInitial | null>({
    source: () => this.current()?.id,
    computation: () => {
      const r = this.current();
      if (!r) return null;
      return {
        store: r.store,
        purchasedAt: r.purchasedAt,
        totalCents: r.total.cents,
        taxCents: r.tax?.cents ?? null,
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
      await this.feedback.toast('Please fill in the store and the total.');
      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.saver.revise(receipt, result.value, this.ocrText ?? undefined);
      await this.nav.pop();
      if (receipt.needsReview && !saved.needsReview) {
        await this.feedback.toastWithUndo('Receipt marked as reviewed', () =>
          this.saver.restore(receipt),
        );
      } else {
        await this.feedback.toast('Changes saved');
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
    const result = await this.feedback.busy('Reading the receipt…', () =>
      this.scan.reread(receipt.imagePath),
    );
    if (!result) return;
    const { reading, text } = result;
    this.ocrText = text;
    const doubtful: ReviewableField[] = doubtfulFieldsOf(reading);
    this.form()?.patchFromReading({
      store: reading.store.value ?? receipt.store,
      purchasedAt: reading.purchasedAt.value ?? receipt.purchasedAt,
      totalCents: reading.totalCents.value ?? receipt.total.cents,
      taxCents: reading.taxCents.value ?? receipt.tax?.cents ?? null,
      doubtfulFields: doubtful,
    });
    await this.feedback.toast('Fields updated from the photo. Check them, then save.');
  }
}
