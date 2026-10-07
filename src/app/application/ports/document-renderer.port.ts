import { type Category, type Receipt, type UserSettings } from '@domain';

export interface PdfReportInput {
  readonly title: string;
  readonly receipts: readonly Receipt[];
  readonly categories: readonly Category[];
  readonly settings: UserSettings;
  /** Receipt id -> JPEG bytes, when photos are included. */
  readonly images: ReadonlyMap<string, Uint8Array>;
}

/** Port: binary formats (PDF, ZIP) produced by third-party libraries. */
export abstract class DocumentRenderer {
  abstract pdf(input: PdfReportInput): Promise<Uint8Array>;
  abstract zip(entries: Readonly<Record<string, Uint8Array>>): Promise<Uint8Array>;
  abstract unzip(archive: Uint8Array): Promise<Record<string, Uint8Array>>;
}
