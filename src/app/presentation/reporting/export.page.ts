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
import { AmountsPipe } from '../shared/amounts';
import { marker, t } from '../i18n/i18n';
import { PluralPipe, TranslatePipe } from '../i18n/translate.pipe';

type RangeChoice = Extract<DatePreset, 'this_month' | 'this_year' | 'last_year'> | 'all';

const RANGES: readonly { value: RangeChoice; label: string }[] = [
  { value: 'this_month', label: marker('This month') },
  { value: 'this_year', label: marker('This year') },
  { value: 'last_year', label: marker('Last year') },
  { value: 'all', label: marker('All') },
];

const FORMATS: readonly { value: ExportFormat; tag: string; title: string; description: string }[] =
  [
    {
      value: 'csv',
      tag: 'CSV',
      title: marker('Spreadsheet (CSV)'),
      description: marker('Opens in Excel or Google Sheets'),
    },
    {
      value: 'pdf',
      tag: 'PDF',
      title: marker('PDF report'),
      description: marker('Summary by category, then each receipt'),
    },
    {
      value: 'zip',
      tag: 'ZIP',
      title: marker('Photos only (ZIP)'),
      description: marker('All receipt images in one folder'),
    },
  ];

@Component({
  selector: 'app-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PluralPipe,
    AmountsPipe,
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
  templateUrl: './export.page.html',
  styleUrl: './export.page.scss',
})
export class ExportPage {
  private readonly exporter = inject(ExportReceiptsUseCase);
  private readonly feedback = inject(FeedbackService);
  private readonly settings = inject(SettingsStore);
  protected readonly currency = this.settings.currency;

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
    await this.feedback.busy(t('Preparing the file…'), () =>
      this.exporter.export({
        range: this.dateRange(),
        format: this.format(),
        includePhotos: this.format() !== 'zip' && this.includePhotos(),
      }),
    );
  }
}
