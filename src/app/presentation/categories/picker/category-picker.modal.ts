import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CategoriesStore } from '@application';
import { CATEGORY_COLORS, normalizeKey } from '@domain';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { t } from '../../i18n/i18n';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CATEGORY_ICON_NAMES } from '../../shared/icons';
import { CategoryEditorModalComponent } from '../editor/category-editor.modal';

@Component({
  selector: 'app-category-picker-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
  ],
  templateUrl: './category-picker.modal.html',
  styleUrl: './category-picker.modal.scss',
})
export class CategoryPickerModalComponent {
  private readonly modals = inject(ModalController);
  private readonly store = inject(CategoriesStore);

  readonly selectedId = input('');
  readonly storeName = input('');

  protected readonly colors = CATEGORY_COLORS;
  protected readonly icons = CATEGORY_ICON_NAMES;
  protected readonly query = signal('');
  protected readonly visible = computed(() => {
    const key = normalizeKey(this.query());
    // Built-in categories match on their translated name too.
    return this.store
      .categories()
      .filter(
        (c) => !key || normalizeKey(c.name).includes(key) || normalizeKey(t(c.name)).includes(key),
      );
  });
  protected readonly canCreateFromQuery = computed(() => {
    const key = normalizeKey(this.query());
    return (
      key.length > 0 &&
      !this.store
        .categories()
        .some((c) => normalizeKey(c.name) === key || normalizeKey(t(c.name)) === key)
    );
  });

  protected select(id: string): Promise<boolean> {
    return this.modals.dismiss(id, 'select');
  }

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected async create(): Promise<void> {
    const editor = await this.modals.create({
      component: CategoryEditorModalComponent,
      componentProps: { initialName: this.canCreateFromQuery() ? this.query().trim() : '' },
    });
    await editor.present();
    const { data, role } = await editor.onDidDismiss<string>();
    if (role === 'saved' && data) {
      await this.select(data);
    }
  }
}
