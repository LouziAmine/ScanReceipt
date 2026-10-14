import { Injectable, inject } from '@angular/core';
import { type CurrencyCode } from '@domain';
import { ModalController } from '@ionic/angular/modal-controller';
import { CurrencyPickerComponent } from './currency-picker.component';

/** A searchable list of every currency, with the likely ones first. */
@Injectable({ providedIn: 'root' })
export class CurrencyPickerService {
  private readonly modals = inject(ModalController);

  /** Resolves the chosen currency, or null when cancelled. */
  async choose(selected: CurrencyCode | null): Promise<CurrencyCode | null> {
    const modal = await this.modals.create({
      component: CurrencyPickerComponent,
      componentProps: { selected },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<CurrencyCode>();
    return role === 'select' && data ? data : null;
  }
}
