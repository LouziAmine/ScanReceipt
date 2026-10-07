export interface ShareableFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly data: Uint8Array | string;
}

/** Port: hands a file to the system share sheet (email, Drive, Files, iCloud…). */
export abstract class FileSharer {
  abstract shareFile(file: ShareableFile, title: string): Promise<void>;
  abstract shareStoredImage(path: string, title: string): Promise<void>;
  abstract copyText(text: string): Promise<void>;
}
