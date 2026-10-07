import { Injectable, inject } from '@angular/core';
import { AppError, messageOf } from '@application';
import { DomainError } from '@domain';
import { AlertController } from '@ionic/angular/alert-controller';
import { LoadingController } from '@ionic/angular/loading-controller';
import { ToastController } from '@ionic/angular/toast-controller';

/** One place for toasts, confirmations, errors and busy indicators. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly toasts = inject(ToastController);
  private readonly alerts = inject(AlertController);
  private readonly loadings = inject(LoadingController);

  async toast(message: string): Promise<void> {
    await this.present(message, []);
  }

  /** A toast with an "Undo" button; `undo` runs only if the person taps it. */
  async toastWithUndo(message: string, undo: () => Promise<void>): Promise<void> {
    await this.present(message, [
      {
        text: 'Undo',
        role: 'cancel',
        handler: () => {
          undo().catch((error: unknown) => this.error(error));
        },
      },
    ]);
  }

  async error(error: unknown): Promise<void> {
    if (!(error instanceof AppError || error instanceof DomainError)) {
      // Unexpected: keep the details for debugging, show a generic message.
      console.error(error);
    }
    const alert = await this.alerts.create({
      header: 'Something went wrong',
      message: messageOf(error),
      buttons: ['OK'],
    });
    await alert.present();
  }

  async confirm(options: {
    header: string;
    message: string;
    confirmText: string;
    destructive?: boolean;
  }): Promise<boolean> {
    const alert = await this.alerts.create({
      header: options.header,
      message: options.message,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: options.confirmText, role: options.destructive ? 'destructive' : 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive' || role === 'confirm';
  }

  /** Shows a spinner while `task` runs, then reports its error if it fails. */
  async busy<T>(message: string, task: () => Promise<T>): Promise<T | undefined> {
    const loading = await this.loadings.create({ message, spinner: 'crescent' });
    await loading.present();
    try {
      return await task();
    } catch (error: unknown) {
      await this.error(error);
      return undefined;
    } finally {
      await loading.dismiss();
    }
  }

  private async present(
    message: string,
    buttons: { text: string; role: 'cancel'; handler: () => void }[],
  ): Promise<void> {
    const toast = await this.toasts.create({
      message,
      duration: buttons.length > 0 ? 5000 : 2500,
      position: 'bottom',
      buttons,
    });
    await toast.present();
  }
}
