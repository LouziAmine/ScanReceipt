import {
  type ApplicationConfig,
  effect,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  PreloadAllModules,
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { CategoriesStore, ReceiptsStore, SettingsStore } from '@application';
import { Capacitor } from '@capacitor/core';
import { environment } from '@env/environment';
import { IonicRouteStrategy } from '@ionic/angular/ionic-route-strategy';
import { provideIonicAngular } from '@ionic/angular/provide';
import {
  NativeShell,
  SqliteDatabase,
  provideInfrastructure,
} from './infrastructure/provide-infrastructure';
import { useLanguage } from './presentation/i18n/i18n';
import { registerIcons } from './presentation/shared/icons';
import { WebAppService } from './presentation/shared/web-app.service';
import { routes } from './app.routes';

/** The `demo` build (GitHub Pages). A function: each build has its own constant. */
function webDemo(): boolean {
  return environment.webDemo;
}

/**
 * Composition root: the only place that knows every layer. It binds ports to adapters
 * and starts the app (database, stores, native shell).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideIonicAngular({ innerHTMLTemplatesEnabled: false, useSetInputAPI: true }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideInfrastructure(),
    // Only the browser demo is an installable, offline web app; the phone apps have their files.
    provideServiceWorker('ngsw-worker.js', {
      enabled: webDemo() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => {
      registerIcons();
      // Listens from the start: the browser offers the install prompt once, at load time.
      if (webDemo()) inject(WebAppService);
      return startApp();
    }),
  ],
};

async function startApp(): Promise<void> {
  const database = inject(SqliteDatabase);
  const settings = inject(SettingsStore);
  const categories = inject(CategoriesStore);
  const receipts = inject(ReceiptsStore);
  const shell = inject(NativeShell);
  // Settings > Appearance, applied again whenever it changes.
  effect(() => {
    void shell.applyTheme(settings.settings().theme);
  });
  // Settings > Language, applied again whenever it changes.
  effect(() => {
    void useLanguage(settings.settings().language);
  });
  try {
    await Promise.all([database.open(), settings.load()]);
    // The chosen language is ready before the first screen shows.
    await useLanguage(settings.settings().language);
    // Independent reads: one round trip to SQLite instead of two.
    await Promise.all([categories.load(), receipts.refresh()]);
  } finally {
    // Never leave the person stuck on the splash screen, even if start-up failed.
    await shell.ready();
  }
}
