import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ScanReceiptUseCase,
  ScanSessionStore,
  type ScanStep,
  type UserMessage,
  messageOf,
} from '@application';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { Platform } from '@ionic/angular/platform';
import type { ViewDidEnter } from '@ionic/angular';
import { marker } from '../../i18n/i18n';
import { TranslatePipe } from '../../i18n/translate.pipe';

const STEPS: readonly { id: Exclude<ScanStep, 'done'>; label: string }[] = [
  { id: 'enhancing', label: marker('Enhancing image') },
  { id: 'detecting', label: marker('Detecting text') },
  { id: 'extracting', label: marker('Extracting store, date, total') },
  { id: 'preparing', label: marker('Preparing review') },
];

@Component({
  selector: 'app-scan-processing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonIcon, IonSpinner, IonButton],
  templateUrl: './scan-processing.page.html',
  styleUrl: './scan-processing.page.scss',
})
export class ScanProcessingPage implements ViewDidEnter {
  private readonly scan = inject(ScanReceiptUseCase);
  private readonly session = inject(ScanSessionStore);
  private readonly router = inject(Router);

  protected readonly onPhone = inject(Platform).is('hybrid');
  protected readonly steps = STEPS;
  protected readonly error = signal<UserMessage | null>(null);
  protected readonly failed = computed(() => this.error() !== null);
  protected readonly currentIndex = computed(() => {
    const step = this.session.step();
    return step === 'done' ? STEPS.length : STEPS.findIndex((s) => s.id === step);
  });

  ionViewDidEnter(): void {
    void this.run();
  }

  protected async run(): Promise<void> {
    if (!this.session.draft()) {
      await this.router.navigate(['/receipts'], { replaceUrl: true });
      return;
    }
    this.error.set(null);
    try {
      await this.scan.process();
      await this.router.navigate(['/scan/review'], { replaceUrl: true });
    } catch (error: unknown) {
      console.error(error);
      this.error.set(
        messageOf(
          error,
          'The text could not be read. Try again in better light, or enter the details yourself.',
        ),
      );
    }
  }

  protected async enterManually(): Promise<void> {
    this.session.complete({ ocrText: '', reading: null, suggestion: null, ocrAvailable: false });
    await this.router.navigate(['/scan/review'], { replaceUrl: true });
  }
}
