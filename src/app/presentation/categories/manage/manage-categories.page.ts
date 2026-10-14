import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CategoriesStore } from '@application';
import { CATEGORY_COLORS, type Category } from '@domain';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonItemOption } from '@ionic/angular/ion-item-option';
import { IonItemOptions } from '@ionic/angular/ion-item-options';
import { IonItemSliding } from '@ionic/angular/ion-item-sliding';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonReorder } from '@ionic/angular/ion-reorder';
import { IonReorderGroup } from '@ionic/angular/ion-reorder-group';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import type { ReorderEndCustomEvent } from '@ionic/angular';
import { FeedbackService } from '../../shared/feedback.service';
import { CATEGORY_ICON_NAMES } from '../../shared/icons';
import { t, tp } from '../../i18n/i18n';
import { PluralPipe, TranslatePipe } from '../../i18n/translate.pipe';
import { CategoryEditorModalComponent } from '../editor/category-editor.modal';

@Component({
  selector: 'app-manage-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PluralPipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonReorderGroup,
    IonReorder,
  ],
  templateUrl: './manage-categories.page.html',
  styleUrl: './manage-categories.page.scss',
})
export class ManageCategoriesPage {
  protected readonly store = inject(CategoriesStore);
  private readonly modals = inject(ModalController);
  private readonly feedback = inject(FeedbackService);

  protected readonly colors = CATEGORY_COLORS;
  protected readonly icons = CATEGORY_ICON_NAMES;

  protected async edit(category: Category | null): Promise<void> {
    const modal = await this.modals.create({
      component: CategoryEditorModalComponent,
      componentProps: { category },
    });
    await modal.present();
  }

  protected async remove(category: Category): Promise<void> {
    const count = this.store.receiptCounts().get(category.id) ?? 0;
    const confirmed = await this.feedback.confirm({
      header: t('Delete "{name}"?', { name: t(category.name) }),
      message:
        count > 0
          ? tp(
              count,
              'Its {count} receipt moves to "Other".',
              'Its {count} receipts move to "Other".',
            )
          : t('No receipt uses this category.'),
      confirmText: t('Delete'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await this.store.remove(category);
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }

  protected async reorder(event: ReorderEndCustomEvent): Promise<void> {
    const ids = this.store.categories().map((c) => c.id);
    // Ionic reorders the DOM; we apply the same move to our list, then let Angular render it.
    const moved = event.detail.complete(ids) as string[];
    await this.store.reorder(moved);
  }
}
