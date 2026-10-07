import { Injectable, inject } from '@angular/core';
import {
  type DateRange,
  type Receipt,
  ReceiptRepository,
  type ReceiptTotals,
  localDayKey,
} from '@domain';
import { CategoriesStore } from '../categories/categories.store';
import { DocumentRenderer } from '../ports/document-renderer.port';
import { FileSharer } from '../ports/file-sharer.port';
import { ImageStore } from '../ports/image-store.port';
import { SettingsStore } from '../settings/settings.store';
import { AppError } from '../shared/app-error';
import { CLOCK } from '../shared/clock';
import { receiptsToCsv } from './receipt-csv';

export type ExportFormat = 'csv' | 'pdf' | 'zip';
export type ShareFormat = 'jpg' | 'pdf' | 'csv' | 'txt';

export interface ExportRequest {
  readonly range: DateRange | null;
  readonly format: ExportFormat;
  readonly includePhotos: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExportReceiptsUseCase {
  private readonly repository = inject(ReceiptRepository);
  private readonly images = inject(ImageStore);
  private readonly renderer = inject(DocumentRenderer);
  private readonly sharer = inject(FileSharer);
  private readonly categories = inject(CategoriesStore);
  private readonly settings = inject(SettingsStore);
  private readonly now = inject(CLOCK);

  preview(range: DateRange | null): Promise<ReceiptTotals> {
    return this.repository.totals(range ? { range } : {}, this.settings.currency());
  }

  async export(request: ExportRequest): Promise<void> {
    const receipts = await this.repository.search({
      ...(request.range ? { range: request.range } : {}),
      sort: 'oldest',
    });
    await this.exportReceipts(receipts, request.format, request.includePhotos);
  }

  async exportSelection(
    ids: readonly string[],
    format: ExportFormat,
    includePhotos = false,
  ): Promise<void> {
    await this.exportReceipts(await this.repository.findByIds(ids), format, includePhotos);
  }

  async shareReceipt(receipt: Receipt, format: ShareFormat): Promise<void> {
    const title = `${receipt.store} receipt`;
    const base = `${slug(receipt.store)}-${localDayKey(receipt.purchasedAt)}`;
    switch (format) {
      case 'jpg':
        await this.sharer.shareStoredImage(receipt.imagePath, title);
        return;
      case 'pdf':
        await this.sharer.shareFile(
          {
            fileName: `${base}.pdf`,
            mimeType: 'application/pdf',
            data: await this.pdf([receipt], title, true),
          },
          title,
        );
        return;
      case 'csv':
        await this.sharer.shareFile(
          {
            fileName: `${base}.csv`,
            mimeType: 'text/csv',
            data: receiptsToCsv([receipt], this.categories.categories()),
          },
          title,
        );
        return;
      case 'txt':
        await this.sharer.copyText(receipt.ocrText);
        return;
    }
  }

  private async exportReceipts(
    receipts: readonly Receipt[],
    format: ExportFormat,
    includePhotos: boolean,
  ): Promise<void> {
    if (receipts.length === 0) {
      throw new AppError('There are no receipts to export.');
    }
    const stamp = localDayKey(this.now());
    switch (format) {
      case 'csv': {
        const csv = receiptsToCsv(receipts, this.categories.categories());
        if (!includePhotos) {
          await this.share(`scanreceipt-${stamp}.csv`, 'text/csv', csv);
          return;
        }
        const entries = await this.photoEntries(receipts);
        entries[`receipts-${stamp}.csv`] = new TextEncoder().encode(csv);
        await this.share(
          `scanreceipt-${stamp}.zip`,
          'application/zip',
          await this.renderer.zip(entries),
        );
        return;
      }
      case 'pdf':
        await this.share(
          `scanreceipt-${stamp}.pdf`,
          'application/pdf',
          await this.pdf(receipts, 'Receipts report', includePhotos),
        );
        return;
      case 'zip':
        await this.share(
          `scanreceipt-photos-${stamp}.zip`,
          'application/zip',
          await this.renderer.zip(await this.photoEntries(receipts)),
        );
        return;
    }
  }

  private async pdf(
    receipts: readonly Receipt[],
    title: string,
    withPhotos: boolean,
  ): Promise<Uint8Array> {
    return this.renderer.pdf({
      title,
      receipts,
      categories: this.categories.categories(),
      settings: this.settings.settings(),
      images: withPhotos ? await this.photoMap(receipts) : new Map(),
    });
  }

  private async share(
    fileName: string,
    mimeType: string,
    data: Uint8Array | string,
  ): Promise<void> {
    await this.sharer.shareFile({ fileName, mimeType, data }, 'Export receipts');
  }

  private async photoMap(receipts: readonly Receipt[]): Promise<Map<string, Uint8Array>> {
    const pairs = await Promise.all(
      receipts.map(async (r) => [r.id, await this.images.read(r.imagePath)] as const),
    );
    return new Map(pairs);
  }

  private async photoEntries(receipts: readonly Receipt[]): Promise<Record<string, Uint8Array>> {
    const entries: Record<string, Uint8Array> = {};
    for (const receipt of receipts) {
      const base = `photos/${localDayKey(receipt.purchasedAt)}-${slug(receipt.store)}`;
      let name = base;
      for (let n = 2; `${name}.jpg` in entries; n++) name = `${base}-${n}`;
      entries[`${name}.jpg`] = await this.images.read(receipt.imagePath);
    }
    return entries;
  }
}

function slug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'receipt'
  );
}
