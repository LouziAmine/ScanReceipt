import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

/** Status bar, keyboard and splash screen: the native frame around the WebView. */
@Injectable({ providedIn: 'root' })
export class NativeShell {
  async ready(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    await Promise.allSettled([
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }),
      Capacitor.getPlatform() === 'ios'
        ? Keyboard.setResizeMode({ mode: KeyboardResize.Native })
        : Promise.resolve(),
    ]);
    await SplashScreen.hide({ fadeOutDuration: 250 });
  }
}
