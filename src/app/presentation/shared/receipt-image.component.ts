import { ChangeDetectionStrategy, Component, inject, input, resource } from '@angular/core';
import { ImageStore } from '@application';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';

/** Shows a stored receipt photo; the file URL is resolved asynchronously. */
@Component({
  selector: 'app-receipt-image',
  imports: [IonSkeletonText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url.value(); as src) {
      <img [src]="src" [alt]="alt()" [style.object-fit]="fit()" loading="lazy" decoding="async" />
    } @else if (url.isLoading()) {
      <ion-skeleton-text [animated]="true" />
    }
  `,
  styles: `
    :host {
      display: block;
      overflow: hidden;
      background: var(--app-surface-muted);
    }
    img,
    ion-skeleton-text {
      display: block;
      width: 100%;
      height: 100%;
      margin: 0;
    }
  `,
})
export class ReceiptImageComponent {
  private readonly images = inject(ImageStore);

  readonly path = input.required<string>();
  readonly alt = input('Receipt photo');
  readonly fit = input<'cover' | 'contain'>('cover');

  protected readonly url = resource({
    params: () => this.path(),
    loader: ({ params }) => this.images.displayUrl(params),
  });
}
