import { Pipe, type PipeTransform } from '@angular/core';
import { formatMoney } from './amounts';

/** `{{ 1475 | money: 'USD' }}` -> "$14.75" in the language of the screens. Not pure: follows it. */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  transform(cents: number | null | undefined, currency: string): string {
    if (cents === null || cents === undefined) return '';
    return formatMoney(cents, currency);
  }
}
