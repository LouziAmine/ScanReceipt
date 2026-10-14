import { Injectable } from '@angular/core';
import { AppError, DocumentScanner, type ScannedDocument } from '@application';
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
import { toJpeg } from './browser-image';
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
      return this.importFromPhotos(quality);
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

  async importFromPhotos(quality: ImageQuality): Promise<ScannedDocument | null> {
    try {
      const { files } = await FilePicker.pickImages({ limit: 1, readData: !this.native });
      const file = files[0];
      if (!file) return null;
      if (this.native && file.path) {
        return { imagePath: file.path };
      }
      const blob = file.data
        ? new Blob([base64ToBytes(file.data) as BlobPart], { type: file.mimeType })
        : (file.blob ?? new Blob());
      const jpeg = await toJpeg(blob, quality);
      if (!jpeg) {
        throw new AppError('This file cannot be opened as a photo. Choose another image.');
      }
      return { imagePath: await writeTemporaryImage(jpeg) };
    } catch (error: unknown) {
      if (isCancellation(error)) return null;
      throw error;
    }
  }
}

function isCancellation(error: unknown): boolean {
  return error instanceof Error && /cancel/i.test(error.message);
}
