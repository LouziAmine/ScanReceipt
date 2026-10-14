import { Injectable } from '@angular/core';
import { TextRecognizer } from '@application';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { Worker } from 'tesseract.js';
import { fileDataToBytes } from '../shared/bytes';
import { CACHE_SCHEME } from './temporary-files';

/**
 * Below this mean confidence (0-100) the photo is probably sideways: measured on real
 * receipts, upright ones score 55-93 and sideways ones 20-50.
 */
const UPRIGHT_CONFIDENCE = 60;
/** Size of the quick passes that only decide which way up the photo is. */
const PROBE_PIXELS = 1_000_000;

/**
 * Adapter: Tesseract.js (WebAssembly) for the browser, where ML Kit does not exist.
 * The engine and the English model (about 6 MB) are served with the app from `assets/ocr`,
 * loaded on the first scan and kept by the browser: no image or text leaves the device.
 */
@Injectable()
export class TesseractTextRecognizer extends TextRecognizer {
  readonly isAvailable = true;
  private worker: Promise<Worker> | null = null;

  override warmUp(): void {
    // A failed download is reported by the scan itself, which tries again.
    this.engine().catch(() => undefined);
  }

  async recognize(imageUri: string): Promise<string> {
    const worker = await this.engine();
    const image = new Blob([(await readImage(imageUri)) as BlobPart]);
    const upright = (await worker.recognize(image)).data;
    if (upright.confidence >= UPRIGHT_CONFIDENCE) return upright.text;

    // Browser photos are not straightened like the phone scanner's. Find which way up the
    // photo is on small copies (fast), then read it once at full size that way up.
    const confidences = new Map<0 | 90 | 270, number>();
    for (const degrees of [0, 90, 270] as const) {
      const { data } = await worker.recognize(await prepare(image, degrees, PROBE_PIXELS));
      confidences.set(degrees, data.confidence);
    }
    const best = [...confidences].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    if (best === 0) return upright.text;
    return (await worker.recognize(await prepare(image, best))).data.text;
  }

  private engine(): Promise<Worker> {
    this.worker ??= startWorker().catch((error: unknown) => {
      // Let the next scan try again (e.g. after a network hiccup on the first download).
      this.worker = null;
      throw error;
    });
    return this.worker;
  }
}

async function startWorker(): Promise<Worker> {
  // CommonJS package: its exports are under `default` once bundled.
  const { createWorker, OEM } = (await import('tesseract.js')).default;
  const base = new URL('assets/ocr/', document.baseURI).href;
  return createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    workerBlobURL: false,
  });
}

async function readImage(imageUri: string): Promise<Uint8Array> {
  const { data } = imageUri.startsWith(CACHE_SCHEME)
    ? await Filesystem.readFile({
        path: imageUri.slice(CACHE_SCHEME.length),
        directory: Directory.Cache,
      })
    : await Filesystem.readFile({ path: imageUri });
  return fileDataToBytes(data);
}

/** Turns the photo by a quarter turn, shrunk to at most `maxPixels`. */
async function prepare(image: Blob, degrees: 0 | 90 | 270, maxPixels = Infinity): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    const scale = Math.min(1, Math.sqrt(maxPixels / (bitmap.width * bitmap.height)));
    if (scale === 1 && degrees === 0) return image;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const sideways = degrees !== 0;
    const canvas = document.createElement('canvas');
    canvas.width = sideways ? height : width;
    canvas.height = sideways ? width : height;
    const context = canvas.getContext('2d');
    if (!context) return image;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((degrees * Math.PI) / 180);
    context.drawImage(bitmap, -width / 2, -height / 2, width, height);
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob ?? image);
      }, 'image/jpeg');
    });
  } finally {
    bitmap.close();
  }
}
