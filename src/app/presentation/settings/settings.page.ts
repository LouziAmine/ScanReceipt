import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriesStore, ReceiptsStore, SettingsStore } from '@application';
import {
  type CurrencyCode,
  type DateFormat,
  type ImageQuality,
  SUPPORTED_CURRENCIES,
  type UserSettings,
  type WeekStart,
} from '@domain';
import { environment } from '@env/environment';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonListHeader } from '@ionic/angular/ion-list-header';
import { IonNote } from '@ionic/angular/ion-note';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { FeedbackService } from '../shared/feedback.service';

const DATE_FORMATS: readonly DateFormat[] = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/receipts" text="" />
        </ion-buttons>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @let s = store.settings();
      <ion-list [inset]="true">
        <ion-list-header>General</ion-list-header>
        <ion-item>
          <ion-select
            label="Currency"
            interface="action-sheet"
            [value]="s.currency"
            (ionChange)="set('currency', $event.detail.value)"
          >
            @for (code of currencies; track code) {
              <ion-select-option [value]="code">{{ code }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            label="Date format"
            interface="action-sheet"
            [value]="s.dateFormat"
            (ionChange)="set('dateFormat', $event.detail.value)"
          >
            @for (format of dateFormats; track format) {
              <ion-select-option [value]="format">{{ format }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            label="Week starts on"
            interface="action-sheet"
            [value]="s.weekStartsOn"
            (ionChange)="set('weekStartsOn', $event.detail.value)"
          >
            <ion-select-option [value]="0">Sunday</ion-select-option>
            <ion-select-option [value]="1">Monday</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            label="Default category"
            interface="action-sheet"
            [value]="s.defaultCategoryId"
            (ionChange)="set('defaultCategoryId', $event.detail.value)"
          >
            @for (category of categories.categories(); track category.id) {
              <ion-select-option [value]="category.id">{{ category.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
      </ion-list>

      <ion-list [inset]="true">
        <ion-list-header>Scanning</ion-list-header>
        <ion-item>
          <ion-select
            label="Image quality"
            interface="action-sheet"
            [value]="s.imageQuality"
            (ionChange)="set('imageQuality', $event.detail.value)"
          >
            <ion-select-option value="high">High</ion-select-option>
            <ion-select-option value="standard">Standard (smaller files)</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-toggle
            [checked]="s.warnOnLowConfidence"
            (ionChange)="set('warnOnLowConfidence', $event.detail.checked)"
          >
            <ion-label>
              Warn on low confidence
              <p>Highlights amounts to double-check</p>
            </ion-label>
          </ion-toggle>
        </ion-item>
      </ion-list>

      <ion-list [inset]="true">
        <ion-list-header>Data</ion-list-header>
        <ion-item [button]="true" routerLink="/backup">
          <ion-label>Backup & restore</ion-label>
        </ion-item>
        <ion-item [button]="true" routerLink="/categories">
          <ion-label>Manage categories</ion-label>
        </ion-item>
      </ion-list>

      <ion-list [inset]="true">
        <ion-list-header>About</ion-list-header>
        <ion-item>
          <ion-label>Version</ion-label>
          <ion-note slot="end">{{ version }}</ion-note>
        </ion-item>
        <ion-item [href]="privacyPolicyUrl" target="_blank" rel="noopener" [detail]="true">
          <ion-label>Privacy policy</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
})
export class SettingsPage {
  protected readonly store = inject(SettingsStore);
  protected readonly categories = inject(CategoriesStore);
  private readonly receipts = inject(ReceiptsStore);
  private readonly feedback = inject(FeedbackService);

  protected readonly currencies: readonly CurrencyCode[] = SUPPORTED_CURRENCIES;
  protected readonly dateFormats = DATE_FORMATS;
  protected readonly version = environment.appVersion;
  protected readonly privacyPolicyUrl = environment.privacyPolicyUrl;

  protected async set(key: keyof UserSettings, value: unknown): Promise<void> {
    if (!this.isValid(key, value)) return;
    try {
      await this.store.update({ [key]: value });
      // Totals are shown in the chosen currency: recompute them.
      if (key === 'currency') await this.receipts.refresh();
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }

  /** ion-select hands back `any`: check it before it reaches the store. */
  private isValid(key: keyof UserSettings, value: unknown): boolean {
    switch (key) {
      case 'currency':
        return SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
      case 'dateFormat':
        return DATE_FORMATS.includes(value as DateFormat);
      case 'weekStartsOn':
        return value === (0 satisfies WeekStart) || value === (1 satisfies WeekStart);
      case 'imageQuality':
        return (
          value === ('high' satisfies ImageQuality) || value === ('standard' satisfies ImageQuality)
        );
      case 'defaultCategoryId':
        return typeof value === 'string' && this.categories.byId().has(value);
      case 'warnOnLowConfidence':
        return typeof value === 'boolean';
      default:
        return false;
    }
  }
}
