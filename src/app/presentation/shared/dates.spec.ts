import { describe, expect, it } from 'vitest';
import { dayGroupLabel, formatNumericDate, fromLocalIso, toLocalIso } from './dates';

describe('presentation dates', () => {
  const now = new Date(2026, 9, 6, 18, 0);

  it('groups receipts by today, yesterday, then month', () => {
    expect(dayGroupLabel(new Date(2026, 9, 6, 8), now)).toBe('Today');
    expect(dayGroupLabel(new Date(2026, 9, 5, 23), now)).toBe('Yesterday');
    expect(dayGroupLabel(new Date(2026, 8, 28), now)).toMatch(/2026/);
  });

  it('formats dates the way the person chose', () => {
    const date = new Date(2026, 9, 6);
    expect(formatNumericDate(date, 'MM/DD/YYYY')).toBe('10/06/2026');
    expect(formatNumericDate(date, 'DD/MM/YYYY')).toBe('06/10/2026');
    expect(formatNumericDate(date, 'YYYY-MM-DD')).toBe('2026-10-06');
  });

  it('round-trips local ISO strings for ion-datetime', () => {
    const date = new Date(2026, 9, 6, 13, 42);
    expect(toLocalIso(date)).toBe('2026-10-06T13:42');
    expect(fromLocalIso('2026-10-06T13:42')).toEqual(date);
  });
});
