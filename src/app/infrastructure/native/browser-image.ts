import { type ImageQuality } from '@domain';

/**
 * Pixel budget per quality: about 8 MP ("high") or 4 MP ("standard"). An area limit, not a
 * side limit, so long receipts keep their full height and stay readable.
 */
const MAX_PIXELS: Readonly<Record<ImageQuality, number>> = {
  high: 8_000_000,
  standard: 4_000_000,
};
const JPEG_QUALITY: Readonly<Record<ImageQuality, number>> = { high: 0.9, standard: 0.8 };

/**
 * Browser imports: decodes any image the browser can open (JPEG, PNG, WebP, GIF, BMP…),
 * shrinks very large photos and re-encodes them as JPEG, the only format the rest of the
 * app stores, exports and puts in PDFs. Resolves null when the file is not a readable image.
 */
export async function toJpeg(file: Blob, quality: ImageQuality): Promise<Uint8Array | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS[quality] / (bitmap.width * bitmap.height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    // Transparent PNGs would turn black in a JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY[quality]);
    });
    return jpeg ? new Uint8Array(await jpeg.arrayBuffer()) : null;
  } finally {
    bitmap.close();
  }
}
