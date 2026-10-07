import { Injectable, inject } from '@angular/core';
import { CategoryRepository, ReceiptRepository, type StoreRule, localDayKey } from '@domain';
import { CategoriesStore } from '../categories/categories.store';
import { DataReplacer } from '../ports/data-replacer.port';
import { DocumentRenderer } from '../ports/document-renderer.port';
import { FilePicker } from '../ports/file-picker.port';
import { FileSharer } from '../ports/file-sharer.port';
import { ImageStore } from '../ports/image-store.port';
import { ReminderScheduler } from '../ports/reminder-scheduler.port';
import { ReceiptsStore } from '../receipts/receipts.store';
import { SettingsStore } from '../settings/settings.store';
import { AppError } from '../shared/app-error';
import { CLOCK } from '../shared/clock';
import { BACKUP_DATA_FILE, parseBackup, serializeBackup } from './backup-format';

export interface BackupStatus {
  readonly receiptCount: number;
  readonly usedBytes: number;
  readonly newSinceBackup: number;
}

@Injectable({ providedIn: 'root' })
export class BackupUseCase {
  private readonly receiptRepository = inject(ReceiptRepository);
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly images = inject(ImageStore);
  private readonly renderer = inject(DocumentRenderer);
  private readonly sharer = inject(FileSharer);
  private readonly picker = inject(FilePicker);
  private readonly reminders = inject(ReminderScheduler);
  private readonly replacer = inject(DataReplacer);
  private readonly settings = inject(SettingsStore);
  private readonly categories = inject(CategoriesStore);
  private readonly receipts = inject(ReceiptsStore);
  private readonly now = inject(CLOCK);

  async status(): Promise<BackupStatus> {
    const [totals, usedBytes] = await Promise.all([
      this.receiptRepository.totals({}, this.settings.currency()),
      this.images.usedBytes(),
    ]);
    return {
      receiptCount: totals.count,
      usedBytes,
      newSinceBackup: Math.max(0, totals.count - this.settings.settings().receiptsAtLastBackup),
    };
  }

  /** One ZIP with data.json and every photo, handed to the share sheet. */
  async backup(): Promise<void> {
    const [receipts, categories, rules] = await Promise.all([
      this.receiptRepository.all(),
      this.categoryRepository.list(),
      this.categoryRepository.storeRules(),
    ]);
    const now = this.now();
    const entries: Record<string, Uint8Array> = {};
    const archived = await Promise.all(
      receipts.map(async (receipt) => {
        const entry = `images/${receipt.id}.jpg`;
        entries[entry] = await this.images.read(receipt.imagePath);
        return receipt.replacePhoto(entry, receipt.ocrText, receipt.updatedAt);
      }),
    );
    const storeRules: StoreRule[] = [...rules].map(([storeKey, categoryId]) => ({
      storeKey,
      categoryId,
    }));
    entries[BACKUP_DATA_FILE] = new TextEncoder().encode(
      serializeBackup(
        { settings: this.settings.settings(), categories, storeRules, receipts: archived },
        now,
      ),
    );

    await this.sharer.shareFile(
      {
        fileName: `scanreceipt-backup-${localDayKey(now)}.zip`,
        mimeType: 'application/zip',
        data: await this.renderer.zip(entries),
      },
      'ScanReceipt backup',
    );
    await this.settings.update({
      lastBackupAt: now.toISOString(),
      receiptsAtLastBackup: receipts.length,
    });
  }

  /** Replaces everything on this phone with a backup. Resolves false when cancelled. */
  async restore(): Promise<boolean> {
    const file = await this.picker.pickBackup();
    if (!file) return false;

    // 1. Read and check everything before changing anything.
    const entries = await this.renderer.unzip(file.bytes);
    const json = entries[BACKUP_DATA_FILE];
    if (!json) {
      throw new AppError('This file is not a ScanReceipt backup.');
    }
    const content = parseBackup(new TextDecoder().decode(json));
    const incomplete = content.receipts.find((r) => !entries[r.imagePath]);
    if (incomplete) {
      throw new AppError(
        `The backup is incomplete: the photo of "${incomplete.store}" is missing.`,
      );
    }

    // 2. Write photos, then swap all the data in one transaction, then clean up.
    const restored = await Promise.all(
      content.receipts.map(async (receipt) => {
        const path = await this.images.write(
          receipt.id,
          entries[receipt.imagePath] ?? new Uint8Array(),
        );
        return receipt.replacePhoto(path, receipt.ocrText, receipt.updatedAt);
      }),
    );
    await this.replacer.replaceAll({
      categories: content.categories,
      storeRules: content.storeRules,
      receipts: restored,
    });
    await this.images.retainOnly(restored.map((r) => r.imagePath));

    const { lastBackupAt } = this.settings.settings();
    await this.settings.update({
      ...content.settings,
      lastBackupAt,
      receiptsAtLastBackup: restored.length,
    });
    await this.categories.load();
    await this.receipts.refresh();
    return true;
  }

  async setReminder(enabled: boolean): Promise<boolean> {
    if (!enabled) {
      await this.reminders.cancelBackupReminder();
      await this.settings.update({ backupReminder: false });
      return true;
    }
    const granted = await this.reminders.scheduleMonthlyBackupReminder();
    await this.settings.update({ backupReminder: granted });
    return granted;
  }
}
