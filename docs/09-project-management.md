# Project management

For managers and product owners.

## Project status

October 2026.

| Area | Status | Comment |
| --- | --- | --- |
| MVP v1 features (F1 to F11) | ✅ Done | See [Features](02-features.md) |
| Unit tests | ✅ 61 tests, all green | Business rules, OCR, CSV, backup, currencies |
| Code quality | ✅ Checked on every push | Format, lint, types, tests, build |
| CI/CD on GitHub Actions | ✅ In place | 5 workflows; releases and web demo still to be validated on first use |
| Android build (debug APK) | ✅ Automatic | Downloadable artifact on every push |
| iOS build | ⚠️ To validate | Compiles in macOS CI (manual); release never run |
| Multi-currency totals | ✅ Fixed | Totals use the Settings currency; other currencies are flagged ([Database](05-database.md#improvements)) |
| Atomic restore | ✅ Fixed | One transaction ([Database](05-database.md#improvements)) |
| Real-device testing | ⚠️ To plan | Camera and OCR can only be tested on a device |
| Store accounts | ❌ To create | Google Play ($25 once), Apple Developer ($99/year) |
| Privacy policy | ✅ In the repo | [PRIVACY.md](../PRIVACY.md), linked from the app's Settings |
| App id | ⚠️ To confirm | `app.scanreceipt.mobile`, final after the first store release |
| Web demo | ⚠️ Ready, waiting for the public repo | https://louziamine.github.io/ScanReceipt/ (GitHub Pages, workflow 5) |
| Open source | ✅ Apache 2.0 | [LICENSE](../LICENSE), [CONTRIBUTING](../CONTRIBUTING.md), [Code of Conduct](../CODE_OF_CONDUCT.md), [Security](../SECURITY.md) |

## Metrics

| Metric | Where to see it | Target |
| --- | --- | --- |
| Green CI on `master` | Actions tab → 1 · CI | 100% |
| Open bugs by severity | GitHub issues | 0 blockers before a release |
| Share of fields to review after OCR | Acceptance testing (F2 test plan) | As low as possible; every misread receipt becomes a test case |
| Initial bundle size | Build log | ≤ 200 kB gzipped |
| Start-up crashes (Android 24 / 30 / 36, iPhone) | 2 · QA workflow | 0 |
| GitHub Actions minutes | Settings → Billing | < 2,000 per month while private |

## Costs

| Item | Cost | Frequency |
| --- | --- | --- |
| Google Play Console | $25 | Once |
| Apple Developer Program | $99 | Per year |
| GitHub (public repo), including Actions and the Pages web demo | $0 | — |
| Servers, database, cloud | **$0**: no infrastructure | — |
| Privacy policy hosting | $0 (in the repo) | — |

Because everything runs on the device, there is **no running cost**, and no personal data is stored by the project.

## Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Inaccurate OCR on some receipts | Medium | Medium | Doubtful fields highlighted, manual entry always possible, test case added for every misread receipt |
| Data loss (lost phone) | High for the user | Medium | ZIP backup + monthly reminder |
| Lost Android keystore | **Critical**: no more updates | Low | Copy in a secure vault, GitHub secret |
| Store rejection (privacy) | Release delay | Low | Privacy manifest, no data collected, permission texts in place |
| New store requirements (target API, Xcode SDK) | Updates blocked | Yearly | Android targets API 36, Xcode 26; update the CI every year |
| Dependency on ML Kit / CocoaPods | Medium | Low | Ports and adapters: the OCR engine can be replaced |
| Unmaintained after open-sourcing | Medium | Medium | Clear contributing guide, issue templates, CI on every PR |

## Release checklist

Definition of Done for a release:

- [ ] Every user story of the version is accepted by the product owner.
- [ ] Green CI on `master`.
- [ ] [Test plan](07-testing.md#test-plan) run: **0 blocker or major bug**.
- [ ] Tested on at least **one real Android phone and one real iPhone** (scan, OCR, sharing, backup/restore, notification).
- [ ] 2 · QA workflow green (Android 24 / 30 / 36 + iPhone).
- [ ] Version bumped (`npm run version:set`) and `CHANGELOG.md` updated.
- [ ] Store listings ready: screenshots, description, category, age rating, *Data safety* (Google) and *App Privacy* (Apple) saying "no data collected".
- [ ] Tag `vX.Y.Z` pushed, which creates the GitHub Release and the Play internal upload.
- [ ] iOS sent to TestFlight (workflow 4).
- [ ] Internal beta validated, then promoted to production.

## Definition of Done for a user story

- [ ] Acceptance criteria met (see the feature's chapter).
- [ ] Business rules in `domain/` with unit tests.
- [ ] `npm run verify` green, PR reviewed, CI green.
- [ ] Test cases added to the [test plan](07-testing.md#test-plan).
- [ ] Documentation updated (`docs/`) and `CHANGELOG.md` entry added.

## Decision log

| Decision | Reason | Consequence |
| --- | --- | --- |
| 100% on-device, no server | Privacy, no infrastructure cost, works offline | No sync: the ZIP backup is essential |
| Ionic + Angular + Capacitor | One codebase for iOS and Android, native look | iOS always builds on macOS (CI or Mac) |
| ML Kit for OCR | Free, offline, accurate | iOS ≥ 15.5 and CocoaPods required |
| Clean Architecture + DDD | Testable business rules, independent of technologies | More files, safer changes |
| English UI | First target market is the USA | Localization needed for other markets |
| Manual iOS jobs in CI | macOS minutes count ×10 on private repos | Run the iOS build before each release |
| Single `master` branch + PRs | Small team | Add a `develop` branch if the team grows |
| Open source under Apache 2.0 | Permissive, with an explicit patent grant | Anyone may reuse the code, keeping the license and NOTICE |
| Totals never mix currencies | `Money` rule: a sum only makes sense in one currency | Receipts in other currencies are counted and flagged |

## Roles and responsibilities

Simplified RACI.

| Activity | PO | Manager | Dev | QA | DevOps |
| --- | --- | --- | --- | --- | --- |
| Backlog prioritization | **R/A** | C | C | I | I |
| Development and unit tests | I | I | **R/A** | C | I |
| Acceptance testing (test plan) | A | I | C | **R** | I |
| CI/CD, secrets, releases | I | A | C | I | **R** |
| Store accounts, listings, publishing | **R** | A | I | I | C |
| Risk and cost tracking | C | **R/A** | I | I | C |

R = responsible · A = accountable · C = consulted · I = informed
