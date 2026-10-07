import { Injectable } from '@angular/core';
import { FilePicker, type PickedFile } from '@application';
import { FilePicker as NativePicker } from '@capawesome/capacitor-file-picker';
import { base64ToBytes } from '../shared/bytes';

/** Adapter: the system document picker (Files, iCloud Drive, Google Drive…). */
@Injectable()
export class CapawesomeFilePicker extends FilePicker {
  async pickBackup(): Promise<PickedFile | null> {
    try {
      const { files } = await NativePicker.pickFiles({
        types: ['application/zip', 'application/x-zip-compressed'],
        limit: 1,
        readData: true,
      });
      const file = files[0];
      if (!file) return null;
      const bytes = file.data
        ? base64ToBytes(file.data)
        : new Uint8Array(await (file.blob ?? new Blob()).arrayBuffer());
      return { name: file.name, bytes };
    } catch (error: unknown) {
      if (error instanceof Error && /cancel/i.test(error.message)) return null;
      throw error;
    }
  }
}
