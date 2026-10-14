/*
 * Domain layer, split into bounded contexts:
 *   shared-kernel  Money, DateRange, DomainError: the language every context shares
 *   receipts       Receipt aggregate, reading OCR text, receipt criteria
 *   categories     Category aggregate, store rules, category suggestion
 *   settings       the person's preferences
 * Pure TypeScript: no Angular, no Capacitor (enforced by ESLint).
 */
export * from './shared-kernel';
export * from './receipts';
export * from './categories';
export * from './settings';
