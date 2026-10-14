export interface PickedFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export abstract class FilePicker {
  /** Resolves null when the person cancels. */
  abstract pickBackup(): Promise<PickedFile | null>;
}
