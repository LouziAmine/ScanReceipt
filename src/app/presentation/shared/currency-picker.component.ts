import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ReceiptsStore, SettingsStore } from '@application';
import { type CurrencyCode, SUPPORTED_CURRENCIES, normalizeKey } from '@domain';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonListHeader } from '@ionic/angular/ion-list-header';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { locale } from '../i18n/i18n';
import { TranslatePipe } from '../i18n/translate.pipe';
import { currencyName, currencySymbol } from './currency';

interface CurrencyOption {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly symbol: string;
  /** Code and English name, normalized for search. */
  readonly key: string;
  /** The name in the language of the screens, lower case, for search (Arabic, Chinese…). */
  readonly local: string;
}

const englishNames = new Intl.DisplayNames('en', { type: 'currency', fallback: 'code' });
const optionsByLocale = new Map<string, readonly CurrencyOption[]>();

/** Every currency named in the language of the screens, searchable in English too. */
function currencyOptions(): readonly CurrencyOption[] {
  let options = optionsByLocale.get(locale());
  if (!options) {
    options = SUPPORTED_CURRENCIES.map((code) => {
      const name = currencyName(code);
      const english = englishNames.of(code) ?? code;
      return {
        code,
        name,
        symbol: currencySymbol(code),
        key: normalizeKey(`${code} ${english}`),
        local: name.toLocaleLowerCase(locale()),
      };
    }).sort((a, b) => a.name.localeCompare(b.name, locale()));
    optionsByLocale.set(locale(), options);
  }
  return options;
}

@Component({
  selector: 'app-currency-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    NgTemplateOutlet,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSearchbar,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonIcon,
  ],
  templateUrl: './currency-picker.component.html',
  styleUrl: './currency-picker.component.scss',
})
/** Searchable list of every currency; opened by `CurrencyPickerService`. */
export class CurrencyPickerComponent {
  private readonly modals = inject(ModalController);
  private readonly settings = inject(SettingsStore);
  private readonly receipts = inject(ReceiptsStore);

  readonly selected = input<CurrencyCode | null>(null);

  protected readonly query = signal('');
  private readonly used = resource({ loader: () => this.receipts.usedCurrencies() });

  private readonly matching = computed(() => {
    const query = this.query().trim();
    const key = normalizeKey(query);
    const local = query.toLocaleLowerCase(locale());
    return currencyOptions().filter(
      (option) => !query || (key && option.key.includes(key)) || option.local.includes(local),
    );
  });

  /** The chosen currency, the one from Settings, then those already used. */
  private readonly suggestedCodes = computed(() => {
    const selected = this.selected();
    const codes = [
      ...(selected === null ? [] : [selected]),
      this.settings.currency(),
      ...(this.used.value() ?? []),
    ];
    return new Set([...new Set(codes)].slice(0, 6));
  });

  protected readonly suggested = computed(() => {
    const codes = this.suggestedCodes();
    return [...codes].flatMap((code) => this.matching().filter((o) => o.code === code));
  });

  protected readonly others = computed(() =>
    this.matching().filter((option) => !this.suggestedCodes().has(option.code)),
  );

  protected select(code: CurrencyCode): Promise<boolean> {
    return this.modals.dismiss(code, 'select');
  }

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }
}
