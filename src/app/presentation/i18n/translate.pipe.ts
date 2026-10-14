import { Pipe, type PipeTransform } from '@angular/core';
import { type MessageParams } from '@domain';
import { t, tp } from './i18n';

/**
 * `{{ 'Review receipt' | t }}`, `{{ 'Always use for {store}' | t: { store } }}`.
 * Not pure: it reads the language signal, so the screen updates when the language changes.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  transform(text: string, params?: MessageParams): string {
    return t(text, params);
  }
}

/** `{{ count | plural: '{count} receipt' : '{count} receipts' }}` -> "3 receipts", "3 reçus". */
@Pipe({ name: 'plural', pure: false })
export class PluralPipe implements PipeTransform {
  transform(count: number, one: string, other: string, params?: MessageParams): string {
    return tp(count, one, other, params);
  }
}
