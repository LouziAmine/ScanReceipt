import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ScanReceiptUseCase, ScanSessionStore, type ScanStep, messageOf } from '@application';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import type { ViewDidEnter } from '@ionic/angular';

const STEPS: readonly { id: Exclude<ScanStep, 'done'>; label: string }[] = [
  { id: 'enhancing', label: 'Enhancing image' },
  { id: 'detecting', label: 'Detecting text' },
  { id: 'extracting', label: 'Extracting store, date, total' },
  { id: 'preparing', label: 'Preparing review' },
];

@Component({
  selector: 'app-scan-processing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, IonSpinner, IonButton],
  template: `
    <ion-content class="ion-padding">
      <div class="wrap">
        <div class="paper" aria-hidden="true">
          <span class="line w70"></span>
          <span class="line"></span>
          <span class="line w60"></span>
          <span class="line"></span>
          <span class="line w40 end"></span>
          @if (!failed()) {
            <span class="scan-line"></span>
          }
        </div>

        @if (failed()) {
          <h1>We couldn't read this receipt</h1>
          <p class="sub">{{ error() }}</p>
          <div class="actions">
            <ion-button expand="block" (click)="run()">Try again</ion-button>
            <ion-button expand="block" fill="outline" (click)="enterManually()"
              >Enter details myself</ion-button
            >
          </div>
        } @else {
          <h1>Reading your receipt…</h1>
          <p class="sub">Just a few seconds. Everything is processed on your phone.</p>
          <ol class="steps" aria-live="polite">
            @for (step of steps; track step.id; let index = $index) {
              <li [class.done]="index < currentIndex()" [class.active]="index === currentIndex()">
                @if (index < currentIndex()) {
                  <ion-icon name="checkmark-circle" color="primary" aria-hidden="true" />
                } @else if (index === currentIndex()) {
                  <ion-spinner name="crescent" aria-hidden="true" />
                } @else {
                  <span class="pending" aria-hidden="true"></span>
                }
                {{ step.label }}
              </li>
            }
          </ol>
        }
        <p class="privacy">
          <ion-icon name="lock-closed-outline" aria-hidden="true" />
          No data is sent to the internet
        </p>
      </div>
    </ion-content>
  `,
  styleUrl: './scan-processing.page.scss',
})
export class ScanProcessingPage implements ViewDidEnter {
  private readonly scan = inject(ScanReceiptUseCase);
  private readonly session = inject(ScanSessionStore);
  private readonly router = inject(Router);

  protected readonly steps = STEPS;
  protected readonly error = signal<string | null>(null);
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
