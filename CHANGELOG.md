# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Totals no longer add amounts in different currencies. They use the currency from Settings, and receipts in other
  currencies are counted and flagged ("N in other currencies"). Totals refresh when the currency changes.
- PDF reports show one total per currency and format each amount in its own currency.
- Restoring a backup replaces categories, store rules and receipts in a single transaction.

### Added

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
