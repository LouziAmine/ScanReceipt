# Architecture

## Principles

The app follows **Clean Architecture** and **Domain-Driven Design (DDD)**. The goal is to keep business rules
independent of any framework. SQLite, ML Kit or even Ionic can be replaced without touching the business rules, and
those rules can be tested without a phone.

```
src/app/
├── domain/           Business rules in plain TypeScript (no Angular, Ionic or Capacitor imports)
├── application/      Use cases, app state (signals), ports (interfaces to the outside world)
├── infrastructure/   Technical adapters: SQLite, Filesystem, ML Kit, scanner, sharing, PDF/ZIP
├── presentation/     Ionic screens and components
├── app.config.ts     Composition root: binds every port to its adapter
└── app.routes.ts     Routes, all lazy-loaded
```

## Dependency rule

```
presentation ──> application ──> domain <── infrastructure
                      ^                           │
                      └────── ports ──────────────┘
```

| Layer | May import | Must never import |
| --- | --- | --- |
| `domain` | nothing (plain TypeScript) | Angular, Ionic, Capacitor, other layers |
| `application` | `domain` | `infrastructure`, `presentation` |
| `infrastructure` | `domain`, `application` (ports) | `presentation` |
| `presentation` | `domain`, `application` | `infrastructure` |

ESLint (`no-restricted-imports` in `eslint.config.js`) **fails the CI** when one of these rules is broken.
The `@domain` and `@application` aliases are defined in `tsconfig.json`.

## Bounded contexts

| Context | Domain | Application | Purpose |
| --- | --- | --- | --- |
| **Receipts** | `Receipt` (aggregate), `ReceiptCriteria`, `ReceiptRepository`, `readReceipt` | `ScanReceiptUseCase`, `SaveReceiptUseCase`, `DeleteReceiptsUseCase`, `ReceiptsStore`, `ScanSessionStore` | Scan, read, save, search |
| **Categories** | `Category` (aggregate), `StoreRule`, `suggestCategory`, `assertUniqueCategoryName` | `CategoriesStore` | Classify |
| **Reporting** | `DateRange`, `sumByCurrency` | `ExportReceiptsUseCase`, `PeriodSummaryQuery`, `receiptsToCsv` | Totals, exports |
| **Backup** | — | `BackupUseCase`, `backup-format.ts` (anti-corruption layer), `DataReplacer` | Backup, restore, reminder |
| **Settings** | `UserSettings` (value object) | `SettingsStore` | Preferences |
| **Shared kernel** | `Money`, `DateRange`, `DomainError`, `normalizeKey` | `AppError`, `CLOCK`, `ID_GENERATOR` | Shared by all |

## Ports and adapters

| Port | Adapter (infrastructure) | Technology |
| --- | --- | --- |
| `DocumentScanner` | `CapacitorDocumentScanner` | VisionKit / ML Kit scanner; file picker on the web |
| `TextRecognizer` | `MlKitTextRecognizer` | ML Kit Text Recognition |
| `ImageStore` | `FilesystemImageStore` | Capacitor Filesystem |
| `FileSharer` | `CapacitorFileSharer` | Share + Clipboard |
| `FilePicker` | `CapawesomeFilePicker` | File Picker |
| `DocumentRenderer` | `JsPdfFflateRenderer` | jsPDF + fflate |
| `ReminderScheduler` | `LocalNotificationReminders` | Local Notifications |
| `DataReplacer` (restore unit of work) | `SqliteDataReplacer` | SQLite, one transaction |
| `ReceiptRepository` (domain) | `SqliteReceiptRepository` | SQLite |
| `CategoryRepository` (domain) | `SqliteCategoryRepository` | SQLite |
| `SettingsRepository` (domain) | `PreferencesSettingsRepository` | Preferences |

The wiring happens in one place: `infrastructure/provide-infrastructure.ts`, called by `app.config.ts`.

## Main flow scanning a receipt

```
Person ── Scan ──> ScanLauncher (presentation)
                      │
                      ▼
          ScanReceiptUseCase.capture()  ──> DocumentScanner (temporary photo)
                      │                     ScanSessionStore.start()
                      ▼
          /scan/processing ── ScanReceiptUseCase.process()
                      │   ├── TextRecognizer.recognize()      (OCR text)
                      │   ├── readReceipt()                   (domain: reading + confidence)
                      │   └── suggestCategory()               (domain: store rule > keywords > default)
                      ▼
          /scan/review ── form filled in, doubtful fields highlighted
                      │
                      ▼
          SaveReceiptUseCase.recordScan()
                      ├── Receipt.record()     checks invariants BEFORE writing any file
                      ├── ImageStore.persist() photo in private storage
                      ├── ReceiptRepository.save()
                      └── store rule when "Always use for X" is checked
```

## DDD choices

- **Immutable aggregates** (`Receipt`, `Category`):
  - `record()` and `create()` check every invariant at creation;
  - `rehydrate()` rebuilds an aggregate from the database or a backup;
  - every change (`revise`, `confirm`, `markReviewed`, `rename`…) returns a new instance, which fits Angular signals.
- **`Money`** stores integer cents with the currency. There are never floats, and it refuses to mix currencies. `sumByCurrency` adds amounts per currency.
- **Domain services** for rules that span several objects: `readReceipt`, `suggestCategory`, `assertUniqueCategoryName`.
- **Anti-corruption layer**: a backup file comes from outside. `backup-format.ts` validates it field by field before turning it into aggregates.
- **Patterns**:
  - Repository;
  - Ports and Adapters (hexagonal);
  - Facade/Store with signals;
  - Use Case;
  - Unit of Work (`DataReplacer`);
  - Value Object;
  - Factory method;
  - Specification (`ReceiptCriteria`);
  - Strategy (native or web scanner);
  - Mapper (SQL row ↔ aggregate);
  - injection tokens (`CLOCK`, `ID_GENERATOR`), which make time and ids testable.

## Data

Full schema, review and improvement plan: [Database](05-database.md).

- **SQLite** database `scanreceipt` with 3 tables: `receipts`, `categories`, `store_rules`.
- **Photos**: JPEG files in the app's private storage. The database only keeps the relative path.
- **Settings**: Capacitor Preferences, as JSON.

## Security and privacy

| Measure | Details |
| --- | --- |
| No data sent anywhere | No backend, no analytics, no advertising SDK |
| Strict CSP (`src/index.html`) | `default-src 'self'`: no script or request to an external domain |
| Private storage | Database and photos live in the app sandbox |
| WebView debugging off in production | `webContentsDebuggingEnabled: false` |
| CSV injection | Cells starting with `=`, `+`, `-` or `@` are neutralized (tested) |
| Safe restore | Everything is validated before writing, then swapped in one transaction |
| iOS privacy manifest | `ios/App/App/PrivacyInfo.xcprivacy`; no non-exempt encryption |
| Signing secrets | Never in git (`.gitignore`), only in GitHub secrets |

To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Performance

- **Initial bundle about 168 kB gzipped** (640 kB raw): deep Ionic imports, every page lazy-loaded.
- jsPDF, fflate and jeep-sqlite are **loaded on demand**.
- Zoneless change detection, `OnPush` and signals everywhere.
- The list is paginated in SQL (40 per page) and indexed.
- The production build keeps `inlineCritical: false`: the CSP blocks the `onload` handler Angular injects, which stopped the global CSS from applying on phones.
