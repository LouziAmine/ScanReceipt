import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CATEGORY_COLORS, type Category } from '@domain';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '../i18n/translate.pipe';
import { CATEGORY_ICON_NAMES } from './icons';

/** The colored chip of a category: icon + name on its tint. */
@Component({
  selector: 'app-category-badge',
  imports: [IonIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-badge.component.html',
  host: {
    '[style.--badge-bg]': 'colors().tint',
    '[style.--badge-fg]': 'colors().hex',
  },
  styleUrl: './category-badge.component.scss',
})
export class CategoryBadgeComponent {
  readonly category = input.required<Category>();

  protected readonly colors = computed(() => CATEGORY_COLORS[this.category().color]);
  protected readonly icon = computed(() => CATEGORY_ICON_NAMES[this.category().icon]);
}
