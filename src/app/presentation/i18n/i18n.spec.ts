import { afterEach, describe, expect, it } from 'vitest';
import { currentLanguage, isolateLatin, locale, t, tp, useLanguage } from './i18n';

describe('i18n', () => {
  afterEach(async () => {
    await useLanguage('en');
  });

  it('shows English source texts as they are, with their placeholders filled', () => {
    expect(t('Receipt from {store}', { store: 'Marjane' })).toBe('Receipt from Marjane');
    expect(tp(1, '{count} receipt', '{count} receipts')).toBe('1 receipt');
    expect(tp(3, '{count} receipt', '{count} receipts')).toBe('3 receipts');
  });

  it('translates into the chosen language and falls back to English for unknown texts', async () => {
    await useLanguage('fr');
    expect(currentLanguage()).toBe('fr');
    expect(t('Cancel')).toBe('Annuler');
    expect(t('Receipt from {store}', { store: 'Carrefour' })).toBe('Reçu de Carrefour');
    expect(t('A text nobody translated')).toBe('A text nobody translated');
    expect(tp(1, '{count} receipt', '{count} receipts')).toBe('1 reçu');
    expect(tp(4, '{count} receipt', '{count} receipts')).toBe('4 reçus');
  });

  it('follows the Arabic plural rules and turns the layout right-to-left', async () => {
    await useLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(tp(1, '{count} receipt', '{count} receipts')).toBe('إيصال واحد');
    expect(tp(2, '{count} receipt', '{count} receipts')).toBe('إيصالان');
    expect(tp(5, '{count} receipt', '{count} receipts')).toBe('5 إيصالات');
    expect(tp(11, '{count} receipt', '{count} receipts')).toBe('11 إيصالًا');
    // Western digits in dates and amounts, as on receipts.
    expect(locale()).toBe('ar-u-nu-latn');
    expect(new Intl.NumberFormat(locale()).format(1234)).not.toMatch(/[٠-٩]/);
    // "US$" stays one left-to-right run, never "$US".
    expect(isolateLatin('1,234.50 US$')).toBe('1,234.50 \u2066US$\u2069');
  });

  it('switches back to left-to-right', async () => {
    await useLanguage('ar');
    await useLanguage('zh');
    expect(document.documentElement.dir).toBe('ltr');
    expect(tp(3, '{count} receipt', '{count} receipts')).toBe('3 张收据');
  });
});
