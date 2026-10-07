import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  ImageStore,
  SaveReceiptUseCase,
  ScanReceiptUseCase,
  ScanSessionStore,
  SettingsStore,
} from '@application';
import { type ReviewableField, doubtfulFieldsOf } from '@domain';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { NavController } from '@ionic/angular/nav-controller';
import type { ViewWillEnter } from '@ionic/angular';
import { FeedbackService } from '../../shared/feedback.service';
import { ImageViewerService } from '../../shared/image-viewer.service';
import {
  type ReceiptFormInitial,
  ReceiptFormComponent,
} from '../receipt-form/receipt-form.component';
import { currencySymbol } from '../../shared/currency';

@Component({
  selector: 'app-scan-review',
  templateUrl: './scan-review.page.html',
  styleUrl: './scan-review.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReceiptFormComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonFooter,
    IonIcon,
  ],
})
export class ScanReviewPage implements ViewWillEnter {
  private readonly session = inject(ScanSessionStore);
  private readonly saveReceipt = inject(SaveReceiptUseCase);
  private readonly scan = inject(ScanReceiptUseCase);
  private readonly settings = inject(SettingsStore);
  private readonly images = inject(ImageStore);
  private readonly feedback = inject(FeedbackService);
  private readonly viewer = inject(ImageViewerService);
  private readonly nav = inject(NavController);
  private readonly router = inject(Router);

  private readonly form = viewChild(ReceiptFormComponent);

  protected readonly draft = this.session.draft;
  protected readonly saving = signal(false);
  protected readonly showOcrText = signal(false);
  protected readonly currencySymbol = computed(() => currencySymbol(this.settings.currency()));

  protected readonly initial = computed<ReceiptFormInitial | null>(() => {
    const draft = this.draft();
    if (!draft) return null;
    const reading = draft.reading;
    const categoryId = draft.suggestion?.categoryId ?? this.settings.settings().defaultCategoryId;
    if (!reading) {
      return {
        store: '',
        purchasedAt: new Date(),
        totalCents: null,
        taxCents: null,
        categoryId,
        note: '',
        doubtfulFields: [],
      };
    }
    const hints: Partial<Record<ReviewableField, string>> = {};
    if (reading.store.hint) hints.store = reading.store.hint;
    if (reading.purchasedAt.hint) hints.date = reading.purchasedAt.hint;
    if (reading.totalCents.hint) hints.total = reading.totalCents.hint;
    if (reading.taxCents.hint) hints.tax = reading.taxCents.hint;
    return {
      store: reading.store.value ?? '',
      purchasedAt: reading.purchasedAt.value ?? new Date(),
      totalCents: reading.totalCents.value,
      taxCents: reading.taxCents.value,
      categoryId,
      note: '',
      doubtfulFields: doubtfulFieldsOf(reading),
      hints,
    };
  });

  protected readonly suggestedByOcr = computed(
    () => this.draft()?.suggestion?.source !== 'default',
  );

  protected readonly preview = resource({
    params: () => this.draft()?.temporaryImageUri,
    loader: ({ params }) => this.images.previewUrl(params),
  });

  ionViewWillEnter(): void {
    if (!this.draft()) {
      void this.router.navigate(['/receipts'], { replaceUrl: true });
    }
  }

  protected viewImage(): void {
    const url = this.preview.value();
    if (url) void this.viewer.open(url);
  }

  protected async retake(): Promise<void> {
    try {
      if (await this.scan.capture('camera')) {
        await this.router.navigate(['/scan/processing'], { replaceUrl: true });
      }
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }

  protected async save(): Promise<void> {
    const result = this.form()?.value();
    if (!result) {
      await this.feedback.toast('Please fill in the store and the total.');
      return;
    }
    this.saving.set(true);
    try {
      const receipt = await this.saveReceipt.recordScan(result.value, result.alwaysUseForStore);
      await this.nav.navigateRoot('/receipts', { animationDirection: 'back' });
      await this.feedback.toastWithUndo('Receipt saved', () =>
        this.saveReceipt.undoRecord(receipt),
      );
    } catch (error: unknown) {
      await this.feedback.error(error);
    } finally {
      this.saving.set(false);
    }
  }
}
