import { type ImageQuality } from '@domain';

export interface ScannedDocument {
  /** Temporary file URI of the cropped, de-skewed image. */
  readonly imagePath: string;
}

/**
 * Port: native document capture with edge detection and crop
 * (VisionKit on iOS, ML Kit on Android, a file picker in the browser).
 */
export abstract class DocumentScanner {
  /** Resolves null when the person cancels. */
  abstract scan(quality: ImageQuality): Promise<ScannedDocument | null>;
  /** Uses an existing photo instead of the camera. */
  abstract importFromPhotos(): Promise<ScannedDocument | null>;
}
