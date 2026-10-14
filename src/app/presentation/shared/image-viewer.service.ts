import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/modal-controller';
import { ImageViewerComponent } from './image-viewer.component';

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
