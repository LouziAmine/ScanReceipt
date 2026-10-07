# Contributing to ScanReceipt

Thank you for helping. Every contribution counts: a bug report, a receipt the OCR misreads, a fix, a feature or a
documentation improvement.

By taking part, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

| You want to… | Do this |
| --- | --- |
| Report a bug | Open a [bug report](https://github.com/LouziAmine/ScanReceipt/issues/new/choose) |
| Share a receipt the OCR reads badly | Open a bug report with the **raw OCR text** (Receipt details → OCR text). Hide personal data. |
| Suggest a feature | Open a [feature request](https://github.com/LouziAmine/ScanReceipt/issues/new/choose) first, so we can agree on it before you code |
| Fix something | Look for issues labelled `good first issue` or `help wanted`, comment to take one, then open a pull request |
| Report a vulnerability | **Never in a public issue**: follow [SECURITY.md](SECURITY.md) |

## Development setup

```bash
git clone https://github.com/<your-user>/ScanReceipt.git
cd ScanReceipt
npm install -g npm@12.0.1
npm ci
npm start
```

Docker, Android and iOS setups are in the [development guide](docs/06-development.md).

## Workflow

1. **Fork** the repository and create a branch from `master`:
   `git checkout -b fix/tax-equal-to-total` (prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `ci/`).
2. Make your change, **with tests** when it touches business rules (`src/app/domain`) or the OCR reader.
3. Run the same checks as the CI:
   ```bash
   npm run verify
   ```
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `test: …`, `ci: …`.
5. Push and open a **pull request** against `master`, and fill in the template.
6. The CI runs on your pull request. A maintainer reviews it, usually within a week.

## Code guidelines

- **Architecture**: Clean Architecture + DDD. Respect the [dependency rule](docs/04-architecture.md#dependency-rule): ESLint fails the build otherwise.
- **Strict TypeScript**, strict ESLint, Prettier (`npm run format`).
- **Angular**: standalone components, `OnPush`, signals, built-in control flow.
- **Ionic**: deep imports only (`@ionic/angular/ion-button`), never the `@ionic/angular` barrel.
- **Money**: integer cents through `Money`; never add two currencies (`sumByCurrency`).
- **Database**: never edit a shipped migration; append a new one.
- **No network calls**: the app must keep working offline and never send user data anywhere.
- **Language**: UI text, code, comments and documentation in English.

The full list, with the reasons behind each rule, is in the [development guide](docs/06-development.md).

## Improving the OCR

The OCR reader is a pure function, `readReceipt` in `src/app/domain/receipts/reading/receipt-reader.ts`, tested with
real receipts in `receipt-reader.spec.ts`. To fix a misread receipt:

1. Add its raw OCR text as a new test case, with the expected store, date, total and tax.
2. Change the reader until the new case passes.
3. Make sure every existing case still passes (`npm test`).

## Documentation

Docs live in [`docs/`](docs/README.md). Update them in the same pull request when you change a behavior, a command or
a workflow. Link only to headings made of plain words, so that anchors work on GitHub and in editors.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE), the license of
this project.
