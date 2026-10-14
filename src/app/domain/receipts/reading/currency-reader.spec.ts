import { describe, expect, it } from 'vitest';
import { type CurrencyCode } from '../../shared-kernel/money';
import { readCurrency } from './currency-reader';

const currencyOf = (text: string, usual: CurrencyCode = 'USD') =>
  readCurrency(text.split('\n'), usual);

describe('readCurrency', () => {
  it.each<[string, CurrencyCode]>([
    ['TOTAL TTC 12,50 €', 'EUR'],
    ['TOTAL EUR 12.50', 'EUR'],
    ['TOTAL 12,50 EUROS', 'EUR'],
    ['TOTAL £14.75', 'GBP'],
    ['TOTAL CHF 14.75', 'CHF'],
    ['TOTAL 89.90 MAD', 'MAD'],
    ['المجموع 40,00 د.م.', 'MAD'],
    ['TOTAL 40,00 د.إ', 'AED'],
    ['الإجمالي 115.00 ر.س', 'SAR'],
    ['TOTAL 23,500 د.ت', 'TND'],
    ['TOTAL ₹ 450.00', 'INR'],
    ['TOPLAM 245,90 ₺', 'TRY'],
    ['TOPLAM 245,90 TRY', 'TRY'],
    ['ИТОГО 1 250,00 ₽', 'RUB'],
    ['ИТОГО 1 250,00 руб.', 'RUB'],
    ['SUMA PLN 45,99', 'PLN'],
    ['SUMA 45,99 zł', 'PLN'],
    ['CELKEM 245,00 Kč', 'CZK'],
    ['ÖSSZESEN 4 590 Ft', 'HUF'],
    ['TOTAL 45,00 lei', 'RON'],
    ['합계 ₩12,000', 'KRW'],
    ['合計 1,300円', 'JPY'],
    ['合计 ¥45.00 RMB', 'CNY'],
    ['TOTAL ₱ 350.00', 'PHP'],
    ['TỔNG 125.000 ₫', 'VND'],
    ['סה"כ 89.90 ₪', 'ILS'],
    ['รวม 250.00 ฿', 'THB'],
    ['TOTAL ₦ 5,000.00', 'NGN'],
    ['TOTAL Rp 13.000', 'IDR'],
    ['JUMLAH RM 25.90', 'MYR'],
    ['TOTAL KSh 1,200.00', 'KES'],
    ['TOTAL R 149.99', 'ZAR'],
    ['TOTAL R$ 49,90', 'BRL'],
    ['TOTAL S/ 35.00', 'PEN'],
    ['TOTAL 2 500 FCFA', 'XOF'],
    ['TOTAL C$14.75', 'CAD'],
    ['TOTAL A$14.75', 'AUD'],
    ['TOTAL US$14.75', 'USD'],
    ['TOTAL HK$ 88.00', 'HKD'],
    ['TOTAL S$ 12.50', 'SGD'],
    ['TOTAL NZ$ 30.00', 'NZD'],
    ['TOTAL MX$ 250.00', 'MXN'],
    ['TOTAL 14.75 JPY', 'JPY'],
    ['TOTAL 450.00 PKR', 'PKR'],
  ])('reads "%s" as %s', (text, currency) => {
    expect(currencyOf(text).value).toBe(currency);
  });

  it('reads a sign used by one currency with high confidence', () => {
    expect(currencyOf('TOTAL ₹ 450.00')).toEqual({ value: 'INR', confidence: 'high' });
  });

  it("reads a shared sign as the person's currency when it is one of them", () => {
    expect(currencyOf('TOTAL $14.75', 'CAD')).toEqual({ value: 'CAD', confidence: 'high' });
    expect(currencyOf('TOTAL $14.75', 'MXN')).toEqual({ value: 'MXN', confidence: 'high' });
    expect(currencyOf('TOTAL 125,00 DH', 'MAD')).toEqual({ value: 'MAD', confidence: 'high' });
    expect(currencyOf('TOTAL 125,00 DH', 'AED')).toEqual({ value: 'AED', confidence: 'high' });
    expect(currencyOf('SUMMA 249,00 kr', 'NOK')).toEqual({ value: 'NOK', confidence: 'high' });
    expect(currencyOf('合計 ¥1,300', 'JPY')).toEqual({ value: 'JPY', confidence: 'high' });
  });

  it('guesses the most common currency for a shared sign, with a hint', () => {
    expect(currencyOf('TOTAL $14.75', 'EUR')).toEqual({
      value: 'USD',
      confidence: 'low',
      hint: '"{sign}" is used by several currencies, please check',
      hintParams: { sign: '$' },
    });
    expect(currencyOf('SUMMA 249,00 kr', 'EUR')).toMatchObject({ value: 'SEK', confidence: 'low' });
    expect(currencyOf('TOTAL 125,00 DHS', 'EUR')).toMatchObject({
      value: 'MAD',
      confidence: 'low',
    });
  });

  it('flags a receipt that names several currencies', () => {
    expect(currencyOf('TOTAL 12,00 €\nSOIT 130,00 MAD\nPAYE EUR 12,00')).toMatchObject({
      value: 'EUR',
      confidence: 'low',
      hint: 'Several currencies appear on this receipt, please check',
    });
  });

  it('is missing when the receipt names no currency', () => {
    expect(currencyOf('SHOP\nTOTAL 14.75')).toEqual({ value: null, confidence: 'missing' });
  });

  it('does not take words for currency codes', () => {
    for (const text of [
      'MADE IN FRANCE\nEUROPA PARK\nTOTAL 14.75',
      'ALL ITEMS\nTOTAL 14.75',
      'TRY OUR NEW MENU\nTOTAL 14.75',
      'TOP SELLER\nPEN BLUE x2 3.50',
      'APPLES 1.2 KGS\nTOTAL 14.75',
      'ILS SONT LA\nTOTAL 14.75',
      'SERVICE SVC\nTOTAL 14.75',
      'R0012345\nREF R 2024\nTOTAL 14.75',
    ]) {
      expect(currencyOf(text).value, text).toBeNull();
    }
  });

  it('does not take Arabic words containing the letters of an abbreviation', () => {
    expect(currencyOf('خدمة العملاء\nالمجموع 14.75').value).toBeNull();
  });
});
