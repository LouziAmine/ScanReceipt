import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoriesStore } from '@application';
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_NAMES,
  CATEGORY_ICONS,
  type Category,
  type CategoryColor,
  type CategoryIcon,
} from '@domain';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { FeedbackService } from '../../shared/feedback.service';
import { CATEGORY_ICON_NAMES } from '../../shared/icons';

/** Creates a category, or edits one when `category` is given. Dismisses with its id. */
@Component({
  selector: 'app-category-editor-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonFooter,
    IonInput,
    IonIcon,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="close()">Cancel</ion-button>
        </ion-buttons>
        <ion-title>{{ category() ? 'Edit category' : 'New category' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="preview" aria-hidden="true">
        <span class="badge" [style.background]="colors[color()].tint">
          <ion-icon [name]="icons[icon()]" [style.color]="colors[color()].hex" />
          {{ name().trim() || 'Category' }}
        </span>
      </div>

      <ion-input
        label="Name"
        labelPlacement="stacked"
        fill="outline"
        autocapitalize="sentences"
        [maxlength]="30"
        [counter]="true"
        [ngModel]="name()"
        (ngModelChange)="name.set($event ?? '')"
      />

      <h2 class="group-title">Color</h2>
      <div class="swatches" role="radiogroup" aria-label="Color">
        @for (option of colorNames; track option) {
          <button
            type="button"
            role="radio"
            class="swatch"
            [class.on]="option === color()"
            [attr.aria-checked]="option === color()"
            [attr.aria-label]="option"
            [style.background]="colors[option].hex"
            (click)="color.set(option)"
          ></button>
        }
      </div>

      <h2 class="group-title">Icon</h2>
      <div class="icons" role="radiogroup" aria-label="Icon">
        @for (option of iconNames; track option) {
          <button
            type="button"
            role="radio"
            class="icon-option"
            [class.on]="option === icon()"
            [attr.aria-checked]="option === icon()"
            [attr.aria-label]="option"
            (click)="icon.set(option)"
          >
            <ion-icon [name]="icons[option]" aria-hidden="true" />
          </button>
        }
      </div>
    </ion-content>
    <ion-footer class="ion-no-border">
      <ion-toolbar class="ion-padding-horizontal">
        <ion-button expand="block" [disabled]="!canSave()" (click)="save()">
          {{ category() ? 'Save changes' : 'Create category' }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    .preview {
      display: flex;
      justify-content: center;
      padding: 12px 0 24px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 0 16px;
      border-radius: 12px;
      font-weight: 500;
      color: #16181a;
    }
    .group-title {
      margin: 24px 0 10px;
      font-size: 15px;
      font-weight: 700;
    }
    .swatches,
    .icons {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .swatch {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 3px solid transparent;
      &.on {
        border-color: var(--app-text);
      }
    }
    .icon-option {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      border: 1px solid var(--app-border);
      background: var(--app-surface);
      color: var(--app-text);
      font-size: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      &.on {
        border: 2px solid var(--ion-color-primary);
        background: var(--app-chip-on-bg);
      }
    }
  `,
})
export class CategoryEditorModalComponent implements OnInit {
  private readonly modal = inject(ModalController);
  private readonly store = inject(CategoriesStore);
  private readonly feedback = inject(FeedbackService);

  readonly category = input<Category | null>(null);
  readonly initialName = input('');

  protected readonly colors = CATEGORY_COLORS;
  protected readonly colorNames = CATEGORY_COLOR_NAMES;
  protected readonly iconNames = CATEGORY_ICONS;
  protected readonly icons = CATEGORY_ICON_NAMES;
  protected readonly name = signal('');
  protected readonly color = signal<CategoryColor>('teal');
  protected readonly icon = signal<CategoryIcon>('pricetag');
  protected readonly canSave = computed(() => this.name().trim().length > 0);

  ngOnInit(): void {
    const category = this.category();
    this.name.set(category?.name ?? this.initialName());
    this.color.set(category?.color ?? 'teal');
    this.icon.set(category?.icon ?? 'pricetag');
  }

  protected close(): Promise<boolean> {
    return this.modal.dismiss(null, 'cancel');
  }

  protected async save(): Promise<void> {
    const input = { name: this.name(), color: this.color(), icon: this.icon() };
    try {
      const existing = this.category();
      const saved = existing
        ? await this.store.edit(existing, input)
        : await this.store.create(input);
      await this.modal.dismiss(saved.id, 'saved');
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }
}
