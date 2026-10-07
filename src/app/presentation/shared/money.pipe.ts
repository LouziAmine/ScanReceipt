import { Pipe, type PipeTransform } from '@angular/core';

const formatters = new Map<string, Intl.NumberFormat>();

/** `{{ 1475 | money: 'USD' }}` -> "$14.75" in the device's locale. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(cents: number | null | undefined, currency: string): string {
    if (cents === null || cents === undefined) return '';
    let formatter = formatters.get(currency);
    if (!formatter) {
      formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
      formatters.set(currency, formatter);
    }
    return formatter.format(cents / 100);
  }
}
