/** Value object: the half-open interval [from, to). */
export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

export type PeriodUnit = 'day' | 'week' | 'month' | 'year';

export type DatePreset = 'this_week' | 'this_month' | 'last_3_months' | 'this_year' | 'last_year';

/** 0 = Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;

const DAY_MS = 86_400_000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
  );
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfWeek(date: Date, weekStartsOn: WeekStart = 0): Date {
  const day = startOfDay(date);
  const diff = (day.getDay() - weekStartsOn + 7) % 7;
  return addDays(day, -diff);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

/** Local calendar day as "YYYY-MM-DD". */
export function localDayKey(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function periodRange(
  unit: PeriodUnit,
  anchor: Date,
  weekStartsOn: WeekStart = 0,
): DateRange {
  switch (unit) {
    case 'day': {
      const from = startOfDay(anchor);
      return { from, to: addDays(from, 1) };
    }
    case 'week': {
      const from = startOfWeek(anchor, weekStartsOn);
      return { from, to: addDays(from, 7) };
    }
    case 'month': {
      const from = startOfMonth(anchor);
      return { from, to: addMonths(from, 1) };
    }
    case 'year': {
      const from = startOfYear(anchor);
      return { from, to: new Date(from.getFullYear() + 1, 0, 1) };
    }
  }
}

export function shiftPeriod(unit: PeriodUnit, anchor: Date, steps: number): Date {
  switch (unit) {
    case 'day':
      return addDays(startOfDay(anchor), steps);
    case 'week':
      return addDays(startOfDay(anchor), steps * 7);
    case 'month':
      return addMonths(anchor, steps);
    case 'year':
      return new Date(anchor.getFullYear() + steps, 0, 1);
  }
}

export function presetRange(preset: DatePreset, now: Date, weekStartsOn: WeekStart = 0): DateRange {
  switch (preset) {
    case 'this_week':
      return periodRange('week', now, weekStartsOn);
    case 'this_month':
      return periodRange('month', now);
    case 'last_3_months':
      return { from: addMonths(startOfMonth(now), -2), to: addMonths(startOfMonth(now), 1) };
    case 'this_year':
      return periodRange('year', now);
    case 'last_year':
      return periodRange('year', new Date(now.getFullYear() - 1, 0, 1));
  }
}
