import { Injectable, signal } from '@angular/core';
import { type CategorySuggestion, type ReceiptReading } from '@domain';

export type ScanStep = 'enhancing' | 'detecting' | 'extracting' | 'preparing' | 'done';

export interface ScanDraft {
  readonly temporaryImageUri: string;
  readonly ocrText: string;
  readonly reading: ReceiptReading | null;
  readonly suggestion: CategorySuggestion | null;
  readonly ocrAvailable: boolean;
}

/** The receipt being scanned, kept across the capture, processing and review screens. */
@Injectable({ providedIn: 'root' })
export class ScanSessionStore {
  private readonly draftState = signal<ScanDraft | null>(null);
  private readonly stepState = signal<ScanStep>('enhancing');

  readonly draft = this.draftState.asReadonly();
  readonly step = this.stepState.asReadonly();

  start(temporaryImageUri: string): void {
    this.stepState.set('enhancing');
    this.draftState.set({
      temporaryImageUri,
      ocrText: '',
      reading: null,
      suggestion: null,
      ocrAvailable: true,
    });
  }

  setStep(step: ScanStep): void {
    this.stepState.set(step);
  }

  complete(result: Omit<ScanDraft, 'temporaryImageUri'>): void {
    this.draftState.update((draft) => (draft ? { ...draft, ...result } : draft));
    this.stepState.set('done');
  }

  clear(): void {
    this.draftState.set(null);
  }
}
