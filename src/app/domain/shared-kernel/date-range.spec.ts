import { describe, expect, it } from 'vitest';
import { periodRange, presetRange, shiftPeriod, startOfWeek } from './date-range';

const at = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);

describe('date ranges', () => {
  it('starts weeks on Sunday or Monday', () => {
    const tuesday = at(2026, 10, 6);
    expect(startOfWeek(tuesday, 0)).toEqual(at(2026, 10, 4));
    expect(startOfWeek(tuesday, 1)).toEqual(at(2026, 10, 5));
  });

  it('builds half-open ranges for each unit', () => {
    const anchor = new Date(2026, 9, 6, 15, 30);
    expect(periodRange('day', anchor)).toEqual({ from: at(2026, 10, 6), to: at(2026, 10, 7) });
    expect(periodRange('month', anchor)).toEqual({ from: at(2026, 10, 1), to: at(2026, 11, 1) });
    expect(periodRange('year', anchor)).toEqual({ from: at(2026, 1, 1), to: at(2027, 1, 1) });
  });

  it('crosses year boundaries when shifting months', () => {
    expect(shiftPeriod('month', at(2026, 1, 15), -1)).toEqual(at(2025, 12, 1));
  });

  it('covers the current month and the two before for "last 3 months"', () => {
    expect(presetRange('last_3_months', at(2026, 10, 6))).toEqual({
      from: at(2026, 8, 1),
      to: at(2026, 11, 1),
    });
  });
});
