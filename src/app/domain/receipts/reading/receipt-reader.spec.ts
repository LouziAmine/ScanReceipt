import { describe, expect, it } from 'vitest';
import { type DateOrder, readReceipt } from './receipt-reader';
import { doubtfulFieldsOf } from './receipt-reading';

const now = new Date(2026, 9, 6, 18, 0);
const read = (text: string, dateOrder: DateOrder = 'MDY') =>
  readReceipt(text, { dateOrder, now, currency: 'USD' });

const BAKERY = `SUNRISE BAKERY
123 Main Street
Tel 555-201-3344
10/06/2026 1:42 PM
Sourdough loaf x1 ...... 7.50
Croissant x2 ........... 6.07
SUBTOTAL 13.57
SALES TAX 1.18
TOTAL .................. 14.75
VISA **** 4421`;

describe('readReceipt', () => {
  it('reads a clean receipt with high confidence', () => {
    const reading = read(BAKERY);
    expect(reading.store).toEqual({ value: 'Sunrise Bakery', confidence: 'high' });
    expect(reading.totalCents).toEqual({ value: 1475, confidence: 'high' });
    expect(reading.taxCents).toEqual({ value: 118, confidence: 'high' });
    expect(reading.purchasedAt.value).toEqual(new Date(2026, 9, 6, 13, 42));
    expect(doubtfulFieldsOf(reading)).toEqual([]);
  });

  it('prefers "Amount due" over other totals and ignores the subtotal', () => {
    expect(
      read('CORNER CAFE\nSUBTOTAL 9.00\nTOTAL 9.50\nAMOUNT DUE 9.50\nCASH 20.00').totalCents.value,
    ).toBe(950);
  });

  it('flags a total whose digits had to be repaired', () => {
    const reading = read('CORNER CAFE\n10/06/2026\nTOTAL $ B.85');
    expect(reading.totalCents).toMatchObject({ value: 885, confidence: 'low' });
    expect(doubtfulFieldsOf(reading)).toContain('total');
  });

  it('falls back to the largest amount, with low confidence, when no total line exists', () => {
    expect(read('METRO GAS\n10/05/2026\n12.40\n42.10\n3.00').totalCents).toMatchObject({
      value: 4210,
      confidence: 'low',
    });
  });

  it('reads the total on the line after the label', () => {
    expect(read('SHOP\nTOTAL\n27.50').totalCents.value).toBe(2750);
  });

  it('does not take a quantity for a thousands group', () => {
    expect(read('SHOP\nx2 147.50\nTOTAL 147.50').totalCents.value).toBe(14750);
  });

  it('does not take a "total incl. tax" line as the tax', () => {
    const reading = read('SHOP\nTOTAL (INCL. TAX) 14.75');
    expect(reading.taxCents.confidence).toBe('missing');
    expect(reading.totalCents.value).toBe(1475);
  });

  it('handles European amounts and day-first dates', () => {
    const reading = read('BOULANGERIE PAUL\n24/09/2026 08:15\nTOTAL TTC 1.234,50', 'DMY');
    expect(reading.totalCents.value).toBe(123450);
    expect(reading.purchasedAt.value).toEqual(new Date(2026, 8, 24, 8, 15));
  });

  it('settles the order of a numeric date when one part is above 12', () => {
    expect(read('SHOP\n24/09/2026\nTOTAL 1.00').purchasedAt.value).toEqual(
      new Date(2026, 8, 24, 12, 0),
    );
  });

  it('reads dates written with a month name', () => {
    expect(read('SHOP\nSep 28, 2026\nTOTAL 18.99').purchasedAt.value).toEqual(
      new Date(2026, 8, 28, 12, 0),
    );
  });

  it('rejects dates in the future', () => {
    expect(read('SHOP\n12/25/2026\nTOTAL 1.00').purchasedAt.confidence).toBe('missing');
  });

  it('skips header noise to find the store', () => {
    expect(read('*** RECEIPT ***\nWelcome!\nPAGE & INK BOOKS\nTOTAL 27.50').store).toMatchObject({
      value: 'Page & Ink Books',
      confidence: 'low',
    });
  });

  // The texts below are what the browser OCR (Tesseract.js) read on real receipts.
  it('reads a German receipt: SUMME is the total, SUMME MWST the tax', () => {
    const reading = read(
      'a pA AAR in\n~ SCHWEINFURT\nBAUCHSPECK 1,19\nL&M BLUE 3,50\nSUMME FUR 14,84 *\n' +
        'BAR, 0 50,00\nRUCKGELD EUR 35,16\n19,00 % 1,28 6,71\nSUMME MST 1,73 13k',
      'DMY',
    );
    expect(reading.totalCents).toEqual({ value: 1484, confidence: 'high' });
    expect(reading.taxCents).toEqual({ value: 173, confidence: 'high' });
    expect(reading.store.value).toBe('Schweinfurt');
  });

  it('reads a Polish receipt: SUMA PLN is the total, not the amount paid', () => {
    const reading = read(
      'CA5TORAMA POLSKA Sp. z 0.0\n02-255 IARSZAWA ul.Krakowiakow 78\nPARAGON FISKALNY\n' +
        'Sprzed. opod. PTU A 61,96\nKwota PTU A 23,00% 11,59\nSUMA PTU 11,59\nSUMA PLN 61,96\n' +
        'Ptatnosé Gotowka 62,00\nWptacono razem 62,00\n2021-09-23 20:27',
    );
    expect(reading.totalCents.value).toBe(6196);
    expect(reading.taxCents.value).toBe(1159);
    expect(reading.store.value).toBe('CA5TORAMA POLSKA Sp. z 0.0');
    expect(reading.purchasedAt.value).toEqual(new Date(2021, 8, 23, 20, 27));
  });

  it('reads a whole total in a currency without cents', () => {
    const reading = read(
      'PT. LANCAR WIGUNA SEJAHTERA\nNPWP : 845037704416000\nLW S CARB TRFLE 1 15,000 15,000\n' +
        'Total Disc. 2,000\nTotal Belanja 13,000\nKembalian 0',
    );
    expect(reading.totalCents).toEqual({ value: 1_300_000, confidence: 'high' });
    expect(reading.store.value).toBe('Pt. Lancar Wiguna Sejahtera');
  });

  it('skips a logo read as fragments and a line of long numbers', () => {
    expect(read('BAM mou,\nToe 50817 Theos febllar\nTOTAL 2.18').store.confidence).toBe('missing');
  });

  it('marks every required field doubtful on an empty scan', () => {
    expect(doubtfulFieldsOf(read(''))).toEqual(['store', 'date', 'total']);
  });
});

describe('readReceipt currency', () => {
  it('reads the currency with the other fields', () => {
    expect(read('BOULANGERIE\nTOTAL TTC 12,50 €').currency).toEqual({
      value: 'EUR',
      confidence: 'high',
    });
  });
});
