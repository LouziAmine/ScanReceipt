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
import { t } from '../i18n/i18n';
import { backupReminderText } from './reminder-text';
import { PluralPipe, TranslatePipe } from '../i18n/translate.pipe';

@Component({
  selector: 'app-backup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
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
  templateUrl: './backup.page.html',
  styleUrl: './backup.page.scss',
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
      ? t('Last backup: {date}', {
          date: formatNumericDate(new Date(last), this.settings.dateFormat()),
        })
      : t('No backup yet');
  });

  protected async backup(): Promise<void> {
    await this.feedback.busy(t('Creating the backup…'), () => this.backups.backup());
  }

  protected async restore(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: t('Restore a backup?'),
      message: t(
        'The receipts currently on this phone will be replaced by the ones in the backup.',
      ),
      confirmText: t('Choose file'),
    });
    if (!confirmed) return;
    const restored = await this.feedback.busy(t('Restoring…'), () => this.backups.restore());
    if (restored) await this.feedback.toast(t('Backup restored'));
  }

  protected async setReminder(enabled: boolean): Promise<void> {
    try {
      const ok = await this.backups.setReminder(enabled, backupReminderText());
      if (!ok)
        await this.feedback.toast(
          t('Notifications are turned off for ScanReceipt in your phone settings.'),
        );
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }
}
