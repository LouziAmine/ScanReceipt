import { Injectable, inject } from '@angular/core';
import { type ReceiptReading, readReceipt, suggestCategory } from '@domain';
import { CategoriesStore } from '../categories/categories.store';
import { DocumentScanner } from '../ports/document-scanner.port';
import { ImageStore } from '../ports/image-store.port';
import { TextRecognizer } from '../ports/text-recognizer.port';
import { SettingsStore } from '../settings/settings.store';
import { AppError } from '../shared/app-error';
import { CLOCK } from '../shared/clock';
import { ScanSessionStore } from './scan-session.store';

export type CaptureSource = 'camera' | 'photos';

/** Capture -> on-device OCR -> reading + suggested category, kept in the scan session. */
@Injectable({ providedIn: 'root' })
export class ScanReceiptUseCase {
  private readonly scanner = inject(DocumentScanner);
  private readonly recognizer = inject(TextRecognizer);
  private readonly images = inject(ImageStore);
  private readonly session = inject(ScanSessionStore);
  private readonly settings = inject(SettingsStore);
  private readonly categories = inject(CategoriesStore);
  private readonly now = inject(CLOCK);

  /** Resolves false when the person cancels the capture. */
  async capture(source: CaptureSource): Promise<boolean> {
    const scanned =
      source === 'camera'
        ? await this.scanner.scan(this.settings.settings().imageQuality)
        : await this.scanner.importFromPhotos();
    if (!scanned) {
      return false;
    }
    this.session.start(scanned.imagePath);
    return true;
  }

  async process(): Promise<void> {
    const draft = this.session.draft();
    if (!draft) {
      throw new AppError('There is no scan to process.');
    }
    const { defaultCategoryId } = this.settings.settings();

    if (!this.recognizer.isAvailable) {
      this.session.complete({
        ocrText: '',
        reading: null,
        suggestion: { categoryId: defaultCategoryId, source: 'default' },
        ocrAvailable: false,
      });
      return;
    }

    this.session.setStep('detecting');
    const text = await this.recognizer.recognize(draft.temporaryImageUri);

    this.session.setStep('extracting');
    const reading = this.read(text);

    this.session.setStep('preparing');
    const suggestion = suggestCategory(
      reading.store.value ?? '',
      text,
      await this.categories.storeRules(),
      this.categories.categories(),
      defaultCategoryId,
    );
    this.session.complete({ ocrText: text, reading, suggestion, ocrAvailable: true });
  }

  /** Reads a saved photo again, e.g. from the edit screen. */
  async reread(imagePath: string): Promise<{ text: string; reading: ReceiptReading }> {
    if (!this.recognizer.isAvailable) {
      throw new AppError('Text recognition is only available on a phone.');
    }
    const text = await this.recognizer.recognize(await this.images.resolveUri(imagePath));
    return { text, reading: this.read(text) };
  }

  private read(text: string): ReceiptReading {
    return readReceipt(text, { dateOrder: this.settings.dateOrder(), now: this.now() });
  }
}
