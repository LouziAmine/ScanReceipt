import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { ExportReceiptsUseCase, type ExportFormat, SettingsStore } from '@application';
import { type DatePreset, type DateRange, presetRange } from '@domain';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonRadio } from '@ionic/angular/ion-radio';
import { IonRadioGroup } from '@ionic/angular/ion-radio-group';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { FeedbackService } from '../shared/feedback.service';
import { MoneyPipe } from '../shared/money.pipe';
import { PluralPipe } from '../shared/plural.pipe';

type RangeChoice = Extract<DatePreset, 'this_month' | 'this_year' | 'last_year'> | 'all';

const RANGES: readonly { value: RangeChoice; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
  { value: 'all', label: 'All' },
];

const FORMATS: readonly { value: ExportFormat; tag: string; title: string; description: string }[] =
  [
    {
      value: 'csv',
      tag: 'CSV',
      title: 'Spreadsheet (CSV)',
      description: 'Opens in Excel or Google Sheets',
    },
    {
      value: 'pdf',
      tag: 'PDF',
      title: 'PDF report',
      description: 'Summary by category, then each receipt',
    },
    {
      value: 'zip',
      tag: 'ZIP',
      title: 'Photos only (ZIP)',
      description: 'All receipt images in one folder',
    },
  ];

@Component({
  selector: 'app-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PluralPipe,
    MoneyPipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonFooter,
    IonList,
    IonItem,
    IonLabel,
    IonRadioGroup,
    IonRadio,
    IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/receipts" text="" />
        </ion-buttons>
        <ion-title>Export receipts</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h2 class="group-title">Which receipts</h2>
      <div class="chips" role="radiogroup" aria-label="Which receipts">
        @for (option of ranges; track option.value) {
          <button
            type="button"
            role="radio"
            class="chip"
            [class.on]="range() === option.value"
            [attr.aria-checked]="range() === option.value"
            (click)="range.set(option.value)"
          >
            {{ option.label }}
          </button>
        }
      </div>

      <h2 class="group-title">Format</h2>
      <ion-list lines="none">
        <ion-radio-group [value]="format()" (ionChange)="format.set($event.detail.value)">
          @for (option of formats; track option.value) {
            <ion-item class="format" [class.on]="format() === option.value">
              <span slot="start" class="tag">{{ option.tag }}</span>
              <ion-radio [value]="option.value" justify="space-between">
                <ion-label>
                  {{ option.title }}
                  <p>{{ option.description }}</p>
                </ion-label>
              </ion-radio>
            </ion-item>
          }
        </ion-radio-group>
      </ion-list>

      @if (format() !== 'zip') {
        <ion-list lines="none">
          <ion-item>
            <ion-toggle
              [checked]="includePhotos()"
              (ionChange)="includePhotos.set($event.detail.checked)"
            >
              <ion-label>
                Include receipt photos
                <p>Bigger file, but ready for an audit</p>
              </ion-label>
            </ion-toggle>
          </ion-item>
        </ion-list>
      }
    </ion-content>
    <ion-footer class="ion-no-border">
      <ion-toolbar class="ion-padding-horizontal">
        @if (preview.value(); as totals) {
          <p class="summary">
            {{ totals.count | plural: 'receipt' }} ·
            {{ totals.totalCents | money: currency() }} total
            @if (totals.otherCurrencyCount > 0) {
              · {{ totals.otherCurrencyCount }} in other currencies
            }
          </p>
        }
        <ion-button expand="block" [disabled]="(preview.value()?.count ?? 0) === 0" (click)="run()">
          Export {{ preview.value()?.count ?? 0 | plural: 'receipt' }}
        </ion-button>
        <p class="note">The file opens in your phone's share menu (email, Drive, Files…)</p>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    .group-title {
      margin: 20px 0 10px;
      font-size: 15px;
      font-weight: 700;
    }
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .chip {
      height: 36px;
      padding: 0 14px;
      border-radius: var(--app-radius-sm);
      border: 1px solid var(--app-border-strong);
      background: transparent;
      color: var(--app-text);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      &.on {
        border-color: transparent;
        background: var(--app-chip-on-bg);
        color: var(--app-chip-on-fg);
      }
    }
    .format {
      --background: var(--app-surface);
      --border-radius: 14px;
      margin-bottom: 8px;
      border: 1px solid var(--app-border);
      border-radius: 14px;
      &.on {
        border: 2px solid var(--ion-color-primary);
      }
    }
    .tag {
      font-size: 12px;
      font-weight: 700;
      padding: 6px 8px;
      border-radius: 8px;
      background: var(--app-surface-muted);
    }
    ion-item {
      --background: transparent;
    }
    .summary,
    .note {
      text-align: center;
      font-size: 13px;
      color: var(--app-text-muted);
      margin: 6px 0;
    }
  `,
})
export class ExportPage {
  private readonly exporter = inject(ExportReceiptsUseCase);
  private readonly feedback = inject(FeedbackService);
  protected readonly currency = inject(SettingsStore).currency;

  protected readonly ranges = RANGES;
  protected readonly formats = FORMATS;
  protected readonly range = signal<RangeChoice>('this_month');
  protected readonly format = signal<ExportFormat>('csv');
  protected readonly includePhotos = signal(false);

  private readonly dateRange = computed<DateRange | null>(() => {
    const choice = this.range();
    return choice === 'all' ? null : presetRange(choice, new Date());
  });

  protected readonly preview = resource({
    params: () => ({ range: this.dateRange(), currency: this.currency() }),
    loader: ({ params }) => this.exporter.preview(params.range),
  });

  protected async run(): Promise<void> {
    await this.feedback.busy('Preparing the file…', () =>
      this.exporter.export({
        range: this.dateRange(),
        format: this.format(),
        includePhotos: this.format() !== 'zip' && this.includePhotos(),
      }),
    );
  }
}
