import { computed, signal } from '@angular/core';
import { type Language, type MessageParams, fillMessage } from '@domain';

/** Plural forms of one text, by `Intl.PluralRules` category. `other` is always given. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { readonly other: string };

/**
 * English source text -> its translation. English texts are the keys (as with gettext), so a
 * text without a translation falls back to English, and domain messages need no ids.
 */
export type Translations = Readonly<Record<string, string | PluralForms>>;

/** Locale for dates and numbers. Arabic keeps Western digits, as on receipts. */
const LOCALES: Readonly<Record<Language, string>> = {
  en: 'en',
  fr: 'fr',
  ar: 'ar-u-nu-latn',
  zh: 'zh-CN',
  es: 'es',
  de: 'de',
  pt: 'pt',
};

/** Each language in its own name, for the language picker. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
  zh: '中文（简体）',
  es: 'Español',
  de: 'Deutsch',
  pt: 'Português',
};

/** Translations are separate chunks: only the chosen language is downloaded. */
const LOADERS: Readonly<Record<Exclude<Language, 'en'>, () => Promise<Translations>>> = {
  fr: () => import('./translations/fr').then((m) => m.fr),
  ar: () => import('./translations/ar').then((m) => m.ar),
  zh: () => import('./translations/zh').then((m) => m.zh),
  es: () => import('./translations/es').then((m) => m.es),
  de: () => import('./translations/de').then((m) => m.de),
  pt: () => import('./translations/pt').then((m) => m.pt),
};

interface State {
  readonly language: Language;
  readonly translations: Translations;
  readonly plurals: Intl.PluralRules;
}

const state = signal<State>({
  language: 'en',
  translations: {},
  plurals: new Intl.PluralRules('en'),
});

/** The language of the screens. Templates that read it update when it changes. */
export const currentLanguage = computed(() => state().language);

/** "fr", "ar-u-nu-latn"… for `Intl` formatters. */
export function locale(): string {
  return LOCALES[state().language];
}

/** `text` in the current language, with its `{name}` placeholders filled. */
export function t(text: string, params?: MessageParams): string {
  const value = state().translations[text];
  const template = value === undefined ? text : typeof value === 'string' ? value : value.other;
  return fillMessage(template, params);
}

/** "{count} receipt" or "{count} receipts", following the plural rules of the language. */
export function tp(count: number, one: string, other: string, params?: MessageParams): string {
  const { translations, plurals } = state();
  const values = { count, ...params };
  const value = translations[other];
  if (value === undefined) return fillMessage(count === 1 ? one : other, values);
  if (typeof value === 'string') return fillMessage(value, values);
  return fillMessage(value[plurals.select(count)] ?? value.other, values);
}

/**
 * In a right-to-left language, keeps Latin codes like "US$" or "CA$" in their own
 * left-to-right run; otherwise the bidi algorithm shows "$US".
 */
export function isolateLatin(text: string): string {
  return state().language === 'ar' ? text.replace(/[A-Za-z]+\S*/g, '\u2066$&\u2069') : text;
}

/** Marks a text for translation where it is written; `t` translates it where it is shown. */
export function marker<T extends string>(text: T): T {
  return text;
}

let latestRequest = 0;

/** Loads a language and switches every screen to it; Arabic also turns the layout right-to-left. */
export async function useLanguage(language: Language): Promise<void> {
  const request = ++latestRequest;
  const translations = language === 'en' ? {} : await LOADERS[language]();
  if (request !== latestRequest) return;
  state.set({ language, translations, plurals: new Intl.PluralRules(LOCALES[language]) });
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}
