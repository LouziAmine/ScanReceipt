import { locale } from './i18n';

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** A date formatter in the language of the screens, created once per language and options. */
export function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale()}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale(), options);
    dateFormats.set(key, format);
  }
  return format;
}
