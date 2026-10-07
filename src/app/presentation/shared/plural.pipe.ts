import { Pipe, type PipeTransform } from '@angular/core';

/** `{{ 1 | plural: 'receipt' }}` -> "1 receipt", `{{ 3 | plural: 'receipt' }}` -> "3 receipts". */
@Pipe({ name: 'plural' })
export class PluralPipe implements PipeTransform {
  transform(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }
}
