import { Injectable } from '@angular/core';
import { TextRecognizer } from '@application';
import { Capacitor } from '@capacitor/core';
import { Script, TextRecognition } from '@capacitor-mlkit/text-recognition';

/** Adapter: Google ML Kit text recognition, on-device on both iOS and Android. */
@Injectable()
export class MlKitTextRecognizer extends TextRecognizer {
  readonly isAvailable = Capacitor.isNativePlatform();

  async recognize(imageUri: string): Promise<string> {
    const result = await TextRecognition.processImage({ path: imageUri, script: Script.Latin });
    return result.text;
  }
}
