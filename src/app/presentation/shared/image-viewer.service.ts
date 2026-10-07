import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  inject,
  input,
  signal,
} from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';

@Component({
  selector: 'app-image-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Receipt</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()" aria-label="Close">
            <ion-icon slot="icon-only" name="close-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content [scrollX]="zoomed()">
      <button
        type="button"
        class="frame"
        (click)="zoomed.set(!zoomed())"
        [attr.aria-label]="zoomed() ? 'Zoom out' : 'Zoom in'"
      >
        <img [src]="url()" alt="Receipt photo" [class.zoomed]="zoomed()" />
      </button>
    </ion-content>
  `,
  styles: `
    ion-content {
      --background: #000;
    }
    .frame {
      display: block;
      width: 100%;
      min-height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
    }
    img {
      display: block;
      width: 100%;
      height: auto;
    }
    img.zoomed {
      width: 220%;
      max-width: none;
    }
  `,
})
class ImageViewerComponent {
  private readonly modal = inject(ModalController);
  readonly url = input.required<string>();
  protected readonly zoomed = signal(false);

  protected close(): Promise<boolean> {
    return this.modal.dismiss();
  }
}

/** Full-screen photo with tap-to-zoom. */
@Injectable({ providedIn: 'root' })
export class ImageViewerService {
  private readonly modals = inject(ModalController);

  async open(url: string): Promise<void> {
    const modal = await this.modals.create({
      component: ImageViewerComponent,
      componentProps: { url },
    });
    await modal.present();
  }
}
