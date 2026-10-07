import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  DataReplacer,
  DocumentRenderer,
  DocumentScanner,
  FilePicker,
  FileSharer,
  ImageStore,
  ReminderScheduler,
  TextRecognizer,
} from '@application';
import { CategoryRepository, ReceiptRepository, SettingsRepository } from '@domain';
import { JsPdfFflateRenderer } from './documents/jspdf-fflate-renderer';
import { CapacitorDocumentScanner } from './native/capacitor-document-scanner';
import { CapacitorFileSharer } from './native/capacitor-file-sharer';
import { CapawesomeFilePicker } from './native/capawesome-file-picker';
import { FilesystemImageStore } from './native/filesystem-image-store';
import { LocalNotificationReminders } from './native/local-notification-reminders';
import { MlKitTextRecognizer } from './native/mlkit-text-recognizer';
import { PreferencesSettingsRepository } from './persistence/preferences-settings.repository';
import { SqliteCategoryRepository } from './persistence/sqlite-category.repository';
import { SqliteDataReplacer } from './persistence/sqlite-data-replacer';
import { SqliteReceiptRepository } from './persistence/sqlite-receipt.repository';

/** Binds every port (domain repositories and application ports) to its adapter. */
export function provideInfrastructure(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ReceiptRepository, useClass: SqliteReceiptRepository },
    { provide: CategoryRepository, useClass: SqliteCategoryRepository },
    { provide: SettingsRepository, useClass: PreferencesSettingsRepository },
    { provide: DocumentScanner, useClass: CapacitorDocumentScanner },
    { provide: TextRecognizer, useClass: MlKitTextRecognizer },
    { provide: ImageStore, useClass: FilesystemImageStore },
    { provide: FileSharer, useClass: CapacitorFileSharer },
    { provide: FilePicker, useClass: CapawesomeFilePicker },
    { provide: DocumentRenderer, useClass: JsPdfFflateRenderer },
    { provide: ReminderScheduler, useClass: LocalNotificationReminders },
    { provide: DataReplacer, useClass: SqliteDataReplacer },
  ]);
}

export { SqliteDatabase } from './persistence/sqlite-database';
export { NativeShell } from './native/native-shell';
