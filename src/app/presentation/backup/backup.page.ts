import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { BackupUseCase, ReceiptsStore, SettingsStore } from '@application';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { formatNumericDate } from '../shared/dates';
import { FeedbackService } from '../shared/feedback.service';
import { FileSizePipe } from '../shared/file-size.pipe';
import { PluralPipe } from '../shared/plural.pipe';

@Component({
  selector: 'app-backup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PluralPipe,
    FileSizePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/receipts" text="" />
        </ion-buttons>
        <ion-title>Backup & restore</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="card">
        <strong>{{ lastBackupLabel() }}</strong>
        @if (status.value(); as s) {
          <span class="muted"
            >{{ s.receiptCount | plural: 'receipt' }} · {{ s.usedBytes | fileSize }}</span
          >
          @if (s.newSinceBackup > 0 && settings.settings().lastBackupAt) {
            <span class="review-badge"
              >{{ s.newSinceBackup | plural: 'new receipt' }} since your last backup</span
            >
          }
        }
        <ion-button expand="block" (click)="backup()">
          <ion-icon slot="start" name="cloud-upload-outline" />
          Back up now
        </ion-button>
        <p class="muted small">
          Creates one file with your receipts, photos and categories. You choose where to save it:
          Files, iCloud Drive, Google Drive or email.
        </p>
      </section>

      <section class="card">
        <ion-button expand="block" fill="outline" (click)="restore()">
          <ion-icon slot="start" name="cloud-download-outline" />
          Restore from a backup file
        </ion-button>
        <p class="muted small">
          Use this on a new phone. Restoring replaces the receipts currently on this phone.
        </p>
      </section>

      <ion-list lines="none">
        <ion-item>
          <ion-toggle
            [checked]="settings.settings().backupReminder"
            (ionChange)="setReminder($event.detail.checked)"
          >
            <ion-label>
              Remind me every month
              <p>A notification when it's time to back up</p>
            </ion-label>
          </ion-toggle>
        </ion-item>
      </ion-list>

      <p class="warning">
        <ion-icon name="alert-circle-outline" aria-hidden="true" />
        Your receipts live only on this phone. Without a backup, losing the phone means losing them.
      </p>
    </ion-content>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 18px;
      margin-bottom: 16px;
      border-radius: var(--app-radius-lg);
      background: var(--app-surface);
    }
    .small {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .review-badge {
      align-self: flex-start;
      font-size: 13px;
      padding: 4px 8px;
    }
    ion-item {
      --background: transparent;
      --padding-start: 0;
    }
    .warning ion-icon {
      flex: none;
      font-size: 20px;
    }
    .warning {
      display: flex;
      gap: 8px;
      font-size: 13px;
      color: var(--app-text-muted);
      line-height: 1.5;
    }
  `,
})
export class BackupPage {
  private readonly backups = inject(BackupUseCase);
  private readonly feedback = inject(FeedbackService);
  private readonly receipts = inject(ReceiptsStore);
  protected readonly settings = inject(SettingsStore);

  protected readonly status = resource({
    params: () => ({ version: this.receipts.items(), last: this.settings.settings().lastBackupAt }),
    loader: () => this.backups.status(),
  });

  protected readonly lastBackupLabel = computed(() => {
    const last = this.settings.settings().lastBackupAt;
    return last
      ? `Last backup: ${formatNumericDate(new Date(last), this.settings.dateFormat())}`
      : 'No backup yet';
  });

  protected async backup(): Promise<void> {
    await this.feedback.busy('Creating the backup…', () => this.backups.backup());
  }

  protected async restore(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'Restore a backup?',
      message: 'The receipts currently on this phone will be replaced by the ones in the backup.',
      confirmText: 'Choose file',
    });
    if (!confirmed) return;
    const restored = await this.feedback.busy('Restoring…', () => this.backups.restore());
    if (restored) await this.feedback.toast('Backup restored');
  }

  protected async setReminder(enabled: boolean): Promise<void> {
    try {
      const ok = await this.backups.setReminder(enabled);
      if (!ok)
        await this.feedback.toast(
          'Notifications are turned off for ScanReceipt in your phone settings.',
        );
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }
}
