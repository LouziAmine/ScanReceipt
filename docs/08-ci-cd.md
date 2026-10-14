# CI/CD and releases

## Overview

```
 push / PR on master ──> 1 · CI · Quality & Build ──> debug APK (artifact)
                                   │
 manual ──────────────────> 2 · QA · Emulators & Simulators ──> screenshots Android 24/30/36 + iPhone
                                   │
 manual, from tag v1.2.3 ─> 3 · Release · Android ──> GitHub Release (signed AAB + APK) ──> Google Play (fastlane)
                                   │
 manual, from tag v1.2.3 ─> 4 · Release · iOS ──> App Store Connect: TestFlight + store listing (fastlane)
                                   │
 green CI on master ──────> 5 · Deploy · Web demo ──> https://louziamine.github.io/ScanReceipt/
                                   │
 manual ──────────────────> 6 · Live test · Appetize ──> a link per device, the app in the browser
                                   │
 green CI on master ──────> 7 · Testers · Real devices ──> pre-release "testers": APK + 2 QR codes
```

Only **1 · CI**, **5 · Deploy** and **7 · Testers** run by themselves. **2, 3, 4 and 6 run only from *Run workflow*** (or
`./tester.sh` entries 16 – 23), never on a commit. Pushing a tag starts **3 and 4** only when the repository variable
`RELEASE_ON_TAG` is `true` (see [Store publishing with fastlane](#store-publishing-with-fastlane)).

| Workflow | File | Trigger | Runner | Typical duration |
| --- | --- | --- | --- | --- |
| **1 · CI · Quality & Build** | `.github/workflows/1-ci.yml` | push on `master`, pull request, manual | Ubuntu (+ macOS when manual) | ~5–10 min |
| **2 · QA · Emulators & Simulators** | `.github/workflows/2-qa-devices.yml` | manual | Ubuntu ×4 + macOS | ~20–30 min |
| **3 · Release · Android (GitHub + Google Play)** | `.github/workflows/3-release-android.yml` | manual, from a tag `v*.*.*` (tag push if `RELEASE_ON_TAG`) | Ubuntu | ~15 min |
| **4 · Release · iOS (App Store)** | `.github/workflows/4-release-ios.yml` | manual, from a tag `v*.*.*` (tag push if `RELEASE_ON_TAG`) | macOS | ~30–40 min |
| **5 · Deploy · Web demo (GitHub Pages)** | `.github/workflows/5-deploy-web.yml` | after a green CI on `master`, manual | Ubuntu | ~2 min |
| **6 · Live test · Appetize (browser)** | `.github/workflows/6-live-test-appetize.yml` | manual (start / stop, Android by default) | Ubuntu (+ macOS for iOS) | ~5 min |
| **7 · Testers · Real devices (QR codes)** | `.github/workflows/7-testers-devices.yml` | after a green CI on `master`, manual | Ubuntu | ~10 min |

Every workflow uses **Node 24 + npm 12.0.1** (same as the `Dockerfile`), and **JDK 21 + Gradle** for Android.

## Workflow details

### 1 CI Quality and Build

| Job | Steps | Output |
| --- | --- | --- |
| Quality gate | `npm ci` → `format:check` → `lint` → `typecheck` → `test` → `build` | `www` artifact (7 days) |
| Android · debug APK | `scripts/android-build.sh debug` | `scanreceipt-debug-apk` artifact (14 days) |
| iOS · simulator build | **manual runs only** (`Run workflow`): `ng build` → `cap sync ios` → `pod install` → unsigned `xcodebuild` | proves the iOS project compiles |

- `concurrency`: a new push cancels the previous run on the same branch.
- The Android and iOS jobs only start when the quality gate passes.

#### Why the iOS job is grey on a push

On a normal push, the run shows **iOS · simulator build** with a grey crossed circle, `0s`, and *"This job was
skipped"*. **This is expected, not a failure**: the job has the condition
`if: github.event_name == 'workflow_dispatch'`, so it only runs when the workflow is started by hand. A failure would
show a red ✗, and the run status would not be *Success*.

To run the iOS build:
1. Open **Actions → 1 · CI · Quality & Build** (the workflow page, not a run).
2. Click **Run workflow ▾**, keep **Branch: master**, then click the green **Run workflow** button.
3. A new run appears at the top of the list, this time with the iOS job (about 10 to 20 minutes on macOS).

> **"Re-run all jobs" does not start the iOS job.** A re-run keeps the original event (`push`), so the job is skipped
> again. Always use **Run workflow**.

### 2 QA Emulators and Simulators

- Builds the debug APK once, then runs it on **Android emulators API 24, 30 and 36** in parallel (`reactivecircus/android-emulator-runner`, KVM enabled).
- Runs the app on an **iPhone simulator** (macOS).
- Artifacts: `android-run-api24`, `android-run-api30` and `android-run-api36` (screenshot + logcat) and `ios-run` (screenshot), kept 7 days.
- The job fails if the app is no longer running after 20 s (`pidof`).

### 3 Release Android

1. Checks that **the tag matches the `package.json` version**. For example, tag `v1.1.0` requires `"version": "1.1.0"`.
2. Runs `npm run verify`.
3. Rebuilds the keystore from the secret, then runs `scripts/android-build.sh release`, which produces the signed AAB and APK.
4. Creates a **GitHub Release** with both files and auto-generated release notes.
5. When the `PLAY_SERVICE_ACCOUNT_JSON` secret exists: takes the store screenshots, writes the release notes, then
   **fastlane** uploads the AAB, the texts, the icon, the screenshots and the notes to **Google Play**, on the track
   chosen in *Run workflow* or in the `PLAY_TRACK` variable (`internal` by default).

### 4 Release iOS

1. Checks that **the tag matches the `package.json` version**, then runs `npm run verify`, `cap sync ios` and `pod install`.
2. `xcodebuild archive` with **automatic signing** through the App Store Connect API key (`-allowProvisioningUpdates`): no `.p12` or profile to manage.
3. `xcodebuild -exportArchive` writes the signed IPA.
4. Takes the store screenshots (iPhone 6.7" and iPad 13"), writes the release notes, then **fastlane** uploads the IPA
   (it appears in TestFlight), the texts and the screenshots to **App Store Connect**. With *Submit for review* (or the
   `IOS_SUBMIT_FOR_REVIEW` variable), the version goes to Apple review.
5. The `.p8` key is removed from the runner at the end, even on failure.

> This workflow has not run yet: it will be validated the first time, once the Apple Developer account exists.

### 5 Deploy Web demo

Publishes the browser version of the app to **https://louziamine.github.io/ScanReceipt/**.

1. Starts when **1 · CI · Quality & Build** finishes green on `master` (`workflow_run`), or by hand.
2. Checks out the exact commit the CI validated.
3. Builds with `ng build --configuration demo`:
   - `baseHref` is `/ScanReceipt/`, the path GitHub Pages serves the project under;
   - `sql-wasm.wasm` is bundled, so SQLite runs in the browser;
   - `environment.demo.ts` turns on the "Web demo" banner on the receipts list;
   - `ngsw-config.json` adds the Angular service worker, which makes the demo an installable app (PWA).
4. Copies `index.html` to `404.html`, so a direct link such as `/ScanReceipt/settings` opens the right screen.
5. Uploads the site and deploys it to the `github-pages` environment. The run summary shows the URL.

What the demo can and cannot do:

| Works in the demo | Phone only |
| --- | --- |
| List, search, filters, categories, totals, CSV/PDF exports, backup | Camera scanning with edge detection |
| Adding a receipt from a photo, read by Tesseract.js in the browser | Faster and more accurate reading (ML Kit OCR) |

Data stays in each visitor's browser (IndexedDB): nothing is sent to a server.

**Installable app (PWA)**

Visitors can install the demo like an app, without a store:

- Android, and Chrome or Edge on a computer: the **Install the app** button in the demo banner opens the
  browser's install dialog. The browser's own menu (*Install app*, *Add to Home screen*) works too.
- iPhone and iPad (Safari, Chrome, Firefox, Edge): iOS has no install dialog, so the same button shows the steps
  for the browser in use: *Share* (in Safari's toolbar or behind •••, in Chrome's address bar), then
  *Add to Home Screen*, then *Add*.

The service worker (`ngsw-config.json`) downloads the app's files on the first visit, so the installed app opens
offline. The OCR files (about 6 MB) are kept the first time a photo is read; exchange rates once fetched. The
manifest is `public/manifest.webmanifest`. After a deploy, open visitors get a "Reload" toast for the new
version. The service worker is registered only in the `demo` build, never in the phone apps.

**One-time setup**
1. Make the repository public: *Settings → General → Danger Zone → Change visibility*. GitHub Pages is free for public repositories and needs a paid plan for private ones.
2. *Settings → Pages → Build and deployment → Source*: choose **GitHub Actions**.
3. *Actions → 5 · Deploy · Web demo → Run workflow*, or push to `master`.

While the repository is private, the job is skipped (grey), not failed.

Test the demo build locally:

```bash
npx ng build --configuration demo
cp www/index.html www/404.html
mkdir -p /tmp/site && rm -rf /tmp/site/ScanReceipt && cp -r www /tmp/site/ScanReceipt
python3 -m http.server 8080 --directory /tmp/site     # http://localhost:8080/ScanReceipt/
```

### 7 Testers Real devices

Lets manual testers install the app on their own phone by scanning a QR code. The page never moves:
**https://github.com/LouziAmine/ScanReceipt/releases/tag/testers**, and the run summary shows the same content.

1. Starts when **1 · CI · Quality & Build** finishes green on `master`, or by hand, and checks out that commit.
2. Builds the release APK (R8, like the store app) with `scripts/android-build.sh release`.
3. Replaces the GitHub pre-release `testers` with `ScanReceipt.apk` and two QR codes (`qrencode`):
   - **Android**: the QR code downloads the APK. Open it and allow installing apps from this source once.
   - **iPhone**: the QR code opens the web demo (PWA) in Safari; *Share → Add to Home Screen* installs it, and it
     works offline. iOS installs a native app on a real iPhone only through TestFlight, which needs the Apple
     Developer account: the iPhone QR code will point to the TestFlight public link then.

The download links stay the same from one build to the next, so a printed QR code keeps working.

**Signing.** With the four `ANDROID_KEYSTORE_*` secrets, the APK is signed with the store key. Without them, a
*testers* key created on the first run and kept in the Actions cache signs it, so new builds install over the old one.
GitHub drops a cache unused for 7 days: the next build then has a new key, and testers uninstall the app once.

## Secrets and variables

Create them in GitHub under *Settings → Secrets and variables → Actions*.

| Name | Type | Used by | Content / how to get it |
| --- | --- | --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Secret | 3, 7 | `base64 -w0 android/release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Secret | 3, 7 | Keystore password |
| `ANDROID_KEY_ALIAS` | Secret | 3, 7 | `scanreceipt` |
| `ANDROID_KEY_PASSWORD` | Secret | 3, 7 | Key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Secret (optional) | 3 | JSON of a Google Cloud service account invited in Play Console with release rights |
| `ASC_KEY_ID` | Secret | 4 | App Store Connect → Users and Access → Integrations → API key (role **Admin**) |
| `ASC_ISSUER_ID` | Secret | 4 | Same page (Issuer ID) |
| `ASC_PRIVATE_KEY` | Secret | 4 | Content of the `.p8` file (downloadable only once) |
| `IOS_TEAM_ID` | **Variable** | 4 | developer.apple.com → Membership (10 characters) |
| `RELEASE_ON_TAG` | Variable (optional) | 3, 4 | `true`: pushing a tag `v*.*.*` publishes on both stores. Otherwise *Run workflow* |
| `PLAY_TRACK` | Variable (optional) | 3 | `internal` (default), `alpha`, `beta` or `production` |
| `PLAY_ROLLOUT` | Variable (optional) | 3 | For example `0.2`: the update reaches 20% of users first. Empty: everyone |
| `IOS_SUBMIT_FOR_REVIEW` | Variable (optional) | 4 | `true`: send each uploaded version to Apple review |
| `IOS_AUTOMATIC_RELEASE` | Variable (optional) | 4 | `true`: publish on the App Store as soon as Apple approves |

**Create the Android keystore once.** Keep it safe: if it is lost, Google Play will never accept an update of the app again.

```bash
keytool -genkeypair -v -keystore android/release.keystore -alias scanreceipt -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 android/release.keystore     # → ANDROID_KEYSTORE_BASE64 secret
```

`release.keystore` is ignored by git. Keep a copy outside your computer, in a password manager or a vault.

> **Forks**: secrets are never passed to workflows triggered by pull requests from forks. Only the CI workflow runs on
> those, and it does not need any secret.

## Release process

```bash
npm run version:set -- 1.1.0          # package.json, environment.ts, Android (versionName/Code), iOS (Marketing/Build)
# update CHANGELOG.md
git commit -am "release: 1.1.0"
git tag v1.1.0
git push --follow-tags                # pushes the tag; publishes only if RELEASE_ON_TAG is true
```

Then, unless `RELEASE_ON_TAG` is `true`: *Actions → 3 · Release · Android → Run workflow* and
*Actions → 4 · Release · iOS (App Store) → Run workflow*, both with **Use workflow from = Tags → v1.1.0**.

| Step | Android | iOS |
| --- | --- | --- |
| First release | **The very first AAB must be uploaded by hand** in Play Console | The app must be created by hand in App Store Connect |
| After that | Automatic: build, texts, images, screenshots, notes | Automatic: build (TestFlight), texts, screenshots, notes |
| Going to production | `PLAY_TRACK=production` (with `PLAY_ROLLOUT` for a progressive release) | *Submit for review* or `IOS_SUBMIT_FOR_REVIEW=true`; `IOS_AUTOMATIC_RELEASE=true` to publish once approved |

The stores refuse a build number that was already uploaded. `version:set` bumps it every time.

## Store publishing with fastlane

[fastlane](https://fastlane.tools) publishes the app **and its store listing** through the official APIs (Google Play
Developer API, App Store Connect API). Everything a store page shows lives in the repository:

| What | Where | How it is made |
| --- | --- | --- |
| Name, short and full description, keywords, subtitle, promotional text (7 languages) | `fastlane/metadata/android/<locale>/`, `fastlane/metadata/ios/<locale>/` | Committed text files: edit them |
| Support, privacy and marketing URLs, category, copyright | `fastlane/metadata/ios/` | Committed text files |
| Screenshots: iPhone 6.7" (1290 × 2796), iPad 13" (2048 × 2732), Android (1080 × 2160), 5 screens × 7 languages | `fastlane/screenshots/ios/`, `fastlane/metadata/android/<locale>/images/` | `npm run store:screenshots` (not committed) |
| Google Play icon (512 px) and feature graphic (1024 × 500) | `fastlane/metadata/android/en-US/images/` | `npm run store:screenshots` (not committed) |
| "What's new" in English | `changelogs/<versionCode>.txt`, `ios/en-US/release_notes.txt` | `npm run store:notes`, from `CHANGELOG.md` (not committed) |
| "What's new" in the other languages | `changelogs/default.txt`, `ios/<locale>/release_notes.txt` | Committed generic text: update it for a big release |

Locales: `en-US`, `fr-FR`, `ar` / `ar-SA`, `zh-CN` / `zh-Hans`, `es-ES`, `de-DE`, `pt-BR` (Play / App Store). Store
limits: name 30 characters, subtitle 30, keywords 100, short description 80, promotional text 170, description 4000.

**Screenshots** come from the web build: `scripts/store-screenshots.mjs` restores sample receipts (with receipt photos
it draws) through *Backup → Restore*, in each language and currency, then captures each screen at the store sizes.

```bash
npx ng build --configuration development       # web build with SQLite in WebAssembly
npx playwright-core install chromium-headless-shell   # once
npm run store:screenshots                      # or: npm run store:screenshots -- fr de
npm run store:notes
```

**Lanes** (`fastlane/Fastfile`, run by workflows 3 and 4; Ruby 3.3 and `bundle install` to run them locally):

| Command | Does |
| --- | --- |
| `bundle exec fastlane android release aab:<file>` | AAB + listing + screenshots + notes → Google Play (`PLAY_TRACK`) |
| `bundle exec fastlane android metadata` | Listing and screenshots only, no new build |
| `bundle exec fastlane ios release ipa:<file>` | IPA + listing + screenshots + notes → App Store Connect |
| `bundle exec fastlane ios metadata` | Listing and screenshots only, no new build |

### Store accounts checklist

Done once, by hand: no API can do these steps.

**Google Play** (25 USD, once)
1. Create the developer account at [play.google.com/console](https://play.google.com/console) (identity check, can take a few days).
2. *Create app*: name ScanReceipt, default language English (United States), free.
3. Fill in *App content*: privacy policy URL (PRIVACY.md), **Data safety** (no data collected or shared), ads (none),
   content rating questionnaire, target audience.
4. Create the keystore and the 4 `ANDROID_*` secrets (above), run workflow 3 once, and **upload that first AAB by hand**
   (*Testing → Internal testing → Create release*). It also enrolls the app in Play App Signing.
5. Google Cloud: create a service account with a JSON key, then in Play Console *Users and permissions → Invite*, give
   it release rights for the app. Save the JSON in the `PLAY_SERVICE_ACCOUNT_JSON` secret.
6. New personal accounts must run a closed test (12 testers, 14 days) before production access.

**App Store** (99 USD per year)
1. Join the [Apple Developer Program](https://developer.apple.com/programs/).
2. Register the bundle id `app.scanreceipt.mobile` (*Certificates, Identifiers & Profiles*), then in
   [App Store Connect](https://appstoreconnect.apple.com) *Apps → +*: name ScanReceipt, primary language English (U.S.).
3. *Users and Access → Integrations*: create an API key with the **Admin** role → `ASC_KEY_ID`, `ASC_ISSUER_ID`,
   `ASC_PRIVATE_KEY` secrets; the Team ID → `IOS_TEAM_ID` variable.
4. Fill in once: **App Privacy** (Data Not Collected), age rating, price (free), the App Review contact and notes.
5. Run workflow 4. When the listing looks right, set `IOS_SUBMIT_FOR_REVIEW=true` (and `RELEASE_ON_TAG=true` for
   one-push releases).

Both stores still review every version by hand, usually in 1 to 2 days.

## Store publishing

| To do | Where |
| --- | --- |
| Use your own app id instead of `app.scanreceipt.mobile` (forks) | `capacitor.config.ts`, then `npx cap sync` (and the Bundle ID in Xcode) |
| Privacy policy URL | Already set to [PRIVACY.md](../PRIVACY.md) in `src/environments/environment.ts` (`privacyPolicyUrl`) |
| Version | `npm run version:set` (package.json, environment.ts, Android versionName/versionCode, iOS Marketing Version/Build) |
| Signing | Release workflows (above), or Android Studio > Generate Signed Bundle and Xcode > Archive |
| Store listing, screenshots, release notes | [Store publishing with fastlane](#store-publishing-with-fastlane) |
| Real-device check | Scan, OCR, sharing, backup/restore, notification |

Already in place:
- camera and photo permission texts (`Info.plist`);
- iOS **privacy manifest** (`PrivacyInfo.xcprivacy`) and no non-exempt encryption;
- icons and splash screens generated from the logo;
- `SCHEDULE_EXACT_ALARM` removed on Android (restricted by Google Play);
- strict CSP in `index.html`.

To change the logo, edit `assets/logo.svg` (plain `<path>` elements in a 1024 x 1024 viewBox), then run
`npm run assets`. Icons and splash screens stay vectors: SVG on the web and in the iOS asset catalog,
VectorDrawable on Android. Only the iOS App Store icon, the iOS home-screen icon and a 512 px PWA fallback are
PNG, because those platforms accept nothing else.

## Docker

The `scanreceipt/toolchain` image ships Ubuntu Noble, JDK 21, Node 24, npm 12.0.1 and Android SDK 36: the same build environment for everyone.

| Command | Purpose |
| --- | --- |
| `docker compose build` | Builds the image (~10 min the first time) |
| `docker compose run --rm install` | `npm ci` into a volume |
| `docker compose up dev` | Dev server on http://localhost:4200 |
| `docker compose run --rm verify` | Same checks as the CI |
| `docker compose run --rm android` | Debug APK into `dist/android/` |
| `docker compose run --rm android-release` | Signed AAB + APK (`.env.android` file, from `.env.android.example`) |
| `docker compose run --rm android-install` | Installs the APK on a USB phone (Linux) |
| `docker compose run --rm emulator` | Headless emulator: installs and starts the APK, saves a screenshot and the logcat (Linux + KVM) |
| `docker compose run --rm emulator-gui` | Emulator in a window (Linux X11) |
| `docker build --target apk-export --output dist .` | APK with no setup at all |

The `node_modules`, `gradle-cache` and `npm-cache` volumes keep dependencies between runs.
**iOS cannot be built in Docker** (Apple requires macOS): use the macOS CI or a Mac.

## GitHub Actions costs

| Item | Free plan, **private** repo | Public repo |
| --- | --- | --- |
| Minutes per month | 2,000 | Unlimited on standard runners |
| macOS multiplier | ×10 (1 macOS minute = 10 minutes counted) | — |
| Artifact storage | 500 MB | — |

Choices made to stay within quota while the repo is private:
- macOS jobs are **manual**;
- artifacts are kept 7 to 14 days;
- a new push cancels the running CI (`concurrency`).

### Reading the Usage page

Each run has a **Usage** page (left menu → *Usage*) with the run time of every job. Example of a normal push:

| Job | Runner | Run time | Minutes counted on the quota |
| --- | --- | --- | --- |
| Quality gate (format, lint, types, tests, build) | Linux | 40 s | 1 |
| Android · debug APK | Linux | 3 min 10 s | 4 |
| iOS · simulator build | macOS | 0 s (skipped) | 0 |
| **Total** | | **3 min 50 s** | **about 5** |

- GitHub **rounds each job up** to the next minute.
- A push therefore costs about **5 minutes**: roughly **400 pushes per month** fit in the 2,000 free minutes of a private repo.
- An iOS build takes about 15 minutes on macOS, counted ×10: **about 150 minutes per run**. Running it on every push
  would use the quota after about fifteen pushes, which is why it is manual while the repo is private.
- The monthly total is in your GitHub account: *Settings → Billing and licensing → Usage*.

## Troubleshooting

| Error | Likely cause | Fix |
| --- | --- | --- |
| `format:check` fails | Unformatted code | `npm run format`, then commit |
| `lint`: *no-restricted-imports* | Forbidden import between layers | See the [dependency rule](04-architecture.md#dependency-rule) |
| `npm ci`: incompatible lockfile | Wrong npm version | npm **12.0.1** |
| Release: *Tag … does not match package.json* | Tag differs from the version | `npm run version:set -- X.Y.Z`, commit, new tag |
| Unsigned AAB / refused by Play | `ANDROID_*` secrets missing or wrong | Check the 4 secrets |
| Play: *version code has already been used* | Build number reused | `npm run version:set` |
| iOS: `pod install` fails | CocoaPods cache / Xcode version | Re-run; check the runner's macOS image |
| iOS: *No signing certificate* | API key without the Admin role, or wrong `IOS_TEAM_ID` | Create a key with the Admin role |
| QA emulator timeout | Slow runner | *Re-run failed jobs* |
| Web demo job grey (skipped) | Repository is still private | Make it public, then set *Pages → Source* to GitHub Actions |
| Web demo: *Get Pages site failed* / *Not Found* | Pages not enabled | *Settings → Pages → Source: GitHub Actions* |
| Demo still shows the old version | The service worker serves the cached one until the new one is downloaded | Tap **Reload** in the toast, or close every tab of the demo and open it again |
| Web demo shows a blank page | Wrong base path or missing WebAssembly file | Build with `--configuration demo`, never the default production build |
| iOS job grey, "This job was skipped" | Normal on push/PR: the iOS job only runs on manual runs | *Run workflow* on the workflow page (not *Re-run*) |
| Old workflow names still listed | Runs are still attached to them | Delete those runs in the Actions tab |
