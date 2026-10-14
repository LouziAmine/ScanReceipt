import { Directory, Filesystem } from '@capacitor/filesystem';
import { bytesToBase64 } from '../shared/bytes';

/**
 * Temporary images written by the app itself (browser imports) live in the cache
 * directory and are addressed as `cache://<path>`; native scanners return `file://` URIs.
 */
export const CACHE_SCHEME = 'cache://';

export async function writeTemporaryImage(bytes: Uint8Array): Promise<string> {
  const path = `scans/${Date.now()}.jpg`;
  await Filesystem.writeFile({
    path,
    data: bytesToBase64(bytes),
    directory: Directory.Cache,
    recursive: true,
  });
  return `${CACHE_SCHEME}${path}`;
}
