import { inject, resource, type ResourceRef, type Signal } from '@angular/core';
import { ReceiptsStore } from '@application';
import { type Receipt } from '@domain';

/** Loads a receipt by route id and reloads it whenever the receipts list changes. */
export function receiptResource(id: Signal<string>): ResourceRef<Receipt | null | undefined> {
  const store = inject(ReceiptsStore);
  return resource({
    params: () => ({ id: id(), version: store.items() }),
    loader: ({ params }) => store.findById(params.id),
  });
}
