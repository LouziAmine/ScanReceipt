import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { type Theme } from '@domain';

/** Status bar, keyboard, splash screen and light/dark theme: the frame around the WebView. */
@Injectable({ providedIn: 'root' })
export class NativeShell {
  private readonly native = Capacitor.isNativePlatform();
  private readonly systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  private theme: Theme = 'system';

  constructor() {
    // "System" follows the device when it switches between light and dark.
    this.systemDark.addEventListener('change', () => {
      if (this.theme === 'system') void this.applyTheme('system');
    });
  }

  async ready(): Promise<void> {
    if (!this.native) return;
    await Promise.allSettled([
      Capacitor.getPlatform() === 'ios'
        ? Keyboard.setResizeMode({ mode: KeyboardResize.Native })
        : Promise.resolve(),
    ]);
    await SplashScreen.hide({ fadeOutDuration: 250 });
  }

  /** Forced themes are classes on <html> read by theme/variables.scss. */
  async applyTheme(theme: Theme): Promise<void> {
    this.theme = theme;
    const dark = theme === 'dark' || (theme === 'system' && this.systemDark.matches);
    const root = document.documentElement;
    root.classList.toggle('theme-light', theme === 'light');
    root.classList.toggle('theme-dark', theme === 'dark');
    // Scrollbars, date pickers and other built-in controls follow the same theme.
    root.style.colorScheme = dark ? 'dark' : 'light';
    if (this.native) {
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
    }
  }
}
