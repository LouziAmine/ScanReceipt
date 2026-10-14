import { DestroyRef, type Signal, computed, inject, signal } from '@angular/core';
import { SettingsStore } from '@application';

/**
 * Whether the screens are dark right now: the theme chosen in Settings, or the device's
 * own theme for "Same as device" (followed live). Call it in an injection context.
 */
export function isDarkAppearance(): Signal<boolean> {
  const settings = inject(SettingsStore);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const systemDark = signal(media.matches);
  const listener = (event: MediaQueryListEvent): void => {
    systemDark.set(event.matches);
  };
  media.addEventListener('change', listener);
  inject(DestroyRef).onDestroy(() => {
    media.removeEventListener('change', listener);
  });
  return computed(() => {
    const theme = settings.settings().theme;
    return theme === 'dark' || (theme === 'system' && systemDark());
  });
}
