import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackupUseCase, CategoriesStore, ReceiptsStore, SettingsStore } from '@application';
import {
  type CurrencyCode,
  LANGUAGES,
  isCurrencyCode,
  isLanguage,
  type DateFormat,
  type ImageQuality,
  THEMES,
  type Theme,
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
import { LANGUAGE_NAMES, useLanguage } from '../i18n/i18n';
import { backupReminderText } from '../backup/reminder-text';
import { TranslatePipe } from '../i18n/translate.pipe';
import { currencyName } from '../shared/currency';
import { CurrencyPickerService } from '../shared/currency-picker.service';
import { FeedbackService } from '../shared/feedback.service';

const DATE_FORMATS: readonly DateFormat[] = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
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
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  protected readonly store = inject(SettingsStore);
  protected readonly categories = inject(CategoriesStore);
  private readonly receipts = inject(ReceiptsStore);
  private readonly feedback = inject(FeedbackService);
  private readonly backups = inject(BackupUseCase);

  private readonly currencyPicker = inject(CurrencyPickerService);

  protected readonly currencyName = currencyName;
  protected readonly languages = LANGUAGES;
  protected readonly languageNames = LANGUAGE_NAMES;
  protected readonly dateFormats = DATE_FORMATS;
  protected readonly version = environment.appVersion;
  protected readonly privacyPolicyUrl = environment.privacyPolicyUrl;

  protected async chooseCurrency(current: CurrencyCode): Promise<void> {
    const code = await this.currencyPicker.choose(current);
    if (code && code !== current) await this.set('currency', code);
  }

  protected async set(key: keyof UserSettings, value: unknown): Promise<void> {
    if (!this.isValid(key, value)) return;
    try {
      await this.store.update({ [key]: value });
      // Totals are shown in the chosen currency: recompute them.
      if (key === 'currency') await this.receipts.refresh();
      // The scheduled reminder keeps its text: write it again in the new language.
      if (key === 'language' && this.store.settings().backupReminder) {
        await useLanguage(this.store.settings().language);
        await this.backups.setReminder(true, backupReminderText());
      }
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }

  /** ion-select hands back `any`: check it before it reaches the store. */
  private isValid(key: keyof UserSettings, value: unknown): boolean {
    switch (key) {
      case 'currency':
        return isCurrencyCode(value);
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
      case 'theme':
        return THEMES.includes(value as Theme);
      case 'language':
        return isLanguage(value);
      case 'warnOnLowConfidence':
        return typeof value === 'boolean';
      default:
        return false;
    }
  }
}
