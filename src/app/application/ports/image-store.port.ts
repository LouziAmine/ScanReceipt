/** Port: the receipt photos kept in the app's private storage. */
export abstract class ImageStore {
  /**
   * Moves a temporary image into permanent storage and returns its stored path.
   * Stored paths are relative: absolute app paths change on iOS after each update.
   */
  abstract persist(temporaryUri: string, receiptId: string): Promise<string>;
  abstract remove(path: string): Promise<void>;
  /** A URL the WebView can display. */
  abstract displayUrl(path: string): Promise<string>;
  /** A URL the WebView can display for a temporary scan, before it is saved. */
  abstract previewUrl(temporaryUri: string): Promise<string>;
  /** The absolute file URI native plugins need (OCR, share sheet). */
  abstract resolveUri(path: string): Promise<string>;
  abstract read(path: string): Promise<Uint8Array>;
  abstract write(receiptId: string, bytes: Uint8Array): Promise<string>;
  /** Deletes every stored photo not in `paths` (cleanup after a restore). */
  abstract retainOnly(paths: readonly string[]): Promise<void>;
  abstract usedBytes(): Promise<number>;
}
