import { Injectable, inject } from '@angular/core';
import { FileSharer, ImageStore, type ShareableFile } from '@application';
import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { bytesToBase64 } from '../shared/bytes';

/** Adapter: the native share sheet; the browser downloads the file instead. */
@Injectable()
export class CapacitorFileSharer extends FileSharer {
  private readonly images = inject(ImageStore);
  private readonly native = Capacitor.isNativePlatform();

  async shareFile(file: ShareableFile, title: string): Promise<void> {
    if (!this.native) {
      download(file);
      return;
    }
    const path = `exports/${file.fileName}`;
    await Filesystem.writeFile({
      path,
      directory: Directory.Cache,
      recursive: true,
      ...(typeof file.data === 'string'
        ? { data: file.data, encoding: Encoding.UTF8 }
        : { data: bytesToBase64(file.data) }),
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await this.openShareSheet(uri, title);
  }

  async shareStoredImage(path: string, title: string): Promise<void> {
    if (!this.native) {
      download({
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg',
        data: await this.images.read(path),
      });
      return;
    }
    await this.openShareSheet(await this.images.resolveUri(path), title);
  }

  async copyText(text: string): Promise<void> {
    await Clipboard.write({ string: text });
  }

  private async openShareSheet(uri: string, title: string): Promise<void> {
    try {
      await Share.share({ title, dialogTitle: title, files: [uri] });
    } catch (error: unknown) {
      // Closing the share sheet is a normal choice, not an error.
      if (!(error instanceof Error && /cancel/i.test(error.message))) throw error;
    }
  }
}

function download(file: ShareableFile): void {
  const blob = new Blob([file.data as BlobPart], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}
