import { Injectable } from '@angular/core';
import { DocumentRenderer, type PdfReportInput } from '@application';
import { type Category, type Money, type Receipt, sumByCurrency } from '@domain';

const PAGE_MARGIN = 16;
const LINE = 6;

/**
 * Adapter: PDF with jsPDF and ZIP with fflate. Both libraries are loaded on demand,
 * so they never weigh on the app's start-up time.
 */
@Injectable()
export class JsPdfFflateRenderer extends DocumentRenderer {
  async pdf(input: PdfReportInput): Promise<Uint8Array> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const money = moneyFormatter();
    const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    let y = PAGE_MARGIN;

    const ensureSpace = (needed: number): void => {
      if (y + needed > height - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
    };

    doc.setFont('helvetica', 'bold').setFontSize(18).text(input.title, PAGE_MARGIN, y);
    y += LINE + 2;
    const total = sumByCurrency(input.receipts.map((r) => r.total));
    doc
      .setFont('helvetica', 'normal')
      .setFontSize(11)
      .text(`${input.receipts.length} receipts · ${money(...total)}`, PAGE_MARGIN, y);
    y += LINE * 2;

    if (input.receipts.length > 1) {
      doc.setFont('helvetica', 'bold').setFontSize(13).text('By category', PAGE_MARGIN, y);
      y += LINE + 1;
      doc.setFont('helvetica', 'normal').setFontSize(11);
      for (const row of byCategory(input.receipts, input.categories)) {
        ensureSpace(LINE);
        doc.text(`${row.name} (${row.count})`, PAGE_MARGIN, y);
        doc.text(money(...row.amounts), width - PAGE_MARGIN, y, { align: 'right' });
        y += LINE;
      }
      y += LINE;
    }

    const names = new Map(input.categories.map((c) => [c.id, c.name]));
    for (const receipt of input.receipts) {
      const image = input.images.get(receipt.id);
      ensureSpace(image ? 120 : LINE * 5);
      doc.setDrawColor(218, 223, 218).line(PAGE_MARGIN, y, width - PAGE_MARGIN, y);
      y += LINE;
      doc.setFont('helvetica', 'bold').setFontSize(12).text(receipt.store, PAGE_MARGIN, y);
      doc.text(money(receipt.total), width - PAGE_MARGIN, y, { align: 'right' });
      y += LINE;
      doc.setFont('helvetica', 'normal').setFontSize(10);
      const meta = [day.format(receipt.purchasedAt), names.get(receipt.categoryId) ?? ''];
      if (receipt.tax !== null) meta.push(`Tax ${money(receipt.tax)}`);
      if (receipt.needsReview) meta.push('Needs review');
      doc.text(meta.join(' · '), PAGE_MARGIN, y);
      y += LINE;
      if (receipt.note) {
        doc.text(
          doc.splitTextToSize(receipt.note, width - PAGE_MARGIN * 2) as string[],
          PAGE_MARGIN,
          y,
        );
        y += LINE;
      }
      if (image) {
        const props = doc.getImageProperties(image);
        const imageWidth = 70;
        const imageHeight = Math.min(100, (props.height / props.width) * imageWidth);
        doc.addImage(image, 'JPEG', PAGE_MARGIN, y, imageWidth, imageHeight, undefined, 'FAST');
        y += imageHeight + LINE;
      }
      y += 2;
    }
    return new Uint8Array(doc.output('arraybuffer'));
  }

  async zip(entries: Readonly<Record<string, Uint8Array>>): Promise<Uint8Array> {
    const { zip } = await import('fflate');
    // Photos are already compressed JPEGs: storing them (level 0) is much faster.
    const files = Object.fromEntries(
      Object.entries(entries).map(([name, bytes]) => [
        name,
        [bytes, { level: name.endsWith('.jpg') ? 0 : 6 }],
      ]),
    ) as Parameters<typeof zip>[0];
    return new Promise((resolve, reject) => {
      zip(files, (error, data) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
  }

  async unzip(archive: Uint8Array): Promise<Record<string, Uint8Array>> {
    const { unzip } = await import('fflate');
    return new Promise((resolve, reject) => {
      unzip(archive, (error, data) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
  }
}

function byCategory(
  receipts: readonly Receipt[],
  categories: readonly Category[],
): { name: string; count: number; amounts: Money[] }[] {
  const rows = new Map<string, Receipt[]>();
  for (const receipt of receipts) {
    const name = categories.find((c) => c.id === receipt.categoryId)?.name ?? 'Other';
    rows.set(name, [...(rows.get(name) ?? []), receipt]);
  }
  return [...rows.entries()]
    .map(([name, rs]) => ({
      name,
      count: rs.length,
      amounts: sumByCurrency(rs.map((r) => r.total)),
    }))
    .sort((a, b) => b.count - a.count);
}

/** Formats one amount, or several in different currencies ("$12.00 + €5.00"). */
function moneyFormatter(): (...amounts: Money[]) => string {
  const formats = new Map<string, Intl.NumberFormat>();
  const format = (amount: Money): string => {
    let formatter = formats.get(amount.currency);
    if (!formatter) {
      formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: amount.currency,
      });
      formats.set(amount.currency, formatter);
    }
    return formatter.format(amount.major);
  };
  return (...amounts) => amounts.map(format).join(' + ');
}
