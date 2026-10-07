import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CategoriesStore,
  DeleteReceiptsUseCase,
  ExportReceiptsUseCase,
  ImageStore,
  SaveReceiptUseCase,
  SettingsStore,
  type ShareFormat,
} from '@application';
import { type Receipt } from '@domain';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { NavController } from '@ionic/angular/nav-controller';
import { CategoryBadgeComponent } from '../../shared/category-badge.component';
import { formatLongDateTime, formatNumericDate } from '../../shared/dates';
import { FeedbackService } from '../../shared/feedback.service';
import { ImageViewerService } from '../../shared/image-viewer.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { ReceiptImageComponent } from '../../shared/receipt-image.component';
import { receiptResource } from '../receipt-resource';

@Component({
  selector: 'app-receipt-detail',
  templateUrl: './receipt-detail.page.html',
  styleUrl: './receipt-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MoneyPipe,
    ReceiptImageComponent,
    CategoryBadgeComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonContent,
    IonSpinner,
  ],
})
export class ReceiptDetailPage {
  private readonly categories = inject(CategoriesStore);
  private readonly settings = inject(SettingsStore);
  private readonly images = inject(ImageStore);
  private readonly exporter = inject(ExportReceiptsUseCase);
  private readonly deleter = inject(DeleteReceiptsUseCase);
  private readonly saver = inject(SaveReceiptUseCase);
  private readonly feedback = inject(FeedbackService);
  private readonly viewer = inject(ImageViewerService);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly nav = inject(NavController);

  /** Route parameter, bound with withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly receipt = receiptResource(this.id);
  protected readonly category = computed(() => {
    const receipt = this.receipt.value();
    return receipt ? this.categories.categoryOf(receipt.categoryId) : undefined;
  });
  protected readonly when = computed(() => {
    const receipt = this.receipt.value();
    return receipt ? formatLongDateTime(receipt.purchasedAt) : '';
  });
  protected readonly scannedOn = computed(() => {
    const receipt = this.receipt.value();
    return receipt ? formatNumericDate(receipt.createdAt, this.settings.dateFormat()) : '';
  });

  protected async viewImage(receipt: Receipt): Promise<void> {
    await this.viewer.open(await this.images.displayUrl(receipt.imagePath));
  }

  protected async share(receipt: Receipt): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: 'Share receipt',
      subHeader: 'Send it by email, text or any app, for example to get reimbursed.',
      buttons: [
        { text: 'Photo of the receipt (JPG)', icon: 'image-outline', data: 'jpg' },
        { text: 'PDF document', icon: 'document-text-outline', data: 'pdf' },
        { text: 'Spreadsheet (CSV)', icon: 'share-outline', data: 'csv' },
        { text: 'Copy text', icon: 'copy-outline', data: 'txt' },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onWillDismiss<ShareFormat>();
    if (!data) return;
    await this.feedback.busy('Preparing…', () => this.exporter.shareReceipt(receipt, data));
    if (data === 'txt') await this.feedback.toast('Text copied');
  }

  protected async remove(receipt: Receipt): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'Delete this receipt?',
      message: `${receipt.store}. The photo and its data will be removed from this phone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await this.deleter.execute([receipt]);
      await this.nav.navigateBack('/receipts');
      await this.feedback.toast('Receipt deleted');
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }

  protected async markReviewed(receipt: Receipt): Promise<void> {
    try {
      const previous = await this.saver.markReviewed(receipt);
      await this.feedback.toastWithUndo('Receipt marked as reviewed', () =>
        this.saver.restore(previous),
      );
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }
}
