import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CATEGORY_COLORS, type Category } from '@domain';
import { IonIcon } from '@ionic/angular/ion-icon';
import { CATEGORY_ICON_NAMES } from './icons';

/** The colored chip of a category: icon + name on its tint. */
@Component({
  selector: 'app-category-badge',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-icon [name]="icon()" aria-hidden="true" />
    <span>{{ category().name }}</span>
  `,
  host: {
    '[style.--badge-bg]': 'colors().tint',
    '[style.--badge-fg]': 'colors().hex',
  },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border-radius: 10px;
      background: var(--badge-bg);
      color: #16181a;
      font-size: 14px;
      font-weight: 500;
    }
    ion-icon {
      color: var(--badge-fg);
      font-size: 16px;
    }
  `,
})
export class CategoryBadgeComponent {
  readonly category = input.required<Category>();

  protected readonly colors = computed(() => CATEGORY_COLORS[this.category().color]);
  protected readonly icon = computed(() => CATEGORY_ICON_NAMES[this.category().icon]);
}
