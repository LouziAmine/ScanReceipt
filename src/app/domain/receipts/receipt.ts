import { DomainError } from '../shared-kernel/domain-error';
import { type CurrencyCode, type Money } from '../shared-kernel/money';

/** Fields the OCR can be unsure about. A receipt with any of them left needs review. */
export type ReviewableField = 'store' | 'date' | 'total' | 'tax';
export const REVIEWABLE_FIELDS: readonly ReviewableField[] = ['store', 'date', 'total', 'tax'];

/** What a person can see and change on a receipt. */
export interface ReceiptDetails {
  readonly store: string;
  readonly purchasedAt: Date;
  readonly total: Money;
  readonly tax: Money | null;
  readonly categoryId: string;
  readonly note: string;
}

export interface ReceiptSnapshot extends ReceiptDetails {
  readonly id: string;
  /** Relative path of the cropped photo in the app's private storage. */
  readonly imagePath: string;
  readonly ocrText: string;
  readonly doubtfulFields: readonly ReviewableField[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RecordReceipt {
  readonly id: string;
  readonly details: ReceiptDetails;
  readonly imagePath: string;
  readonly ocrText: string;
  readonly doubtfulFields: readonly ReviewableField[];
}

const MAX_STORE_LENGTH = 80;
const MAX_NOTE_LENGTH = 500;
const EARLIEST_PURCHASE = new Date(2000, 0, 1).getTime();
const CLOCK_SKEW_MS = 86_400_000;

/**
 * Aggregate root of the Receipts context. Immutable: every change returns a new
 * instance, which plays well with Angular signals.
 */
export class Receipt {
  private constructor(private readonly props: ReceiptSnapshot) {}

  /** A new receipt, scanned and reviewed by the person. Enforces every invariant. */
  static record(input: RecordReceipt, now: Date): Receipt {
    const details = Receipt.validated(input.details, now);
    return new Receipt({
      ...details,
      id: input.id,
      imagePath: input.imagePath,
      ocrText: input.ocrText,
      doubtfulFields: uniqueFields(input.doubtfulFields),
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rebuilds a receipt from storage or a backup; its data was validated when recorded. */
  static rehydrate(snapshot: ReceiptSnapshot): Receipt {
    return new Receipt({ ...snapshot, doubtfulFields: uniqueFields(snapshot.doubtfulFields) });
  }

  get id(): string {
    return this.props.id;
  }
  get store(): string {
    return this.props.store;
  }
  get purchasedAt(): Date {
    return this.props.purchasedAt;
  }
  get total(): Money {
    return this.props.total;
  }
  get tax(): Money | null {
    return this.props.tax;
  }
  get currency(): CurrencyCode {
    return this.props.total.currency;
  }
  get categoryId(): string {
    return this.props.categoryId;
  }
  get note(): string {
    return this.props.note;
  }
  get imagePath(): string {
    return this.props.imagePath;
  }
  get ocrText(): string {
    return this.props.ocrText;
  }
  get doubtfulFields(): readonly ReviewableField[] {
    return this.props.doubtfulFields;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get needsReview(): boolean {
    return this.props.doubtfulFields.length > 0;
  }

  isDoubtful(field: ReviewableField): boolean {
    return this.props.doubtfulFields.includes(field);
  }

  /** The person corrected the receipt; fields they did not confirm stay doubtful. */
  revise(details: ReceiptDetails, stillDoubtful: readonly ReviewableField[], now: Date): Receipt {
    return new Receipt({
      ...this.props,
      ...Receipt.validated(details, now),
      doubtfulFields: uniqueFields(stillDoubtful),
      updatedAt: now,
    });
  }

  confirm(field: ReviewableField, now: Date): Receipt {
    return this.with({ doubtfulFields: this.props.doubtfulFields.filter((f) => f !== field) }, now);
  }

  markReviewed(now: Date): Receipt {
    return this.with({ doubtfulFields: [] }, now);
  }

  moveToCategory(categoryId: string, now: Date): Receipt {
    return this.with({ categoryId }, now);
  }

  replacePhoto(imagePath: string, ocrText: string, now: Date): Receipt {
    return this.with({ imagePath, ocrText }, now);
  }

  /** Identity: two receipts are the same entity when their ids match. */
  sameAs(other: Receipt): boolean {
    return other.id === this.id;
  }

  snapshot(): ReceiptSnapshot {
    return this.props;
  }

  private with(changes: Partial<ReceiptSnapshot>, now: Date): Receipt {
    return new Receipt({ ...this.props, ...changes, updatedAt: now });
  }

  private static validated(details: ReceiptDetails, now: Date): ReceiptDetails {
    const store = details.store.trim().replace(/\s+/g, ' ');
    if (store.length === 0) {
      throw new DomainError('Enter the store name.', 'store');
    }
    if (store.length > MAX_STORE_LENGTH) {
      throw new DomainError(
        `The store name is limited to ${MAX_STORE_LENGTH} characters.`,
        'store',
      );
    }
    if (details.total.isNegative) {
      throw new DomainError('The total cannot be negative.', 'total');
    }
    if (details.tax !== null) {
      if (details.tax.isNegative || details.tax.isGreaterThan(details.total)) {
        throw new DomainError('The tax cannot be more than the total.', 'tax');
      }
    }
    const time = details.purchasedAt.getTime();
    if (Number.isNaN(time) || time > now.getTime() + CLOCK_SKEW_MS) {
      throw new DomainError('The date cannot be in the future.', 'date');
    }
    if (time < EARLIEST_PURCHASE) {
      throw new DomainError('Please check the date.', 'date');
    }
    const note = details.note.trim();
    if (note.length > MAX_NOTE_LENGTH) {
      throw new DomainError(`The note is limited to ${MAX_NOTE_LENGTH} characters.`, 'note');
    }
    return { ...details, store, note };
  }
}

function uniqueFields(fields: readonly ReviewableField[]): ReviewableField[] {
  return REVIEWABLE_FIELDS.filter((field) => fields.includes(field));
}
