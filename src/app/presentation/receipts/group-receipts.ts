import { type Receipt } from '@domain';
import { dayGroupLabel } from '../shared/dates';

export interface ReceiptGroup {
  readonly label: string;
  readonly receipts: readonly Receipt[];
}

/** Consecutive receipts sharing a label ("Today", "Yesterday", "September 2026") form a group. */
export function groupReceipts(receipts: readonly Receipt[], now: Date): ReceiptGroup[] {
  const groups: { label: string; receipts: Receipt[] }[] = [];
  for (const receipt of receipts) {
    const label = dayGroupLabel(receipt.purchasedAt, now);
    const last = groups.at(-1);
    if (last?.label === label) {
      last.receipts.push(receipt);
    } else {
      groups.push({ label, receipts: [receipt] });
    }
  }
  return groups;
}
