import { Injectable } from '@angular/core';
import { ImageStore } from '@application';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { bytesToBase64, fileDataToBytes } from '../shared/bytes';
import { CACHE_SCHEME } from './temporary-files';

const FOLDER = 'receipts';
const DIRECTORY = Directory.Data;

/**
 * Adapter: photos in the app's private data directory (excluded from nothing, backed up by
 * the OS on iOS). Each version of a photo gets a new file name so the WebView never shows
 * a cached older image.
 */
@Injectable()
export class FilesystemImageStore extends ImageStore {
  private readonly native = Capacitor.isNativePlatform();
  private folderReady: Promise<void> | null = null;

  async persist(temporaryUri: string, receiptId: string): Promise<string> {
    await this.ensureFolder();
    const path = this.newPath(receiptId);
    if (temporaryUri.startsWith(CACHE_SCHEME)) {
      await Filesystem.copy({
        from: temporaryUri.slice(CACHE_SCHEME.length),
        directory: Directory.Cache,
        to: path,
        toDirectory: DIRECTORY,
      });
    } else {
      await Filesystem.copy({ from: temporaryUri, to: path, toDirectory: DIRECTORY });
    }
    return path;
  }

  async remove(path: string): Promise<void> {
    if (!path) return;
    try {
      await Filesystem.deleteFile({ path, directory: DIRECTORY });
    } catch {
      // Already gone: nothing to do.
    }
  }

  async displayUrl(path: string): Promise<string> {
    if (this.native) {
      return Capacitor.convertFileSrc(await this.resolveUri(path));
    }
    const { data } = await Filesystem.readFile({ path, directory: DIRECTORY });
    return typeof data === 'string' ? `data:image/jpeg;base64,${data}` : URL.createObjectURL(data);
  }

  async previewUrl(temporaryUri: string): Promise<string> {
    if (!temporaryUri.startsWith(CACHE_SCHEME)) {
      return Capacitor.convertFileSrc(temporaryUri);
    }
    const { data } = await Filesystem.readFile({
      path: temporaryUri.slice(CACHE_SCHEME.length),
      directory: Directory.Cache,
    });
    return typeof data === 'string' ? `data:image/jpeg;base64,${data}` : URL.createObjectURL(data);
  }

  async resolveUri(path: string): Promise<string> {
    return (await Filesystem.getUri({ path, directory: DIRECTORY })).uri;
  }

  async read(path: string): Promise<Uint8Array> {
    const { data } = await Filesystem.readFile({ path, directory: DIRECTORY });
    return fileDataToBytes(data);
  }

  async write(receiptId: string, bytes: Uint8Array): Promise<string> {
    await this.ensureFolder();
    const path = this.newPath(receiptId);
    await Filesystem.writeFile({ path, data: bytesToBase64(bytes), directory: DIRECTORY });
    return path;
  }

  async retainOnly(paths: readonly string[]): Promise<void> {
    const keep = new Set(paths);
    const files = await this.list();
    await Promise.allSettled(
      files
        .filter((file) => !keep.has(`${FOLDER}/${file.name}`))
        .map((file) =>
          Filesystem.deleteFile({ path: `${FOLDER}/${file.name}`, directory: DIRECTORY }),
        ),
    );
  }

  async usedBytes(): Promise<number> {
    return (await this.list()).reduce((total, file) => total + file.size, 0);
  }

  private newPath(receiptId: string): string {
    return `${FOLDER}/${receiptId}-${Date.now().toString(36)}.jpg`;
  }

  private async list(): Promise<{ name: string; size: number }[]> {
    try {
      const { files } = await Filesystem.readdir({ path: FOLDER, directory: DIRECTORY });
      return files.filter((f) => f.type === 'file').map((f) => ({ name: f.name, size: f.size }));
    } catch {
      return [];
    }
  }

  private ensureFolder(): Promise<void> {
    this.folderReady ??= Filesystem.mkdir({
      path: FOLDER,
      directory: DIRECTORY,
      recursive: true,
    }).catch(() => undefined);
    return this.folderReady;
  }
}
