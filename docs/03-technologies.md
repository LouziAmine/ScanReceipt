# Technologies

Every technology is described with its **role**, its **version**, **why** it was chosen, **where** it is used in the
code, and its **known pitfalls**. Versions come from `package.json` and the `Dockerfile`.

## Overview

```
┌──────────────────────────────── Phone (iOS / Android) ───────────────────────────────────┐
│  WebView ── Angular 22 + Ionic 9 (UI)                                                    │
│     │                                                                                    │
│     └── Capacitor 8 (JS ↔ native bridge)                                                 │
│            ├── Document Scanner (VisionKit on iOS / ML Kit on Android) → cropped photo   │
│            ├── ML Kit Text Recognition                                 → OCR text        │
│            ├── SQLite                                                  → receipts, categories │
│            ├── Filesystem                                              → JPEG photos     │
│            ├── Preferences                                             → settings        │
│            ├── Share / Clipboard / File Picker                         → export, restore │
│            └── Local Notifications                                     → backup reminder │
└──────────────────────────────────────────────────────────────────────────────────────────┘
        No server. No outgoing network calls (strict CSP in index.html).
```

## User interface and application

| Technology | Version | Role | Why | Known pitfalls |
| --- | --- | --- | --- | --- |
| **Angular** | 22 | App framework: standalone components, signals, **zoneless**, `OnPush` | Strict typing, dependency injection (needed for ports and adapters), built-in lazy loading | No Zone.js: any state shown on screen must be a `signal` |
| **Ionic** | 9 | Mobile components (lists, modals, action sheets, refresher…) with native iOS / Material look | One codebase, native look on both platforms | **Always import deep entry points** (`@ionic/angular/ion-button`): the barrel grew the initial bundle from 640 kB to 1.41 MB |
| **TypeScript** | 6 (strict) | Language | Errors caught at compile time | `npm run typecheck` also checks the tests |
| **RxJS** | 7.8 | Barely used (signals are preferred) | Required by Angular | — |
| **DM Sans** (`@fontsource-variable`) | 5 | App font, bundled | No Google Fonts (CSP, offline) | — |
| **Ionicons** | 8 | Icons | Registered one by one (`presentation/shared/icons.ts`) | An icon that is not registered does not show |

## Native layer Capacitor and plugins

| Technology | Version | Role | Where in the code | Known pitfalls |
| --- | --- | --- | --- | --- |
| **Capacitor** | 8 | Web ↔ native bridge; `android/` and `ios/` projects | `capacitor.config.ts` | Run `npx cap sync` after each `ng build` (the scripts do it) |
| **@capgo/capacitor-document-scanner** | 8.4 | Scanner with edge detection, perspective fix, crop | `infrastructure/native/capacitor-document-scanner.ts` | **Does not run in the Android emulator** |
| **@capacitor-mlkit/text-recognition** | 8.2 | Offline on-device OCR | `infrastructure/native/mlkit-text-recognizer.ts` | No SPM support: **iOS must stay on CocoaPods**, iOS 15.5 minimum |
| **@capacitor-community/sqlite** | 8.1 | Native SQLite database | `infrastructure/persistence/sqlite-database.ts` | — |
| **jeep-sqlite** + **sql.js** | 2.8 / **exactly 1.12.0** | SQLite compiled to WebAssembly for the browser (development) | loaded on demand | **sql.js is pinned to 1.12.0**: 1.13+ causes a LinkError and a blank screen on the web |
| **@capacitor/filesystem** | 8 | Photos in the app's private storage | `filesystem-image-store.ts` | Each photo version gets a new file name (WebView cache) |
| **@capacitor/preferences** | 8 | Settings | `persistence/preferences-settings.repository.ts` | — |
| **@capacitor/share**, **clipboard** | 8 | Share sheet, copy text | `capacitor-file-sharer.ts` | — |
| **@capawesome/capacitor-file-picker** | 8 | Pick a photo or a backup ZIP | `capawesome-file-picker.ts` | — |
| **@capacitor/local-notifications** | 8 | Monthly backup reminder | `local-notification-reminders.ts` | `SCHEDULE_EXACT_ALARM` was removed on purpose (restricted by Google Play) |
| **@capacitor/splash-screen**, **status-bar**, **keyboard**, **app** | 8 | Start-up, status bar, keyboard, Android back button | `native-shell.ts` | The splash screen stays until the database is open |

## Documents

| Technology | Version | Role | Why |
| --- | --- | --- | --- |
| **jsPDF** | 4.2 | PDF generation (report, single receipt) | Works offline; **loaded on demand** (404 kB) |
| **fflate** | 0.8 | ZIP (photo export, backup) and unzip (restore) | Very small and fast; loaded on demand |

## Quality tools

| Tool | Role | Command |
| --- | --- | --- |
| **Vitest** 4 (through `@angular/build:unit-test`) + **jsdom** | Unit tests (61 tests in 8 files) | `npm test` |
| **ESLint** 10 + **angular-eslint** + **typescript-eslint** (strict) | Code quality and the **layer dependency rule** (`no-restricted-imports`) | `npm run lint` |
| **Prettier** 3 (+ organize-attributes) | Formatting | `npm run format` / `format:check` |
| **tsc** | Type checking of app and tests | `npm run typecheck` |
| All of the above | Format, lint, types, tests, build | `npm run verify` |

## Build environment and CI/CD

| Technology | Version | Role |
| --- | --- | --- |
| **Node.js** | 24 | Runs the tooling |
| **npm** | **12.0.1** (`packageManager`) | Dependencies. It blocks install scripts, which is why icons are generated by `scripts/generate-native-assets.py` |
| **JDK** (Temurin) | 21 | Android build |
| **Android SDK** | platform 36, build-tools 36, minSdk 24 | Android build |
| **Gradle** | project wrapper | APK / AAB build |
| **Xcode** + **CocoaPods** | Xcode 26+, iOS 15.5+ | iOS build (macOS only) |
| **Docker** + Compose | — | Same build environment for everyone (see [CI/CD and releases](08-ci-cd.md)) |
| **GitHub Actions** | — | CI/CD: 5 numbered workflows |
| **GitHub Pages** | — | Hosts the browser demo (`--configuration demo`) |

## Compatibility

| Platform | Minimum | Target |
| --- | --- | --- |
| Android | 7.0 (API 24) | Android 16 (API 36), required by Google Play |
| iOS | 15.5 (ML Kit constraint) | iOS 26 (Xcode 26 SDK), required by Apple |
| Browser (development only) | Recent Chrome / Firefox | No camera, no OCR |
