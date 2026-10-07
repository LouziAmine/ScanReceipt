<div align="center">

# ScanReceipt

**Scan paper receipts on your phone. Store, date, total and tax are read on the device: no account, no cloud, no tracking.**

[![CI](https://github.com/LouziAmine/ScanReceipt/actions/workflows/1-ci.yml/badge.svg?branch=master)](https://github.com/LouziAmine/ScanReceipt/actions/workflows/1-ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS-0F766E)
![Angular](https://img.shields.io/badge/Angular-22-DD0031)
![Ionic](https://img.shields.io/badge/Ionic-9-3880FF)
![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF)

**[Try the web demo](https://louziamine.github.io/ScanReceipt/)** (no camera or OCR in the browser: pick a photo and type the details)

</div>

## Features

- **Scan** with edge detection and perspective correction (VisionKit on iOS, ML Kit on Android), or import a photo.
- **Automatic reading** of the store, date, total and sales tax, with a confidence level per field. Doubtful fields are highlighted for review.
- **Smart categories**: keyword suggestions, and store rules ("always file Starbucks under Dining").
- **Search and filters** by text, exact amount, period, category, amount range and review status.
- **Totals** per day, week, month and year, by category. Amounts in different currencies are never mixed.
- **Export** to CSV (Excel and Google Sheets ready, protected against formula injection), PDF reports, photo ZIPs.
- **Backup and restore** in a single ZIP file, with a monthly reminder.
- **Private by design**: everything stays on the phone. See [PRIVACY.md](PRIVACY.md).

Full feature reference: [docs/02-features.md](docs/02-features.md).

## Quick start

Requirements: Node.js 24 and npm 12.0.1, or just Docker.

```bash
git clone https://github.com/LouziAmine/ScanReceipt.git
cd ScanReceipt
npm ci
npm start          # http://localhost:4200 (browser: no camera, no OCR, manual entry)
npm run verify     # format, lint, typecheck, tests and build: what the CI runs
```

On a phone:

```bash
npm run android    # build, sync and open Android Studio (JDK 21, SDK 36)
npm run ios        # build, sync and open Xcode (macOS, Xcode 26+, CocoaPods)
```

With Docker only (Node, JDK 21 and the Android SDK are in the image):

```bash
docker compose build && docker compose run --rm install
docker compose up dev                     # http://localhost:4200
docker compose run --rm android           # debug APK in dist/android/
```

More in the [development guide](docs/06-development.md).

## Tech stack

Angular 22 (standalone, signals, zoneless) · Ionic 9 · Capacitor 8 · SQLite · ML Kit · TypeScript 6 strict ·
Vitest · ESLint · Prettier · Docker · GitHub Actions.

The code follows **Clean Architecture and Domain-Driven Design**: business rules live in plain TypeScript in
`src/app/domain`, and every native feature sits behind a port. Details in [docs/04-architecture.md](docs/04-architecture.md).

## Documentation

| Guide | For |
| --- | --- |
| [Product overview](docs/01-product.md) | Product owners, anyone new to the project |
| [Features](docs/02-features.md) | Everyone |
| [Technologies](docs/03-technologies.md) | Developers, DevOps |
| [Architecture](docs/04-architecture.md) | Developers |
| [Database](docs/05-database.md) | Developers |
| [Development guide](docs/06-development.md) | Developers, contributors |
| [Testing guide](docs/07-testing.md) | Testers, QA |
| [CI/CD and releases](docs/08-ci-cd.md) | DevOps, maintainers |
| [Project management](docs/09-project-management.md) | Managers, product owners |

## Contributing

Contributions are welcome: bug reports, OCR samples, features, documentation. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

To report a security issue, do **not** open a public issue: see [SECURITY.md](SECURITY.md).

## License

Copyright 2026 Amine Louzi.

Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE).
