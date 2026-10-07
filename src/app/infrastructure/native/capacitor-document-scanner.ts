import { Injectable } from '@angular/core';
import { DocumentScanner, type ScannedDocument } from '@application';
import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import {
  DocumentScanner as NativeScanner,
  ResponseType,
  ScanDocumentResponseStatus,
  ScannerMode,
} from '@capgo/capacitor-document-scanner';
import { type ImageQuality } from '@domain';
import { base64ToBytes } from '../shared/bytes';
import { writeTemporaryImage } from './temporary-files';

/**
 * Adapter: VisionKit (iOS) and ML Kit Document Scanner (Android) give edge detection,
 * perspective correction, crop and filters natively. The browser falls back to a file picker.
 */
@Injectable()
export class CapacitorDocumentScanner extends DocumentScanner {
  private readonly native = Capacitor.isNativePlatform();

  async scan(quality: ImageQuality): Promise<ScannedDocument | null> {
    if (!this.native) {
      return this.importFromPhotos();
    }
    const result = await NativeScanner.scanDocument({
      maxNumDocuments: 1,
      responseType: ResponseType.ImageFilePath,
      croppedImageQuality: quality === 'high' ? 95 : 80,
      letUserAdjustCrop: true,
      scannerMode: ScannerMode.Full,
    });
    const imagePath = result.scannedImages?.[0];
    if (result.status === ScanDocumentResponseStatus.Cancel || !imagePath) {
      return null;
    }
    return { imagePath };
  }

  async importFromPhotos(): Promise<ScannedDocument | null> {
    try {
      const { files } = await FilePicker.pickImages({ limit: 1, readData: !this.native });
      const file = files[0];
      if (!file) return null;
      if (this.native && file.path) {
        return { imagePath: file.path };
      }
      const bytes = file.data
        ? base64ToBytes(file.data)
        : new Uint8Array(await (file.blob ?? new Blob()).arrayBuffer());
      return { imagePath: await writeTemporaryImage(bytes) };
    } catch (error: unknown) {
      if (isCancellation(error)) return null;
      throw error;
    }
  }
}

function isCancellation(error: unknown): boolean {
  return error instanceof Error && /cancel/i.test(error.message);
}
