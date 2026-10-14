import { type CurrencyCode, Money, type ReceiptDetails, type ReviewableField } from '@domain';

/** The person's choice to save a receipt paid in another currency in their own one. */
export interface CurrencyConversion {
  /** The person's currency, the one the receipt is saved in. */
  readonly currency: CurrencyCode;
  /** Units of `currency` for one unit of the receipt's currency. */
  readonly rate: number;
}

/** What the review and edit forms hand to the use cases (plain values, no domain types). */
export interface ReceiptFormValue {
  readonly store: string;
  readonly purchasedAt: Date;
  /** The amounts printed on the receipt, in its `currency`. */
  readonly totalCents: number;
  readonly taxCents: number | null;
  readonly currency: CurrencyCode;
  readonly categoryId: string;
  readonly note: string;
  /** Fields the person has not confirmed yet. */
  readonly doubtfulFields: readonly ReviewableField[];
  /** Set when `currency` is not the person's: the receipt is saved converted. */
  readonly conversion?: CurrencyConversion;
}

export function toReceiptDetails(value: ReceiptFormValue): ReceiptDetails {
  const total = Money.of(value.totalCents, value.currency);
  const tax = value.taxCents === null ? null : Money.of(value.taxCents, value.currency);
  const common = {
    store: value.store,
    purchasedAt: value.purchasedAt,
    categoryId: value.categoryId,
    note: value.note,
  };
  const { conversion } = value;
  if (!conversion || conversion.currency === value.currency) {
    return { ...common, total, tax, original: null };
  }
  return {
    ...common,
    total: total.convert(conversion.rate, conversion.currency),
    tax: tax?.convert(conversion.rate, conversion.currency) ?? null,
    original: { total, tax, rate: conversion.rate },
  };
}
