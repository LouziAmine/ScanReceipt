import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  CategoriesStore,
  DeleteReceiptsUseCase,
  ExportReceiptsUseCase,
  ReceiptsStore,
} from '@application';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonCheckbox } from '@ionic/angular/ion-checkbox';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonItem } from '@ionic/angular/ion-item';
import { IonList } from '@ionic/angular/ion-list';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { NavController } from '@ionic/angular/nav-controller';
import type { InfiniteScrollCustomEvent } from '@ionic/angular';
import { t, tp } from '../../i18n/i18n';
import { PluralPipe, TranslatePipe } from '../../i18n/translate.pipe';
import { FeedbackService } from '../../shared/feedback.service';
import { ReceiptRowComponent } from '../../shared/receipt-row.component';

@Component({
  selector: 'app-select-receipts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PluralPipe,
    ReceiptRowComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
    IonCheckbox,
    IonFooter,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
  templateUrl: './select-receipts.page.html',
  styleUrl: './select-receipts.page.scss',
})
export class SelectReceiptsPage implements OnInit {
  protected readonly store = inject(ReceiptsStore);
  protected readonly categories = inject(CategoriesStore);
  private readonly exporter = inject(ExportReceiptsUseCase);
  private readonly deleter = inject(DeleteReceiptsUseCase);
  private readonly feedback = inject(FeedbackService);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly nav = inject(NavController);

  /** Query parameter: the receipt that was long-pressed. */
  readonly preselect = input<string>();

  protected readonly now = new Date();
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly count = computed(() => this.selected().size);
  protected readonly allSelected = computed(
    () => this.store.items().length > 0 && this.selected().size === this.store.items().length,
  );

  ngOnInit(): void {
    const first = this.preselect();
    if (first) this.selected.set(new Set([first]));
  }

  protected toggle(id: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected toggleAll(): void {
    this.selected.set(
      this.allSelected() ? new Set() : new Set(this.store.items().map((r) => r.id)),
    );
  }

  protected async close(): Promise<void> {
    await this.nav.navigateBack('/receipts');
  }

  protected async exportSelection(): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: tp(this.count(), 'Export {count} receipt', 'Export {count} receipts'),
      buttons: [
        { text: t('Spreadsheet (CSV)'), data: 'csv' },
        { text: t('PDF report'), data: 'pdf' },
        { text: t('Photos only (ZIP)'), data: 'zip' },
        { text: t('Cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss<'csv' | 'pdf' | 'zip'>();
    if (data) {
      await this.feedback.busy(t('Preparing the file…'), () =>
        this.exporter.exportSelection([...this.selected()], data),
      );
    }
  }

  protected async shareSelection(): Promise<void> {
    await this.feedback.busy(t('Preparing the file…'), () =>
      this.exporter.exportSelection([...this.selected()], 'pdf', true),
    );
  }

  protected async deleteSelection(): Promise<void> {
    const count = this.count();
    const confirmed = await this.feedback.confirm({
      header: tp(count, 'Delete {count} receipt?', 'Delete {count} receipts?'),
      message: t('The photos and their data will be removed from this phone.'),
      confirmText: t('Delete'),
      destructive: true,
    });
    if (!confirmed) return;
    const ids = this.selected();
    const receipts = this.store.items().filter((r) => ids.has(r.id));
    try {
      await this.deleter.execute(receipts);
      this.selected.set(new Set());
      await this.feedback.toast(tp(count, '{count} receipt deleted', '{count} receipts deleted'));
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }

  protected async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    await this.store.loadMore();
    await event.target.complete();
  }
}
