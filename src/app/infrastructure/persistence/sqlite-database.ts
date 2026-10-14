import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { environment } from '@env/environment';
import { MIGRATIONS } from './schema';

export type SqlValue = string | number | null;

export interface SqlStatement {
  readonly sql: string;
  readonly params?: readonly SqlValue[];
}

/** Thin wrapper over the SQLite plugin: one connection, migrations, transactions. */
@Injectable({ providedIn: 'root' })
export class SqliteDatabase {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private readonly isWeb = Capacitor.getPlatform() === 'web';
  private connection: SQLiteDBConnection | null = null;
  private opening: Promise<SQLiteDBConnection> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  async open(): Promise<void> {
    await this.db();
  }

  async query<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    const db = await this.db();
    const result = await db.query(sql, [...params]);
    return (result.values ?? []) as T[];
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    await this.transaction([{ sql, params }]);
  }

  /** Runs every statement or none. Writes are serialized so transactions never interleave. */
  async transaction(statements: readonly SqlStatement[]): Promise<void> {
    if (statements.length === 0) return;
    const task = this.queue.then(async () => {
      const db = await this.db();
      await db.executeSet(
        statements.map((s) => ({ statement: s.sql, values: [...(s.params ?? [])] })),
        true,
      );
      if (this.isWeb) {
        await this.sqlite.saveToStore(environment.databaseName);
      }
    });
    this.queue = task.catch(() => undefined);
    await task;
  }

  private db(): Promise<SQLiteDBConnection> {
    if (this.connection) return Promise.resolve(this.connection);
    this.opening ??= this.connect().then((db) => (this.connection = db));
    return this.opening;
  }

  private async connect(): Promise<SQLiteDBConnection> {
    if (this.isWeb) {
      await this.prepareWebStore();
    }
    const name = environment.databaseName;
    const consistent = (await this.sqlite.checkConnectionsConsistency()).result ?? false;
    const exists = (await this.sqlite.isConnection(name, false)).result ?? false;
    const db =
      consistent && exists
        ? await this.sqlite.retrieveConnection(name, false)
        : await this.sqlite.createConnection(
            name,
            false,
            'no-encryption',
            environment.databaseVersion,
            false,
          );
    await db.open();
    await this.migrate(db);
    return db;
  }

  private async migrate(db: SQLiteDBConnection): Promise<void> {
    const rows = (await db.query('PRAGMA user_version;')).values as
      { user_version: number }[] | undefined;
    const current = rows?.[0]?.user_version ?? 0;
    for (let version = current; version < MIGRATIONS.length; version++) {
      const migration = MIGRATIONS[version] ?? '';
      await db.execute(`${migration}\nPRAGMA user_version = ${version + 1};`, true);
    }
    if (this.isWeb && current < MIGRATIONS.length) {
      await this.sqlite.saveToStore(environment.databaseName);
    }
  }

  /** Browser development only: SQLite compiled to WebAssembly, persisted in IndexedDB. */
  private async prepareWebStore(): Promise<void> {
    const { defineCustomElements } = await import('jeep-sqlite/loader');
    defineCustomElements(window);
    if (!document.querySelector('jeep-sqlite')) {
      const element = document.createElement('jeep-sqlite');
      element.setAttribute('wasmpath', 'assets');
      document.body.appendChild(element);
    }
    await customElements.whenDefined('jeep-sqlite');
    await this.sqlite.initWebStore();
  }
}
