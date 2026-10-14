import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '../i18n/translate.pipe';

@Component({
  selector: 'app-image-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
  ],
  templateUrl: './image-viewer.component.html',
  styleUrl: './image-viewer.component.scss',
})
/** Full-screen photo with tap-to-zoom; opened by `ImageViewerService`. */
export class ImageViewerComponent {
  private readonly modals = inject(ModalController);
  readonly url = input.required<string>();
  protected readonly zoomed = signal(false);

  protected close(): Promise<boolean> {
    return this.modals.dismiss();
  }
}
