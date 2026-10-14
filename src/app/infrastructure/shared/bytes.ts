/** Base64 <-> bytes, chunked so large photos do not overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(',') ? (base64.split(',')[1] ?? '') : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Filesystem.readFile returns base64 on devices and a Blob in the browser. */
export async function fileDataToBytes(data: string | Blob): Promise<Uint8Array> {
  return typeof data === 'string' ? base64ToBytes(data) : new Uint8Array(await data.arrayBuffer());
}
