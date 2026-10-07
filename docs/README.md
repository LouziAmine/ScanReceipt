# ScanReceipt documentation

ScanReceipt is an open-source iOS and Android app that scans paper receipts. It reads the store, date, total and
sales tax **on the phone itself** and files each receipt in a category, so you can track your spending and export
your receipts. No data ever leaves the device: there is no server, no account and no cloud.

> Documented version: **1.0.0 (MVP)** · Target market: USA (English UI) · License: [Apache 2.0](../LICENSE)

## Where to start

| Role                | Read first                                                                                       | Time   |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| **Contributor**     | [Contributing](../CONTRIBUTING.md), then [Development guide](06-development.md)                  | 30 min |
| **Developer**       | [Development guide](06-development.md), [Architecture](04-architecture.md), [Database](05-database.md), [Technologies](03-technologies.md) | 1 h 15 |
| **Tester / QA**     | [Testing guide](07-testing.md), then [Features](02-features.md)                                  | 45 min |
| **DevOps**          | [CI/CD and releases](08-ci-cd.md), then [Technologies](03-technologies.md)                       | 45 min |
| **Product owner**   | [Product overview](01-product.md), then [Features](02-features.md)                               | 30 min |
| **Manager**         | [Project management](09-project-management.md), then [Product overview](01-product.md)           | 20 min |

## Contents

1. [Product overview](01-product.md): vision, users, v1 scope, what is not in v1, roadmap
2. [Features](02-features.md): one chapter per feature, with user flow, business rules, limits, acceptance criteria and code location
3. [Technologies](03-technologies.md): every technology with its role, version, why it was chosen and its known pitfalls
4. [Architecture](04-architecture.md): Clean Architecture and DDD, layers, ports and adapters, main flows, security, performance
5. [Database](05-database.md): SQLite schema, why not PostgreSQL, review, improvements, migration example
6. [Development guide](06-development.md): setup, commands, conventions, adding a feature, migrations, tests, pitfalls
7. [Testing guide](07-testing.md): environments, test console, full test plan, device matrix, bug reports
8. [CI/CD and releases](08-ci-cd.md): Docker, the 5 GitHub Actions workflows (including the web demo), secrets, release process, troubleshooting
9. [Project management](09-project-management.md): status, metrics, costs, risks, release checklist, decisions

## Glossary

| Term                   | Meaning                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| **OCR**                | Optical character recognition: reading text from an image. Here ML Kit, running offline on the phone.  |
| **Reading**            | What the app extracts from the OCR text: store, date, total and tax, each with a confidence level.      |
| **Doubtful field**     | A field the OCR is not sure about. It is highlighted, and the receipt is flagged "Needs review".        |
| **Store rule**         | "Always file receipts from this store under this category", created from the review screen.            |
| **Aggregate**          | A domain object that enforces its own rules (`Receipt`, `Category`). A DDD term.                        |
| **Port / adapter**     | An interface owned by the application (port) and its technical implementation (adapter: SQLite, ML Kit). |
| **AAB**                | Android App Bundle, the format Google Play requires.                                                    |
| **TestFlight**         | Apple's beta distribution service for iOS builds.                                                       |
| **Artifact**           | A file produced by a GitHub Actions run that you can download (APK, screenshots).                       |
