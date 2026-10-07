import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { type CaptureSource, ScanReceiptUseCase } from '@application';
import { FeedbackService } from '../shared/feedback.service';

/** Starts a scan from anywhere and opens the processing screen when a photo was taken. */
@Injectable({ providedIn: 'root' })
export class ScanLauncher {
  private readonly scan = inject(ScanReceiptUseCase);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);

  async start(source: CaptureSource = 'camera'): Promise<void> {
    try {
      if (await this.scan.capture(source)) {
        await this.router.navigate(['/scan/processing']);
      }
    } catch (error: unknown) {
      await this.feedback.error(error);
    }
  }
}
