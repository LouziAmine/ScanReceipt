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
import { FeedbackService } from '../../shared/feedback.service';
import { ReceiptRowComponent } from '../../shared/receipt-row.component';

@Component({
  selector: 'app-select-receipts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="close()" aria-label="Close selection">
            <ion-icon slot="icon-only" name="close-outline" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ count() }} selected</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="toggleAll()">{{
            allSelected() ? 'Select none' : 'Select all'
          }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <p class="hint">
        Tap receipts to select them. Long-press any receipt in the list to start here.
      </p>
      <ion-list lines="none">
        @for (receipt of store.items(); track receipt.id) {
          <ion-item [class.selected]="selected().has(receipt.id)">
            <ion-checkbox
              slot="start"
              [checked]="selected().has(receipt.id)"
              (ionChange)="toggle(receipt.id)"
              [attr.aria-label]="'Select ' + receipt.store"
            />
            <app-receipt-row
              [receipt]="receipt"
              [category]="categories.categoryOf(receipt.categoryId)"
              [now]="now"
            />
          </ion-item>
        }
      </ion-list>
      <ion-infinite-scroll [disabled]="!store.hasMore()" (ionInfinite)="loadMore($event)">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <div class="actions">
          <ion-button fill="clear" [disabled]="count() === 0" (click)="exportSelection()">
            <ion-icon slot="start" name="cloud-upload-outline" />
            Export
          </ion-button>
          <ion-button fill="clear" [disabled]="count() === 0" (click)="shareSelection()">
            <ion-icon slot="start" name="share-outline" />
            Share
          </ion-button>
          <ion-button
            fill="clear"
            color="danger"
            [disabled]="count() === 0"
            (click)="deleteSelection()"
          >
            <ion-icon slot="start" name="trash-outline" />
            Delete
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    .hint {
      margin: 12px 20px;
      font-size: 13px;
      color: var(--app-text-muted);
    }
    ion-item {
      --background: transparent;
      --padding-start: 16px;
    }
    ion-item.selected {
      --background: var(--app-selected-row);
    }
    .actions {
      display: flex;
      justify-content: space-around;
    }
  `,
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
      header: `Export ${this.count()} receipts`,
      buttons: [
        { text: 'Spreadsheet (CSV)', data: 'csv' },
        { text: 'PDF report', data: 'pdf' },
        { text: 'Photos only (ZIP)', data: 'zip' },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onWillDismiss<'csv' | 'pdf' | 'zip'>();
    if (data) {
      await this.feedback.busy('Preparing the file…', () =>
        this.exporter.exportSelection([...this.selected()], data),
      );
    }
  }

  protected async shareSelection(): Promise<void> {
    await this.feedback.busy('Preparing the file…', () =>
      this.exporter.exportSelection([...this.selected()], 'pdf', true),
    );
  }

  protected async deleteSelection(): Promise<void> {
    const count = this.count();
    const confirmed = await this.feedback.confirm({
      header: `Delete ${count} ${count === 1 ? 'receipt' : 'receipts'}?`,
      message: 'The photos and their data will be removed from this phone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    const ids = this.selected();
    const receipts = this.store.items().filter((r) => ids.has(r.id));
    try {
      await this.deleter.execute(receipts);
      this.selected.set(new Set());
      await this.feedback.toast(`${count} ${count === 1 ? 'receipt' : 'receipts'} deleted`);
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }

  protected async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    await this.store.loadMore();
    await event.target.complete();
  }
}
