import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CategoriesStore,
  type ReceiptFormValue,
  SettingsStore,
  type UserMessage,
} from '@application';
import { type CurrencyCode, type ReviewableField, parseAmount } from '@domain';
import { IonButton } from '@ionic/angular/ion-button';
import { IonDatetime } from '@ionic/angular/ion-datetime';
import { IonDatetimeButton } from '@ionic/angular/ion-datetime-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonModal } from '@ionic/angular/ion-modal';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { ModalController } from '@ionic/angular/modal-controller';
import { CategoryBadgeComponent } from '../../shared/category-badge.component';
import { locale } from '../../i18n/i18n';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { currencyName, currencySymbol } from '../../shared/currency';
import { CurrencyPickerService } from '../../shared/currency-picker.service';
import { fromLocalIso, toLocalIso } from '../../shared/dates';
import { CategoryPickerModalComponent } from '../../categories/picker/category-picker.modal';

export interface ReceiptFormInitial {
  readonly store: string;
  readonly purchasedAt: Date;
  readonly totalCents: number | null;
  readonly taxCents: number | null;
  readonly currency: CurrencyCode;
  readonly categoryId: string;
  readonly note: string;
  readonly doubtfulFields: readonly ReviewableField[];
  /** Why each doubtful field is doubtful, from the OCR reading. */
  readonly hints?: Partial<Record<ReviewableField, string>>;
  /** Why the currency read from the receipt is a guess (English, with its placeholder values). */
  readonly currencyHint?: UserMessage;
}

let nextId = 0;

const AMOUNT = /^\s*[$€£]?\s*\d{1,3}([.,\s]?\d{3})*([.,]\d{1,2})?\s*$/;

/** The receipt fields with their review state. Used after a scan, to edit, and to review. */
@Component({
  selector: 'app-receipt-form',
  templateUrl: './receipt-form.component.html',
  styleUrl: './receipt-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    CategoryBadgeComponent,
    IonInput,
    IonTextarea,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonButton,
    IonIcon,
    IonToggle,
  ],
})
export class ReceiptFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly modals = inject(ModalController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly categories = inject(CategoriesStore);
  private readonly currencyPicker = inject(CurrencyPickerService);

  readonly initial = input.required<ReceiptFormInitial>();
  /** Offers "Always use this category for <store>" (new scans only). */
  readonly offerStoreRule = input(false);

  protected readonly form = this.fb.group({
    store: ['', [Validators.required, Validators.maxLength(80)]],
    purchasedAt: [toLocalIso(new Date()), Validators.required],
    total: ['', [Validators.required, Validators.pattern(AMOUNT)]],
    tax: ['', Validators.pattern(AMOUNT)],
    note: ['', Validators.maxLength(500)],
  });

  protected readonly currency = signal<CurrencyCode>('USD');
  protected readonly currencySymbol = computed(() => currencySymbol(this.currency()));
  protected readonly currencyName = computed(() => currencyName(this.currency()));
  /** The hint on a guessed currency, until the person picks or confirms one. */
  protected readonly currencyHint = signal<UserMessage | null>(null);
  /** Receipts are saved in this currency: one in another currency is converted on save. */
  protected readonly personCurrency = inject(SettingsStore).currency;
  protected readonly categoryId = signal('');
  protected readonly doubtful = signal<ReadonlySet<ReviewableField>>(new Set());
  protected readonly alwaysUseForStore = signal(false);
  protected readonly category = computed(() => this.categories.categoryOf(this.categoryId()));
  protected readonly hints = computed(() => this.initial().hints ?? {});
  readonly doubtfulCount = computed(() => this.doubtful().size);
  protected readonly maxDate = toLocalIso(new Date());
  protected readonly locale = locale;
  /** Ionic keeps previous pages in the DOM: each form needs its own datetime id. */
  protected readonly datetimeId = `receipt-date-${++nextId}`;

  ngOnInit(): void {
    const initial = this.initial();
    this.form.setValue({
      store: initial.store,
      purchasedAt: toLocalIso(initial.purchasedAt),
      total: initial.totalCents === null ? '' : (initial.totalCents / 100).toFixed(2),
      tax: initial.taxCents === null ? '' : (initial.taxCents / 100).toFixed(2),
      note: initial.note,
    });
    this.currency.set(initial.currency);
    this.currencyHint.set(initial.currencyHint ?? null);
    this.categoryId.set(initial.categoryId);
    this.doubtful.set(new Set(initial.doubtfulFields));

    // Correcting a doubtful field by hand confirms it.
    const confirmOnEdit = (
      control: 'store' | 'purchasedAt' | 'total' | 'tax',
      field: ReviewableField,
    ): void => {
      this.form.controls[control].valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.confirm(field);
        });
    };
    confirmOnEdit('store', 'store');
    confirmOnEdit('purchasedAt', 'date');
    confirmOnEdit('total', 'total');
    confirmOnEdit('tax', 'tax');
  }

  protected isDoubtful(field: ReviewableField): boolean {
    return this.doubtful().has(field);
  }

  protected confirm(field: ReviewableField): void {
    if (!this.doubtful().has(field)) return;
    this.doubtful.update((set) => {
      const next = new Set(set);
      next.delete(field);
      return next;
    });
  }

  protected async chooseCurrency(): Promise<void> {
    const code = await this.currencyPicker.choose(this.currency());
    if (code) {
      this.currency.set(code);
      this.currencyHint.set(null);
    }
  }

  protected async chooseCategory(): Promise<void> {
    const modal = await this.modals.create({
      component: CategoryPickerModalComponent,
      componentProps: { selectedId: this.categoryId(), storeName: this.form.controls.store.value },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<string>();
    if (role === 'select' && data) {
      this.categoryId.set(data);
    }
  }

  protected onDateChange(value: string | string[] | null | undefined): void {
    if (typeof value === 'string') {
      this.form.controls.purchasedAt.setValue(value.slice(0, 16));
    }
  }

  /** The values to save, or null after showing what is wrong. */
  value(): { value: ReceiptFormValue; alwaysUseForStore: boolean } | null {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return null;
    }
    const raw = this.form.getRawValue();
    const totalCents = parseAmount(raw.total);
    if (totalCents === null) {
      return null;
    }
    return {
      value: {
        store: raw.store,
        purchasedAt: fromLocalIso(raw.purchasedAt),
        totalCents,
        taxCents: raw.tax.trim() ? parseAmount(raw.tax) : null,
        currency: this.currency(),
        categoryId: this.categoryId(),
        note: raw.note,
        doubtfulFields: [...this.doubtful()],
      },
      alwaysUseForStore: this.alwaysUseForStore(),
    };
  }

  /** Applies a new OCR reading (after "Re-run OCR") without touching the category or note. */
  patchFromReading(
    patch: Pick<
      ReceiptFormInitial,
      'store' | 'purchasedAt' | 'totalCents' | 'taxCents' | 'currency' | 'doubtfulFields'
    > &
      Pick<ReceiptFormInitial, 'currencyHint'>,
  ): void {
    this.currency.set(patch.currency);
    this.currencyHint.set(patch.currencyHint ?? null);
    this.form.patchValue({
      store: patch.store,
      purchasedAt: toLocalIso(patch.purchasedAt),
      total: patch.totalCents === null ? '' : (patch.totalCents / 100).toFixed(2),
      tax: patch.taxCents === null ? '' : (patch.taxCents / 100).toFixed(2),
    });
    this.doubtful.set(new Set(patch.doubtfulFields));
  }
}
