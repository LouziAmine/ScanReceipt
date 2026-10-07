import { type DateFormat, isSameDay } from '@domain';

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const longDay = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const monthYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export function formatTime(date: Date): string {
  return time.format(date);
}

export function formatShortDay(date: Date): string {
  return shortDay.format(date);
}

/** "Tuesday, Oct 6, 2026 · 1:42 PM" */
export function formatLongDateTime(date: Date): string {
  return `${longDay.format(date)} · ${time.format(date)}`;
}

export function formatMonthYear(date: Date): string {
  return monthYear.format(date);
}

/** The person's chosen numeric format: 10/06/2026, 06/10/2026 or 2026-10-06. */
export function formatNumericDate(date: Date, format: DateFormat): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  switch (format) {
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
  }
}

/** "Today", "Yesterday", or the month for older receipts. */
export function dayGroupLabel(date: Date, now: Date): string {
  if (isSameDay(date, now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return formatMonthYear(date);
}

/** Within the last two days the time is enough; older receipts show their date. */
export function receiptWhen(date: Date, now: Date): string {
  const label = dayGroupLabel(date, now);
  return label === 'Today' || label === 'Yesterday' ? formatTime(date) : formatShortDay(date);
}

/** ion-datetime works with local ISO strings without a time zone. */
export function toLocalIso(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalIso(value: string): Date {
  const [datePart = '', timePart = '12:00'] = value.split('T');
  const [y = 0, m = 1, d = 1] = datePart.split('-').map(Number);
  const [h = 12, min = 0] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}
