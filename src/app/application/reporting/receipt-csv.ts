import { type Category, type Receipt, localDayKey } from '@domain';

const HEADER = [
  'Date',
  'Store',
  'Category',
  'Total',
  'Sales tax',
  'Currency',
  'Needs review',
  'Note',
];

/** RFC 4180 CSV that opens cleanly in Excel and Google Sheets. */
export function receiptsToCsv(
  receipts: readonly Receipt[],
  categories: readonly Category[],
): string {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const rows = receipts.map((receipt) => [
    `${localDayKey(receipt.purchasedAt)} ${time(receipt.purchasedAt)}`,
    receipt.store,
    names.get(receipt.categoryId) ?? '',
    receipt.total.major.toFixed(2),
    receipt.tax === null ? '' : receipt.tax.major.toFixed(2),
    receipt.currency,
    receipt.needsReview ? 'yes' : 'no',
    receipt.note,
  ]);
  // The BOM makes Excel read the file as UTF-8 (accents, currency symbols).
  return '﻿' + [HEADER, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

function time(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function escapeCell(value: string): string {
  // Spreadsheets run cells starting with these characters as formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
