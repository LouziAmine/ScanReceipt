# Product overview

## The problem

Paper receipts get lost, and the thermal paper fades. Typing them into an expense report, a budget or a tax return is
tedious. Most existing apps upload your photos to a server and require an account and a subscription.

## Value proposition

> **Scan a receipt in seconds, with no account and no internet. Your data stays on your phone.**

| Promise            | How the app keeps it                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Fast               | Native scanner with edge detection, on-device OCR, fields filled in for you                            |
| Reliable           | Every field has a confidence level; doubtful fields are highlighted for review                          |
| Private            | No server, no account, no data collected (declared in the iOS privacy manifest)                         |
| Useful for taxes   | Totals per day, week, month and year and per category; CSV (Excel), PDF and photo ZIP exports           |
| No data loss       | Full backup in a single ZIP file with a monthly reminder; restore on a new phone                        |

## Target users

| Persona                     | Main need                                                  | Key features                                    |
| --------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| **Freelancer**              | Justify business expenses and prepare the books            | Categories, CSV/PDF export with photos, periods |
| **Employee who travels**    | File expense reports without keeping paper receipts        | Fast scan, multi-select, PDF sharing            |
| **Household**               | Follow the grocery, dining and transportation budget       | Monthly and per-category totals, search         |

## Scope of version 1

| #   | Feature                                                 | Details                                                    |
| --- | ------------------------------------------------------- | ---------------------------------------------------------- |
| F1  | Scan a receipt (camera or photo library)                | [Features: F1](02-features.md#f1-scan-a-receipt)           |
| F2  | Automatic reading (OCR) with confidence per field       | [Features: F2](02-features.md#f2-automatic-reading-ocr)    |
| F3  | Review and save                                         | [Features: F3](02-features.md#f3-review-and-save)          |
| F4  | List, search, filters and sorting                       | [Features: F4](02-features.md#f4-list-search-and-filters)  |
| F5  | Receipt details, editing and verification               | [Features: F5](02-features.md#f5-receipt-details-and-editing) |
| F6  | Categories and store rules                              | [Features: F6](02-features.md#f6-categories-and-store-rules) |
| F7  | Totals per period                                       | [Features: F7](02-features.md#f7-totals-per-period)        |
| F8  | Multi-select                                            | [Features: F8](02-features.md#f8-multi-select)             |
| F9  | Export and share (CSV, PDF, ZIP, JPG, text)             | [Features: F9](02-features.md#f9-export-and-share)         |
| F10 | Backup, restore and reminder                            | [Features: F10](02-features.md#f10-backup-restore-and-reminder) |
| F11 | Settings                                                | [Features: F11](02-features.md#f11-settings)               |

## Out of scope for version 1

| Not included                          | Reason                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Cloud sync between devices            | The promise is "nothing leaves the phone"; the ZIP backup covers a new phone    |
| User accounts                         | No server, so no personal data to protect on our side                          |
| Line items                            | OCR is not reliable enough line by line; v1 reads store, date, total and tax   |
| Mixing currencies in one total        | A total never adds two currencies together (`Money` business rule)             |
| Multi-page receipts                   | The scanner takes one page per receipt                                         |
| Languages other than English          | The first target market is the USA                                             |

## Roadmap ideas

| Priority | Idea                                                         | Value                                     |
| -------- | ------------------------------------------------------------ | ----------------------------------------- |
| High     | Automated UI tests (Maestro) in CI                           | Fewer regressions, faster releases        |
| High     | Publish on Google Play and the App Store                     | Reach users                               |
| Medium   | Charts on the Totals screen                                  | Easier budget reading                     |
| Medium   | Multi-page receipts                                          | Long supermarket receipts                 |
| Medium   | Localization (French, Spanish)                               | New markets                               |
| Low      | Backup to iCloud Drive or Google Drive, chosen by the user   | Fewer forgotten backups                   |

Ideas and votes are welcome in [GitHub issues](https://github.com/LouziAmine/ScanReceipt/issues).
