import { InjectionToken } from '@angular/core';

/** Injected clock so time-dependent logic stays testable. */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

export const ID_GENERATOR = new InjectionToken<() => string>('ID_GENERATOR', {
  providedIn: 'root',
  factory: () => () => crypto.randomUUID(),
});
