/** Port: on-device OCR. No image ever leaves the phone. */
export abstract class TextRecognizer {
  abstract readonly isAvailable: boolean;
  /** Starts loading the engine ahead of time, e.g. while the person picks a photo. */
  warmUp(): void {
    // Nothing to load for engines built into the phone.
  }
  abstract recognize(imageUri: string): Promise<string>;
}
