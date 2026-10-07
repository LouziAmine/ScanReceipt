/** Port: on-device OCR. No image ever leaves the phone. */
export abstract class TextRecognizer {
  abstract readonly isAvailable: boolean;
  abstract recognize(imageUri: string): Promise<string>;
}
