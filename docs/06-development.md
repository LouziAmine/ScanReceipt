# Development guide

## Setup

**Option A: with Docker (recommended, only Docker is needed)**

```bash
git clone https://github.com/LouziAmine/ScanReceipt.git && cd ScanReceipt
export UID GID=$(id -g) KVM_GID=$(getent group kvm | cut -d: -f3)   # Linux, once per terminal
docker compose build                 # build image (~10 min the first time)
docker compose run --rm install      # npm dependencies
docker compose up dev                # http://localhost:4200
```

**Option B: on your machine**

| Tool | Version |
| --- | --- |
| Node.js | 24 |
| npm | 12.0.1 (`npm install -g npm@12.0.1`) |
| Android | Android Studio, JDK 21, SDK 36 |
| iOS (Mac only) | Xcode 26+, CocoaPods |

```bash
npm ci
npm start                 # browser, http://localhost:4200 (SQLite in WebAssembly, no camera, no OCR)
npm run android           # build + sync + open Android Studio
npm run ios               # build + sync + open Xcode (first time: cd ios/App && pod install)
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Dev server |
| `npm test` / `npm run test:watch` | Unit tests (Vitest) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier (`src/**`) |
| `npm run typecheck` | Type-check app and tests |
| **`npm run verify`** | **Everything the CI runs: run it before every push** |
| `npm run build` | Production build into `www/` |
| `npm run android:apk` | Debug APK into `dist/android/` |
| `npm run android:release` | Signed AAB + APK (`ANDROID_*` variables, see `.env.android.example`) |
| `npm run ios:simulator` / `ios:archive` | Simulator / App Store archive (Mac) |
| `npm run version:set -- 1.1.0` | Sets the version everywhere and bumps the build number |
| `npm run assets` | Regenerates icons and splash screens from `assets/*.png` |

## Code conventions

- **Strict TypeScript**, strict ESLint and Prettier: the CI rejects any deviation.
- **Layers**: follow the [dependency rule](04-architecture.md#dependency-rule). ESLint enforces it.
- **Components**: standalone, `ChangeDetectionStrategy.OnPush`, state in `signal`/`computed`, built-in control flow (`@if`, `@for`).
- **Ionic**: always `import { IonButton } from '@ionic/angular/ion-button'`, never from `@ionic/angular`.
- **Icons**: register every new icon in `presentation/shared/icons.ts`.
- **Domain**: aggregates are immutable. Raise business errors with `DomainError(message, field)`. The message is shown to the person as is, so write it in plain English.
- **Amounts**: always `Money` (integer cents), never a decimal `number`. Never add two currencies: use `sumByCurrency`.
- **Time and ids**: inject `CLOCK` and `ID_GENERATOR`; never call `new Date()` or `crypto.randomUUID()` in a use case.
- **Language**: UI text and code comments in English.

## Adding a feature

Example: "add a *payment method* field to receipts".

1. **Domain**: add the field to `ReceiptDetails` and `ReceiptSnapshot`, with its rules in `Receipt.validated()`. Add tests in `receipt.spec.ts`.
2. **Database**: **append a migration** to `MIGRATIONS` (`ALTER TABLE receipts ADD COLUMN …`), then update `receipt.mapper.ts`.
3. **Backup**: update `backup-format.ts`. If the format changes in an incompatible way, bump `BACKUP_VERSION` and keep reading older versions.
4. **Application**: update `ReceiptFormValue` and `toReceiptDetails`.
5. **Export**: add the column to the CSV (`receipt-csv.ts` and its test) and to the PDF.
6. **Presentation**: add the field to the `receipt-form` component and to the details screen.
7. Run `npm run verify`, then test on a real phone.

For a new native plugin:
- create a **port** in `application/ports/`;
- create the **adapter** in `infrastructure/`;
- bind it in `provide-infrastructure.ts`;
- run `npx cap sync`.

## Database rules

- **Never edit a shipped migration.** Append a new entry to `MIGRATIONS`.
- Amounts are cents (`INTEGER`) and dates are milliseconds (`INTEGER`). `day` is the local date `YYYY-MM-DD`, used for grouping.
- Every write goes through a repository (or the `DataReplacer` unit of work): no SQL in `application` or `presentation`.

More in [Database](05-database.md).

## Tests

`npm test` runs 61 tests in 8 files:

| File | What it covers |
| --- | --- |
| `domain/receipts/receipt.spec.ts` | Receipt aggregate invariants |
| `domain/receipts/reading/receipt-reader.spec.ts` | OCR reading on 12 real receipts |
| `domain/categories/category.spec.ts` | Category aggregate and category suggestion |
| `domain/shared-kernel/money.spec.ts` | Money, amount parsing, per-currency sums |
| `domain/shared-kernel/date-range.spec.ts` | Day, week, month and year ranges |
| `application/reporting/receipt-csv.spec.ts` | CSV, including formula injection |
| `application/backup/backup-format.spec.ts` | Backup file validation |
| `presentation/shared/dates.spec.ts` | Date labels |

**Improving the OCR**: add the text of the problematic receipt as a new case in `receipt-reader.spec.ts`, fix
`receipt-reader.ts`, and check that every other case still passes.

## What is in git and why

| Folder | In git? | Why |
| --- | --- | --- |
| `android/` | ✅ Yes (except `build/`, `.gradle/`, `local.properties`) | Capacitor's official recommendation: the native project holds **hand-edited** code and config (permissions in `AndroidManifest.xml`, signing and version in `app/build.gradle`, icons, `variables.gradle` with minSdk 24 / target 36). `npx cap add android` would not recreate them. The CI needs it to build the APK. |
| `ios/` | ✅ Yes (except `Pods/`, `App/public/`, `build/`, `xcuserdata/`) | Same reason: `Info.plist` (camera and photo permission texts), `PrivacyInfo.xcprivacy` (required by Apple), `Podfile` (iOS 15.5, CocoaPods for ML Kit), Xcode settings, icons. |
| `.vscode/` | ✅ Only `extensions.json`, `launch.json`, `tasks.json` | **Shared** team config (recommended Angular extension, launch and debug). Personal settings stay ignored by `.gitignore`. |
| `node_modules/`, `www/`, `dist/`, `.angular/` | ❌ No | Regenerated by `npm ci` and `ng build` |
| `ios/App/Pods/`, `android/app/build/` | ❌ No | Regenerated by `pod install` and Gradle; `android/app/build` alone is about 190 MB |
| `.env*`, `*.keystore`, `*.jks`, `*.p12`, `*.p8` | ❌ **Never** | Signing secrets: only in GitHub secrets |

> To do: after the first `pod install` on a Mac, **commit `ios/App/Podfile.lock`**. It pins the pod versions, like
> `package-lock.json` does for npm.

## Known pitfalls

| Symptom | Cause | Fix |
| --- | --- | --- |
| Blank screen on the web, `LinkError` | sql.js ≥ 1.13 | Keep `sql.js` at **exactly 1.12.0** |
| Huge initial bundle | Importing from the `@ionic/angular` barrel | Deep imports |
| Blue Ionic colors instead of teal | Style order | `styles.scss` (Ionic) **before** `theme/variables.scss` |
| Global CSS missing on phones (Roboto font, uppercase buttons) | `inlineCritical` blocked by the CSP | Keep `inlineCritical: false` |
| `pod install` or the iOS build fails | Switched to SPM | iOS must stay on **CocoaPods** (ML Kit) |
| `@capacitor/assets` fails | npm 12 blocks install scripts (sharp) | `npm run assets` (Python script) |
| Scanner does not open in the emulator | ML Kit Document Scanner is not supported there | Use "Import from photos" or a real phone |
