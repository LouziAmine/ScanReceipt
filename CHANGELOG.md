# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Testers page with QR codes (workflow **7 · Testers**): after each green CI on `master`, the GitHub pre-release
  `testers` holds the Android APK and two QR codes. On Android the QR code downloads and installs the app; on iPhone
  it opens the web demo, installable from Safari, until TestFlight is available. The links never change.
- The logo is now a vector (`assets/logo.svg`), and icons and splash screens are generated from it by
  `npm run assets` (Node + resvg, replacing the Python script). The web uses an SVG favicon and PWA icon, Android
  uses VectorDrawables for the launcher icon and splash screen, and iOS keeps its launch image as a vector. The 31
  PNG files per density are gone; only the PNGs a platform requires remain (iOS App Store icon, iOS home-screen
  icon, 512 px PWA fallback).
- Store publishing with fastlane. Workflows 3 and 4 now send the build **and** the store listing to Google Play and
  App Store Connect: name, descriptions, keywords and promotional text in the 7 languages (`fastlane/metadata/`),
  the Play icon and feature graphic, screenshots, and the English "What's new" taken from this changelog.
  `npm run store:screenshots` takes the screenshots from the web build (iPhone 6.7", iPad 13", Android, 5 screens per
  language) with sample receipts restored through Backup; `npm run store:notes` writes the release notes. Releases
  still start from *Run workflow*; with the `RELEASE_ON_TAG` variable set to `true`, pushing a version tag publishes
  on both stores. `PLAY_TRACK`, `PLAY_ROLLOUT`, `IOS_SUBMIT_FOR_REVIEW` and `IOS_AUTOMATIC_RELEASE` choose how far
  each release goes. docs/08-ci-cd.md lists the one-time store account steps.
- The web demo is an installable app (PWA). On Android and desktop Chrome or Edge, an **Install the app** button
  on the receipts list adds it to the home screen or the app list. On iPhone and iPad (Safari, Chrome and other
  browsers), which have no install dialog, the same button shows the steps: Share, then Add to Home Screen. A service worker keeps the app's files, so it opens without a network, and
  reading a photo also works offline once the OCR files were loaded. Exchange rates already fetched are kept too.
  When a new version is deployed, a "Reload" toast offers it. The phone apps are unchanged: only the `demo` build
  has the service worker.
- The app speaks English, French, Arabic, Chinese (Simplified), Spanish, German and Portuguese. **Settings >
  Language** switches every screen at once; English stays the default. Dates, months and amounts follow the
  language, Arabic lays the screens out right-to-left with Western digits, built-in category names and error
  messages are translated, and the backup reminder is rewritten in the new language. `npm run i18n:check` (in CI)
  fails when a text has no translation.
- Receipts paid in another currency are converted to the currency from Settings when they are saved. The review and
  edit screens show "Convert to USD?" with the amount at the rate of the purchase day ("¥48.00 = $6.85"); only the
  date is sent to get the rate. Offline, the app asks for the amount in USD instead (as on the bank statement). The
  receipt keeps what was paid and the rate: the detail screen, the lists, the CSV export, the copied text and backups
  show it. Receipts saved before the Settings currency was changed are added up apart ("$120.00 + 1,450.00 MAD").
- Every currency in use (ISO 4217, about 160) can be chosen, from a searchable list that puts the receipt's
  currency, the one from Settings and those already used first. Names follow the phone's language.
- The scan reads the currency from the receipt: ISO codes ("12,00 TRY"), signs (€, £, ₹, ₺, ₽, ₩, ₱, ₫, ₪, ฿, ₦,
  円…), prefixed dollars (C$, A$, US$, HK$, S$, R$…), local abbreviations (DH, zł, Kč, Ft, lei, Rp, RM, KSh, FCFA…)
  and Arabic ones (د.م., د.إ, ر.س, د.ت…). A sign shared by several currencies ("$", "¥", "kr", "Rs", "DH") is read
  as the currency from Settings when it is one of them, otherwise as the most common one, with a hint to check.
  Codes that are also words ("ALL", "TOP", "TRY", "KGS"…) only count next to a price. The review and edit forms
  have a Currency field to correct it.

### Changed

- Smaller Android and iOS apps: text recognition keeps only the Latin-script ML Kit model (a trimmed copy of the
  plugin in `plugins/mlkit-text-recognition`), Android release builds run R8 code and resource shrinking, and the APK
  ships only the `arm64-v8a`, `armeabi-v7a` and `x86_64` native libraries.
- The phone build no longer bundles the browser-only Tesseract.js and jeep-sqlite code.
- Start-up loads categories and receipts in parallel.
- Faster Gradle builds (parallel, build cache); the release smoke test accepts any APK through `APK=...`.

### Fixed

- The amount filter and the amount sort compared raw numbers across currencies (100 MAD matched "at least 100" like
  $100). They now count in the currency from Settings: only receipts in that currency match, and the others are sorted
  after them by currency.
- Restoring a backup accepted any text as the Settings currency.
- The browser tab showed Angular's default icon. The favicon, the home-screen icon and a web app manifest now use the
  ScanReceipt logo (`npm run assets` regenerates them from `assets/logo.svg`).
- Totals no longer add amounts in different currencies. They use the currency from Settings, and receipts in other
  currencies are counted and flagged ("N in other currencies"). Totals refresh when the currency changes.
- PDF reports show one total per currency and format each amount in its own currency.
- Restoring a backup replaces categories, store rules and receipts in a single transaction.
- Browser: a photo picked from the computer is now checked and saved as a JPEG. A file that is not an image is
  refused ("This file cannot be opened as a photo") instead of being saved with a broken photo. PNG, WebP, GIF and
  BMP files are converted, and very large photos are reduced to about 8 MP ("High") or 4 MP ("Standard").
- The PDF report with photos no longer fails when one photo cannot be read: it shows "Photo could not be added."
  for that receipt.
- Screens opened on top of another (photo viewer, filter, category picker, category editor, date picker) failed to
  open on every platform: their settings were written over Angular signal inputs. Ionic now passes them with
  `setInput` (`useSetInputAPI: true`), and these screens no longer use the `modal` property that Ionic reserves.
- Creating a category from the category picker now selects it and closes the picker.
- "Copy text" on a receipt copies its store, date, total, tax, category and note, followed by the OCR text when there
  is one. It used to copy only the OCR text, which is empty for receipts typed by hand and in the browser.
- Dark mode: the calendars (Totals → Pick a date, receipt date) were white with light text, so the days could not be
  read. The dark theme now defines Ionic's background and text color steps, used by the date picker and other
  components.
- After sharing a receipt, the screen stays visible to screen readers (the share sheet now closes fully before the
  next step starts).

### Added

- Only CI and the web demo deploy run by themselves. QA, Android release, iOS release and the live test run only
  from *Run workflow*; the Android release no longer starts when a version tag is pushed (run it from the tag).
- Cloud testing from the console: `scripts/qa-cloud.sh` (and `./tester.sh` entries 16 – 21) starts, follows, stops
  and downloads the **2 · QA** workflow, and runs the new **6 · Live test · Appetize** workflow, which uploads the
  Android and iPhone builds to Appetize and gives a link per device to use the app in the browser.
- Settings → Appearance: *Same as device* (default), *Light* or *Dark*. *Same as device* follows the system theme,
  even when it changes while the app is open. The choice is kept in backups.
- "30 days" chart on the line of the first section of *My receipts* (usually *Today*): money spent per day over the
  last 30 days, in the currency of Settings. Tap a bar to read that day's amount and receipt count; open or closed is
  remembered.
- Moon / sun button in the header of *My receipts* to switch between light and dark in one tap (sets *Light* or
  *Dark*; *Same as device* stays in Settings).
- OCR in the browser: the web demo reads the photo with Tesseract.js (WebAssembly), served with the app and loaded on
  the first scan; no image or text leaves the browser. A sideways photo is turned a quarter turn when the first
  reading has a low confidence. Phones keep ML Kit.
- Receipt reading understands total and tax lines in more languages (German *Summe*/*MwSt*, Polish *Suma*/*PTU*,
  Indonesian *Total Belanja*/*PPN*, Italian, Dutch, Spanish) and whole amounts for currencies without cents
  (*13,000*). Logos read as noise and lines with a price are no longer taken for the store name.
- In a browser on a wide screen, the app is shown in a centered phone-sized frame instead of stretching to the
  full window. Native apps (tablets included) are unchanged.
- Browser demo published to GitHub Pages after every green CI on `master`
  (https://louziamine.github.io/ScanReceipt/), with a "Web demo" banner explaining that camera scanning and OCR
  need the mobile app.
- Open-source release under the Apache License 2.0: contributing guide, code of conduct, security policy, privacy
  policy, issue and pull request templates.
- Full English documentation in `docs/`, including why the iOS CI job is skipped on push and how to read the Usage page.
- GitHub Actions: CI, device QA runs, Android release (GitHub Releases and Google Play), iOS release (TestFlight).

## [1.0.0] - 2026-10-07

### Added

- Receipt scanning with edge detection (VisionKit, ML Kit) and photo import.
- On-device OCR reading the store, date, total and tax, with a confidence level per field.
- Review screen with highlighted doubtful fields, undo after saving.
- Receipt list with search, quick filters, full filter and sorting, infinite scroll.
- Receipt details, editing, photo replacement, OCR re-run, sharing.
- Categories with colors and icons, store rules, keyword suggestions.
- Totals per day, week, month and year, by category.
- Multi-select export, share and delete.
- CSV, PDF and ZIP exports.
- Backup and restore in a ZIP file, monthly local reminder.
- Settings: currency, date format, week start, default category, image quality, low-confidence warnings.

[Unreleased]: https://github.com/LouziAmine/ScanReceipt/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/LouziAmine/ScanReceipt/releases/tag/v1.0.0
