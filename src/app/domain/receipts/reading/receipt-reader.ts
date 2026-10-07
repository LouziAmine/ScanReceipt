import { parseAmount } from '../../shared-kernel/money';
import { toDisplayCase } from '../../shared-kernel/text';
import { type ReadField, type ReceiptReading } from './receipt-reading';

/** Order of day, month and year in numeric dates the person is used to. */
export type DateOrder = 'MDY' | 'DMY' | 'YMD';

export interface ReadOptions {
  readonly dateOrder: DateOrder;
  readonly now: Date;
}

/** Characters OCR engines commonly confuse with digits inside an amount. */
const OCR_DIGIT_CONFUSIONS: Readonly<Record<string, string>> = {
  O: '0',
  o: '0',
  D: '0',
  I: '1',
  l: '1',
  '|': '1',
  S: '5',
  B: '8',
  Z: '2',
};

const AMOUNT_TOKEN =
  /-?(?:[$€£]\s?)?[\dOoDIlSBZ|]{1,3}(?:[,.][\dOoDIlSBZ|]{3})*[.,][\dOoDIlSBZ|]{2}(?!\d)/g;

const TOTAL_PRIORITY: readonly RegExp[] = [
  /\b(GRAND\s*TOTAL|AMOUNT\s*DUE|BALANCE\s*DUE|TOTAL\s*DUE|TOTAL\s*TTC|NET\s*A\s*PAYER)\b/,
  /\bTOTAL\b/,
];
const NOT_TOTAL =
  /SUB\s*-?\s*TOTAL|TOTAL\s*TAX|TAX\s*TOTAL|TOTAL\s*HT|TOTAL\s*ITEMS?|TOTAL\s*SAVINGS|YOU\s*SAVED|NUMBER\s*OF/;
const TAX_LINE = /\b(SALES\s*TAX|TAX|VAT|TVA|GST|HST|PST)\b/;
const NOT_TAX = /TAX\s*ID|PRE-?TAX|TAX\s*EXEMPT|EXCL/;
const TAX_TOTAL = /TOTAL\s*TAX|TAX\s*TOTAL/;
const SUBTOTAL_LINE = /SUB\s*-?\s*TOTAL/;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAME = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

const STORE_NOISE =
  /receipt|welcome|thank|invoice|order\s*#|tel|phone|www\.|https?:|\.com|cashier|store\s*#|\b(st|ave|road|rd|blvd|street|suite)\b/i;

interface AmountMatch {
  readonly cents: number;
  readonly repaired: boolean;
}

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly ambiguous: boolean;
}

/**
 * Domain service: turns the raw OCR text of a receipt into a reading with a confidence
 * per field. Pure and deterministic, so it is fully unit-tested.
 */
export function readReceipt(text: string, options: ReadOptions): ReceiptReading {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const total = readTotal(lines);
  return {
    store: readStore(lines),
    purchasedAt: readDate(lines, options),
    totalCents: total,
    taxCents: readTax(lines, total.value),
  };
}

function amountsIn(line: string): AmountMatch[] {
  return (line.match(AMOUNT_TOKEN) ?? []).flatMap((token) => {
    let repaired = false;
    const digits = token.replace(/[OoDIlSBZ|]/g, (char) => {
      repaired = true;
      return OCR_DIGIT_CONFUSIONS[char] ?? char;
    });
    const cents = parseAmount(digits);
    return cents === null ? [] : [{ cents, repaired }];
  });
}

function lastAmountOnOrAfter(lines: readonly string[], index: number): AmountMatch | null {
  for (const candidate of [lines[index], lines[index + 1]]) {
    if (candidate === undefined) continue;
    const last = amountsIn(candidate).at(-1);
    if (last) return last;
  }
  return null;
}

function readTotal(lines: readonly string[]): ReadField<number> {
  const upper = lines.map((line) => line.toUpperCase());

  for (const pattern of TOTAL_PRIORITY) {
    // The last "TOTAL" on a receipt is the amount paid; earlier ones are often sections.
    for (let i = upper.length - 1; i >= 0; i--) {
      const line = upper[i] ?? '';
      if (!pattern.test(line) || NOT_TOTAL.test(line)) continue;
      const match = lastAmountOnOrAfter(lines, i);
      if (!match) continue;
      return match.repaired
        ? {
            value: match.cents,
            confidence: 'low',
            hint: 'Some digits were hard to read, please check this amount',
          }
        : { value: match.cents, confidence: 'high' };
    }
  }

  const largest = lines
    .flatMap(amountsIn)
    .filter((amount) => amount.cents > 0)
    .sort((a, b) => b.cents - a.cents)[0];
  if (largest) {
    return {
      value: largest.cents,
      confidence: 'low',
      hint: 'No "Total" line was found, this is the largest amount',
    };
  }
  return { value: null, confidence: 'missing', hint: 'No total was found' };
}

function readTax(lines: readonly string[], total: number | null): ReadField<number> {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = (lines[i] ?? '').toUpperCase();
    if (!TAX_LINE.test(line) || NOT_TAX.test(line) || SUBTOTAL_LINE.test(line)) continue;
    // "TOTAL (incl. tax)" is the total, not the tax.
    if (/\bTOTAL\b/.test(line) && !TAX_TOTAL.test(line)) continue;
    const match = amountsIn(lines[i] ?? '').at(-1);
    if (!match) continue;
    const implausible = total !== null && match.cents > total;
    return match.repaired || implausible
      ? { value: match.cents, confidence: 'low', hint: 'Low confidence, please check the tax' }
      : { value: match.cents, confidence: 'high' };
  }
  return { value: null, confidence: 'missing' };
}

function readStore(lines: readonly string[]): ReadField<string> {
  for (const [index, line] of lines.slice(0, 6).entries()) {
    const letters = line.replace(/[^\p{L}]/gu, '');
    if (letters.length < 3 || STORE_NOISE.test(line)) continue;
    // Addresses and phone numbers start with digits; a store name rarely does.
    if (/^\d{2,}/.test(line) || /\d{3}[-.\s]\d{3,4}/.test(line)) continue;
    const name = toDisplayCase(line.replace(/[*#=_~]+/g, ' '));
    return index <= 1
      ? { value: name, confidence: 'high' }
      : { value: name, confidence: 'low', hint: 'Please check the store name' };
  }
  return { value: null, confidence: 'missing', hint: 'No store name was found' };
}

function readDate(lines: readonly string[], options: ReadOptions): ReadField<Date> {
  const text = lines.join('\n');
  const time = readTime(text);
  const candidates = [isoDate(text), monthNameDate(text), numericDate(text, options.dateOrder)];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(
      candidate.year,
      candidate.month - 1,
      candidate.day,
      time?.hours ?? 12,
      time?.minutes ?? 0,
    );
    const valid =
      date.getMonth() === candidate.month - 1 &&
      date.getDate() === candidate.day &&
      candidate.year >= 2000 &&
      date.getTime() <= options.now.getTime() + 86_400_000;
    if (!valid) continue;
    return candidate.ambiguous
      ? { value: date, confidence: 'low', hint: 'Day and month could be swapped' }
      : { value: date, confidence: 'high' };
  }
  return { value: null, confidence: 'missing', hint: 'No date was found, today is used' };
}

function isoDate(text: string): DateParts | null {
  const match = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    ambiguous: false,
  };
}

function monthNameDate(text: string): DateParts | null {
  const monthFirst = new RegExp(`\\b${MONTH_NAME}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'i').exec(text);
  if (monthFirst) {
    return {
      year: Number(monthFirst[3]),
      month: monthIndex(monthFirst[1] ?? '') + 1,
      day: Number(monthFirst[2]),
      ambiguous: false,
    };
  }
  const dayFirst = new RegExp(`\\b(\\d{1,2})\\s+${MONTH_NAME},?\\s+(\\d{4})\\b`, 'i').exec(text);
  if (dayFirst) {
    return {
      year: Number(dayFirst[3]),
      month: monthIndex(dayFirst[2] ?? '') + 1,
      day: Number(dayFirst[1]),
      ambiguous: false,
    };
  }
  return null;
}

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase());
}

function numericDate(text: string, order: DateOrder): DateParts | null {
  const match = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(text);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  // A part above 12 can only be a day, which settles the order whatever the preference.
  if (first > 12 && second <= 12) return { year, month: second, day: first, ambiguous: false };
  if (second > 12 && first <= 12) return { year, month: first, day: second, ambiguous: false };

  const dayFirst = order === 'DMY';
  return {
    year,
    month: dayFirst ? second : first,
    day: dayFirst ? first : second,
    // Without a day/month preference the order is a guess.
    ambiguous: first !== second && order === 'YMD',
  };
}

function readTime(text: string): { hours: number; minutes: number } | null {
  const match = /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\b/.exec(text);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}
