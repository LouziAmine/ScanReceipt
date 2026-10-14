import { type CurrencyCode, SUPPORTED_CURRENCIES } from '../../shared-kernel/money';
import { type ReadField } from './receipt-reading';

/**
 * A sign, code or name of a currency. Several currencies share some signs ("$", "¥", "kr"):
 * the first one listed is the most common.
 */
interface CurrencyMark {
  readonly pattern: RegExp;
  readonly currencies: readonly [CurrencyCode, ...CurrencyCode[]];
  /** Shown in the hint when the sign could be another currency. */
  readonly sign: string;
}

/** `source` only counts right before or after an amount ("R 45.00", "12,00 TRY"). */
function nearAmount(source: string): RegExp {
  return new RegExp(
    `(?<=\\d\\s{0,2})(?:${source})(?![\\p{L}])|(?<![\\p{L}])(?:${source})(?=\\s{0,2}-?\\d)`,
    'gu',
  );
}

/** A sign written before the amount only ("R 45.00"), never before a reference like "R0012". */
function beforeAmount(source: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\d])(?:${source})(?=\\s?\\d{1,3}(?:[ ,.]\\d{3})*[.,]\\d{2}(?!\\d))`,
    'gu',
  );
}

/** "C$", "HK$", "R$"… */
function prefixedDollar(prefix: string): RegExp {
  return new RegExp(`(?<![\\p{L}])(?:${prefix})\\s?\\$`, 'gu');
}

/** Stricter `nearAmount` for codes that are also words: the amount must have cents ("12,00 TRY"). */
function nextToPrice(source: string): RegExp {
  return new RegExp(
    `(?<=\\d[.,]\\d{2}\\s{0,2})(?:${source})(?![\\p{L}])|(?<![\\p{L}])(?:${source})(?=\\s{0,2}-?\\d[\\d ,.]*[.,]\\d{2}(?!\\d))`,
    'gu',
  );
}

function anywhere(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}])(?:${source})(?![\\p{L}])`, 'gu');
}

function mark(
  pattern: RegExp,
  currencies: readonly [CurrencyCode, ...CurrencyCode[]],
  sign: string = currencies[0],
): CurrencyMark {
  return { pattern, currencies, sign };
}

/** ISO codes that are also words or abbreviations on receipts ("ALL", "TOP", "KGS", "ILS"…). */
// prettier-ignore
const WORD_CODES: ReadonlySet<CurrencyCode> = new Set<CurrencyCode>([
  'ALL', 'AMD', 'ANG', 'ARS', 'BAM', 'BOB', 'BTN', 'CAD', 'COP', 'CRC', 'CUP', 'DOP', 'GEL',
  'ILS', 'KGS', 'MAD', 'MDL', 'MNT', 'MOP', 'MUR', 'NAD', 'PEN', 'RON', 'RUB', 'SOS', 'STN',
  'SVC', 'TOP', 'TRY', 'WST',
]);

const ISO_CODES: readonly CurrencyMark[] = SUPPORTED_CURRENCIES.map((code) =>
  mark(WORD_CODES.has(code) ? nextToPrice(code) : anywhere(code), [code]),
);

/** Dollars with a country prefix, read before a bare "$". */
const PREFIXED_DOLLARS: readonly CurrencyMark[] = [
  mark(prefixedDollar('US'), ['USD']),
  mark(prefixedDollar('CA|C'), ['CAD']),
  mark(prefixedDollar('AU|A'), ['AUD']),
  mark(prefixedDollar('NZ'), ['NZD']),
  mark(prefixedDollar('HK'), ['HKD']),
  mark(prefixedDollar('SG|S'), ['SGD']),
  mark(prefixedDollar('MEX|MX'), ['MXN']),
  mark(prefixedDollar('RD'), ['DOP']),
  mark(prefixedDollar('R'), ['BRL']),
  mark(prefixedDollar('NT'), ['TWD']),
  mark(prefixedDollar('TT'), ['TTD']),
  mark(prefixedDollar('J'), ['JMD']),
  mark(prefixedDollar('BZ'), ['BZD']),
  mark(prefixedDollar('FJ'), ['FJD']),
  mark(prefixedDollar('EC'), ['XCD']),
];

/** Signs, local abbreviations and names. Matched on upper-cased text. */
const SIGNS: readonly CurrencyMark[] = [
  mark(/€/gu, ['EUR']),
  mark(anywhere('EUROS?'), ['EUR']),
  mark(anywhere('YEN'), ['JPY']),
  mark(anywhere('YUAN'), ['CNY']),
  mark(/E\s?£/gu, ['EGP']),
  mark(/£/gu, ['GBP', 'EGP', 'GIP', 'FKP', 'SHP'], '£'),
  mark(/₹/gu, ['INR']),
  mark(/₺/gu, ['TRY']),
  mark(/₽|(?<![\p{L}])РУБ/gu, ['RUB']),
  mark(/₴|(?<![\p{L}])ГРН/gu, ['UAH']),
  mark(/₩/gu, ['KRW']),
  mark(/₱/gu, ['PHP']),
  mark(/₫/gu, ['VND']),
  mark(/₪/gu, ['ILS']),
  mark(/฿/gu, ['THB']),
  mark(/₦/gu, ['NGN']),
  mark(/₸/gu, ['KZT']),
  mark(/৳/gu, ['BDT']),
  mark(/₾/gu, ['GEL']),
  mark(/₼/gu, ['AZN']),
  mark(/֏/gu, ['AMD']),
  mark(/₮/gu, ['MNT']),
  mark(/₭/gu, ['LAK']),
  mark(/₲/gu, ['PYG']),
  mark(/₡/gu, ['CRC']),
  mark(/៛/gu, ['KHR']),
  mark(/₵/gu, ['GHS']),
  mark(/円/gu, ['JPY']),
  mark(/元|(?<![\p{L}])RMB(?![\p{L}])/gu, ['CNY']),
  mark(/[¥￥]/gu, ['JPY', 'CNY'], '¥'),
  mark(/₨/gu, ['PKR', 'LKR', 'NPR', 'INR', 'MUR', 'SCR'], '₨'),
  mark(nearAmount('RS\\.?'), ['INR', 'PKR', 'LKR', 'NPR', 'MUR', 'SCR'], 'Rs'),
  mark(anywhere('RUPEES?'), ['INR', 'PKR', 'LKR', 'NPR', 'MUR', 'SCR'], 'rupee'),
  mark(anywhere('ZŁ'), ['PLN']),
  mark(anywhere('KČ'), ['CZK']),
  mark(nearAmount('FT'), ['HUF']),
  mark(anywhere('LEI'), ['RON']),
  mark(anywhere('ЛВ\\.?'), ['BGN']),
  mark(anywhere('ДЕН'), ['MKD']),
  mark(anywhere('ДИН'), ['RSD']),
  mark(nearAmount('RP\\.?'), ['IDR']),
  mark(nearAmount('RM'), ['MYR']),
  mark(anywhere('KSH'), ['KES']),
  mark(anywhere('USH'), ['UGX']),
  mark(anywhere('TSH'), ['TZS']),
  mark(nearAmount('S/\\.?'), ['PEN']),
  mark(beforeAmount('R'), ['ZAR']),
  mark(nearAmount('KR\\.?'), ['SEK', 'NOK', 'DKK', 'ISK'], 'kr'),
  mark(anywhere('F?\\s?CFA|FCFA'), ['XOF', 'XAF'], 'CFA'),
  mark(anywhere('CFP'), ['XPF']),
  mark(anywhere('DHS?|DIRHAMS?'), ['MAD', 'AED'], 'DH'),
  mark(anywhere('درهم'), ['MAD', 'AED'], 'درهم'),
  mark(anywhere('د\\.\\s?م'), ['MAD']),
  mark(anywhere('د\\.\\s?إ'), ['AED']),
  mark(anywhere('ر\\.\\s?س'), ['SAR']),
  mark(anywhere('د\\.\\s?ت'), ['TND']),
  mark(anywhere('د\\.\\s?ج'), ['DZD']),
  mark(anywhere('ر\\.\\s?ق'), ['QAR']),
  mark(anywhere('د\\.\\s?ك'), ['KWD']),
  mark(anywhere('د\\.\\s?ب'), ['BHD']),
  mark(anywhere('ر\\.\\s?ع'), ['OMR']),
  mark(anywhere('د\\.\\s?ا'), ['JOD']),
  mark(anywhere('د\\.\\s?ع'), ['IQD']),
  mark(anywhere('د\\.\\s?ل'), ['LYD']),
  mark(anywhere('ج\\.\\s?م'), ['EGP']),
  mark(anywhere('ل\\.\\s?ل'), ['LBP']),
  mark(anywhere('ل\\.\\s?س'), ['SYP']),
  mark(anywhere('ر\\.\\s?ي'), ['YER']),
  mark(/﷼/gu, ['SAR', 'IRR', 'OMR', 'QAR', 'YER'], '﷼'),
];

/** Currencies written with a bare "$", most common first. */
const BARE_DOLLAR = mark(
  /\$/gu,
  // prettier-ignore
  [
    'USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN', 'TWD', 'ARS', 'CLP', 'COP', 'UYU', 'DOP',
    'CUP', 'JMD', 'TTD', 'BSD', 'BBD', 'BZD', 'BMD', 'KYD', 'FJD', 'LRD', 'NAD', 'SRD', 'SBD',
    'XCD', 'GYD', 'BND',
  ],
  '$',
);

/** Most specific first: each match is blanked so a later, looser mark cannot read it again. */
const MARKS: readonly CurrencyMark[] = [...ISO_CODES, ...PREFIXED_DOLLARS, ...SIGNS, BARE_DOLLAR];

/**
 * Domain service: which currency a receipt is in, from its signs, codes and names.
 * A sign shared by several currencies ("$", "kr", "¥") is read as the person's usual
 * currency when it is one of them.
 */
export function readCurrency(
  lines: readonly string[],
  usual: CurrencyCode,
): ReadField<CurrencyCode> {
  const counts = new Map<CurrencyCode, number>();
  /** Shared signs read as a currency the person does not use. */
  const unsureSigns = new Set<string>();

  for (const original of lines) {
    let line = original.toUpperCase();
    for (const { pattern, currencies, sign } of MARKS) {
      line = line.replace(pattern, (match) => {
        const shared = currencies.length > 1;
        const currency = shared && currencies.includes(usual) ? usual : currencies[0];
        if (shared && currency !== usual) unsureSigns.add(sign);
        counts.set(currency, (counts.get(currency) ?? 0) + 1);
        return ' '.repeat(match.length);
      });
    }
  }

  const [best, ...others] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!best) {
    return { value: null, confidence: 'missing' };
  }
  if (others.length > 0) {
    return {
      value: best[0],
      confidence: 'low',
      hint: 'Several currencies appear on this receipt, please check',
    };
  }
  const [sign] = unsureSigns;
  if (sign !== undefined) {
    return {
      value: best[0],
      confidence: 'low',
      hint: '"{sign}" is used by several currencies, please check',
      hintParams: { sign },
    };
  }
  return { value: best[0], confidence: 'high' };
}
