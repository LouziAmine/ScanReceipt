/** Lower-case, accent-free, alphanumeric key used to compare names. */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "GREENWAY GROCERY" -> "Greenway Grocery"; mixed-case text is kept as is. */
export function toDisplayCase(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed !== trimmed.toUpperCase()) {
    return trimmed;
  }
  return trimmed
    .toLowerCase()
    .replace(
      /(^|[\s&'-])(\p{L})/gu,
      (_match, separator: string, letter: string) => separator + letter.toUpperCase(),
    );
}
