import {
  type ApplicationConfig,
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
import { CategoriesStore, ReceiptsStore, SettingsStore } from '@application';
import { IonicRouteStrategy } from '@ionic/angular/ionic-route-strategy';
import { provideIonicAngular } from '@ionic/angular/provide';
import {
  NativeShell,
  SqliteDatabase,
  provideInfrastructure,
} from './infrastructure/provide-infrastructure';
import { registerIcons } from './presentation/shared/icons';
import { routes } from './app.routes';

/**
 * Composition root: the only place that knows every layer. It binds ports to adapters
 * and starts the app (database, stores, native shell).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideIonicAngular({ innerHTMLTemplatesEnabled: false }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideInfrastructure(),
    provideAppInitializer(() => {
      registerIcons();
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
  try {
    await Promise.all([database.open(), settings.load()]);
    await categories.load();
    await receipts.refresh();
  } finally {
    // Never leave the person stuck on the splash screen, even if start-up failed.
    await shell.ready();
  }
}
