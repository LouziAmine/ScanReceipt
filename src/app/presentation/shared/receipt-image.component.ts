import { ChangeDetectionStrategy, Component, inject, input, resource } from '@angular/core';
import { marker } from '../i18n/i18n';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ImageStore } from '@application';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';

/** Shows a stored receipt photo; the file URL is resolved asynchronously. */
@Component({
  selector: 'app-receipt-image',
  imports: [IonSkeletonText, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipt-image.component.html',
  styleUrl: './receipt-image.component.scss',
})
export class ReceiptImageComponent {
  private readonly images = inject(ImageStore);

  readonly path = input.required<string>();
  /** English text, or a text the caller already translated. */
  readonly alt = input<string>(marker('Receipt photo'));
  readonly fit = input<'cover' | 'contain'>('cover');

  protected readonly url = resource({
    params: () => this.path(),
    loader: ({ params }) => this.images.displayUrl(params),
  });
}
