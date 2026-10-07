import { describe, expect, it } from 'vitest';
import { type DateOrder, readReceipt } from './receipt-reader';
import { doubtfulFieldsOf } from './receipt-reading';

const now = new Date(2026, 9, 6, 18, 0);
const read = (text: string, dateOrder: DateOrder = 'MDY') => readReceipt(text, { dateOrder, now });

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

  it('marks every required field doubtful on an empty scan', () => {
    expect(doubtfulFieldsOf(read(''))).toEqual(['store', 'date', 'total']);
  });
});
