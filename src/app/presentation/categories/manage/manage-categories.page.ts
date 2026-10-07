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
import { PluralPipe } from '../../shared/plural.pipe';
import { CategoryEditorModalComponent } from '../editor/category-editor.modal';

@Component({
  selector: 'app-manage-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/receipts" text="" />
        </ion-buttons>
        <ion-title>Categories</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="edit(null)" aria-label="New category">
            <ion-icon slot="icon-only" name="add-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <p class="hint">Tap to edit. Drag the handle to reorder. Swipe left to delete.</p>
      <ion-list lines="full">
        <ion-reorder-group [disabled]="false" (ionReorderEnd)="reorder($event)">
          @for (category of store.categories(); track category.id) {
            <ion-item-sliding [disabled]="category.isFallback">
              <ion-item [button]="true" [detail]="false" (click)="edit(category)">
                <span
                  slot="start"
                  class="icon"
                  [style.background]="colors[category.color].tint"
                  [style.color]="colors[category.color].hex"
                >
                  <ion-icon [name]="icons[category.icon]" aria-hidden="true" />
                </span>
                <ion-label>
                  {{ category.name }}
                  <p>
                    {{ store.receiptCounts().get(category.id) ?? 0 | plural: 'receipt' }}
                    @if (category.isCustom) {
                      · Custom
                    }
                  </p>
                </ion-label>
                <ion-reorder slot="end" />
              </ion-item>
              <ion-item-options side="end">
                <ion-item-option color="danger" (click)="remove(category)">Delete</ion-item-option>
              </ion-item-options>
            </ion-item-sliding>
          }
        </ion-reorder-group>
      </ion-list>
      <p class="hint">
        Deleting a category moves its receipts to "Other". No receipt is ever lost.
      </p>
    </ion-content>
  `,
  styles: `
    .hint {
      margin: 12px 20px;
      font-size: 13px;
      color: var(--app-text-muted);
    }
    .icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
  `,
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
      header: `Delete "${category.name}"?`,
      message:
        count > 0
          ? `Its ${count} ${count === 1 ? 'receipt moves' : 'receipts move'} to "Other".`
          : 'No receipt uses this category.',
      confirmText: 'Delete',
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
