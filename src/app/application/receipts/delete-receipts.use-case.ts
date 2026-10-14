import { Injectable, inject } from '@angular/core';
import { type Receipt, ReceiptRepository } from '@domain';
import { CategoriesStore } from '../categories/categories.store';
import { ImageStore } from '../ports/image-store.port';
import { ReceiptsStore } from './receipts.store';

@Injectable({ providedIn: 'root' })
export class DeleteReceiptsUseCase {
  private readonly repository = inject(ReceiptRepository);
  private readonly images = inject(ImageStore);
  private readonly receipts = inject(ReceiptsStore);
  private readonly categories = inject(CategoriesStore);

  async execute(receipts: readonly Receipt[]): Promise<void> {
    if (receipts.length === 0) return;
    await this.repository.delete(receipts.map((r) => r.id));
    // Photos go after the rows: a failure here leaves an orphan file, never a broken receipt.
    await Promise.allSettled(receipts.map((r) => this.images.remove(r.imagePath)));
    await Promise.all([this.receipts.refresh(), this.categories.refreshCounts()]);
  }
}
