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
import { CATEGORY_ICON_NAMES } from '../../shared/icons';
import { CategoryEditorModalComponent } from '../editor/category-editor.modal';

@Component({
  selector: 'app-category-picker-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="close()">Cancel</ion-button>
        </ion-buttons>
        <ion-title>Choose category</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          placeholder="Search or type a new category"
          [value]="query()"
          (ionInput)="query.set($event.detail.value ?? '')"
        />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list lines="full">
        @for (category of visible(); track category.id) {
          <ion-item [button]="true" [detail]="false" (click)="select(category.id)">
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
              @if (category.isCustom) {
                <p>Custom</p>
              }
            </ion-label>
            @if (category.id === selectedId()) {
              <ion-icon slot="end" name="checkmark-outline" color="primary" aria-label="Selected" />
            }
          </ion-item>
        }
      </ion-list>
      <div class="ion-padding">
        <ion-button expand="block" fill="outline" (click)="create()">
          <ion-icon slot="start" name="add-outline" />
          @if (canCreateFromQuery()) {
            Create "{{ query().trim() }}"
          } @else {
            Create new category
          }
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: `
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
export class CategoryPickerModalComponent {
  private readonly modal = inject(ModalController);
  private readonly store = inject(CategoriesStore);

  readonly selectedId = input('');
  readonly storeName = input('');

  protected readonly colors = CATEGORY_COLORS;
  protected readonly icons = CATEGORY_ICON_NAMES;
  protected readonly query = signal('');
  protected readonly visible = computed(() => {
    const key = normalizeKey(this.query());
    return this.store.categories().filter((c) => !key || normalizeKey(c.name).includes(key));
  });
  protected readonly canCreateFromQuery = computed(() => {
    const key = normalizeKey(this.query());
    return key.length > 0 && !this.store.categories().some((c) => normalizeKey(c.name) === key);
  });

  protected select(id: string): Promise<boolean> {
    return this.modal.dismiss(id, 'select');
  }

  protected close(): Promise<boolean> {
    return this.modal.dismiss(null, 'cancel');
  }

  protected async create(): Promise<void> {
    const editor = await this.modal.create({
      component: CategoryEditorModalComponent,
      componentProps: { initialName: this.canCreateFromQuery() ? this.query().trim() : '' },
    });
    await editor.present();
    const { data, role } = await editor.onWillDismiss<string>();
    if (role === 'saved' && data) {
      await this.select(data);
    }
  }
}
