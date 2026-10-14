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
import { t } from '../../i18n/i18n';
import { TranslatePipe } from '../../i18n/translate.pipe';

/** Creates a category, or edits one when `category` is given. Dismisses with its id. */
@Component({
  selector: 'app-category-editor-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
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
  templateUrl: './category-editor.modal.html',
  styleUrl: './category-editor.modal.scss',
})
export class CategoryEditorModalComponent implements OnInit {
  private readonly modals = inject(ModalController);
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
    // A built-in category shows its translated name.
    this.name.set(category ? t(category.name) : this.initialName());
    this.color.set(category?.color ?? 'teal');
    this.icon.set(category?.icon ?? 'pricetag');
  }

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected async save(): Promise<void> {
    const existing = this.category();
    // An untouched translated name keeps the built-in name, so it follows the language.
    const name = existing && this.name().trim() === t(existing.name) ? existing.name : this.name();
    const input = { name, color: this.color(), icon: this.icon() };
    try {
      const saved = existing
        ? await this.store.edit(existing, input)
        : await this.store.create(input);
      await this.modals.dismiss(saved.id, 'saved');
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }
}
