import { Injectable, inject } from '@angular/core';
import { Receipt, ReceiptRepository } from '@domain';
import { CategoriesStore } from '../categories/categories.store';
import { DocumentScanner } from '../ports/document-scanner.port';
import { ImageStore } from '../ports/image-store.port';
import { SettingsStore } from '../settings/settings.store';
import { AppError } from '../shared/app-error';
import { CLOCK, ID_GENERATOR } from '../shared/clock';
import { type ReceiptFormValue, toReceiptDetails } from './receipt-form-value';
import { ReceiptsStore } from './receipts.store';
import { ScanSessionStore } from './scan-session.store';

/** Write side of the Receipts context: record, revise, review, undo. */
@Injectable({ providedIn: 'root' })
export class SaveReceiptUseCase {
  private readonly repository = inject(ReceiptRepository);
  private readonly images = inject(ImageStore);
  private readonly scanner = inject(DocumentScanner);
  private readonly session = inject(ScanSessionStore);
  private readonly receipts = inject(ReceiptsStore);
  private readonly categories = inject(CategoriesStore);
  private readonly settings = inject(SettingsStore);
  private readonly now = inject(CLOCK);
  private readonly newId = inject(ID_GENERATOR);

  async recordScan(value: ReceiptFormValue, alwaysUseForStore: boolean): Promise<Receipt> {
    const draft = this.session.draft();
    if (!draft) {
      throw new AppError('The scan was lost. Please scan the receipt again.');
    }
    const { currency, warnOnLowConfidence } = this.settings.settings();
    const details = toReceiptDetails(value, currency);
    const id = this.newId();
    // Validate before touching the file system.
    Receipt.record({ id, details, imagePath: '', ocrText: '', doubtfulFields: [] }, this.now());

    const receipt = Receipt.record(
      {
        id,
        details,
        imagePath: await this.images.persist(draft.temporaryImageUri, id),
        ocrText: draft.ocrText,
        doubtfulFields: warnOnLowConfidence ? value.doubtfulFields : [],
      },
      this.now(),
    );
    await this.repository.save(receipt);
    if (alwaysUseForStore) {
      await this.categories.alwaysUseForStore(receipt.store, receipt.categoryId);
    }
    this.session.clear();
    await this.afterChange();
    return receipt;
  }

  /** Saves the person's corrections; `rereadText` is the OCR text after "Re-run OCR". */
  async revise(receipt: Receipt, value: ReceiptFormValue, rereadText?: string): Promise<Receipt> {
    const now = this.now();
    let next = receipt.revise(toReceiptDetails(value, receipt.currency), value.doubtfulFields, now);
    if (rereadText !== undefined) {
      next = next.replacePhoto(next.imagePath, rereadText, now);
    }
    await this.repository.save(next);
    await this.afterChange();
    return next;
  }

  /** Saves the receipt as verified and returns the previous version, for "Undo". */
  async markReviewed(receipt: Receipt): Promise<Receipt> {
    await this.repository.save(receipt.markReviewed(this.now()));
    await this.afterChange();
    return receipt;
  }

  /** Puts back an earlier version of a receipt ("Undo"). */
  async restore(previous: Receipt): Promise<void> {
    await this.repository.save(previous);
    await this.afterChange();
  }

  /** "Undo" right after recording a new scan. */
  async undoRecord(receipt: Receipt): Promise<void> {
    await this.repository.delete([receipt.id]);
    await this.images.remove(receipt.imagePath);
    await this.afterChange();
  }

  /** Takes a new photo for an existing receipt. Resolves null when cancelled. */
  async replacePhoto(receipt: Receipt, ocrText: string | null = null): Promise<Receipt | null> {
    const scanned = await this.scanner.scan(this.settings.settings().imageQuality);
    if (!scanned) {
      return null;
    }
    const imagePath = await this.images.persist(scanned.imagePath, receipt.id);
    const next = receipt.replacePhoto(imagePath, ocrText ?? receipt.ocrText, this.now());
    await this.repository.save(next);
    await this.images.remove(receipt.imagePath);
    await this.afterChange();
    return next;
  }

  private async afterChange(): Promise<void> {
    await Promise.all([this.receipts.refresh(), this.categories.refreshCounts()]);
  }
}
