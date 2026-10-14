# Testing guide

## Where to test

| Environment | What works | What does not | How to get it |
| --- | --- | --- | --- |
| **Real Android phone** | Everything | — | QR code on the [testers page](https://github.com/LouziAmine/ScanReceipt/releases/tag/testers), or `./tester.sh` entry 4 |
| **Real iPhone** | Everything | — | TestFlight (once the Apple account exists) or Xcode. Until then, the iPhone QR code on the [testers page](https://github.com/LouziAmine/ScanReceipt/releases/tag/testers) opens the web demo |
| **Android emulator** | Everything except the camera scanner | Camera scanner (ML Kit) | `./tester.sh` entries 2 and 3, or the "2 · QA" workflow |
| **iPhone simulator** | UI, photo import | Camera | "2 · QA" workflow, or a Mac |
| **Web demo** | UI, photo import with OCR (Tesseract.js), exports | Camera | https://louziamine.github.io/ScanReceipt/ (nothing to install) |
| **Browser (local)** | UI, photo import with OCR (Tesseract.js) | Camera | `./tester.sh` entry 1 |

> **Before every release, test on at least one real Android phone and one real iPhone**: camera, OCR, sharing and notifications.

## Get a build without installing anything

1. Open https://github.com/LouziAmine/ScanReceipt/actions, then **1 · CI · Quality & Build**.
2. Open the latest green run and download the **scanreceipt-debug-apk** artifact at the bottom of the page.
3. Unzip it, copy `scanreceipt-debug.apk` to the phone and install it. You need to allow "unknown sources".

To get screenshots on several Android versions and on an iPhone, run **2 · QA · Emulators & Simulators** with
**Run workflow**. The results are in the `android-run-api24`, `android-run-api30`, `android-run-api36` and `ios-run` artifacts.

## Test console

`./tester.sh` is a numbered menu. Each run pulls the latest code and rebuilds the app.
Only Docker is needed, and the emulator needs Linux with KVM.

| # | Action |
| --- | --- |
| 1 | Web app in the browser |
| 2 | Android emulator in a window (manual testing) |
| 3 | Automated emulator test (screenshot + logs) |
| 4 | Install on an Android phone (USB) |
| 5 | Build the test APK |
| 6 | Full check (lint + tests + build) |
| 7 | Signed release build (Google Play) |
| 8 – 13 | Stop the web app, logs, status, stop everything, rebuild images, reset |
| 14 – 15 | Start / stop Docker |
| 16 | Cloud QA: start the **2 · QA** workflow (Android API 24 / 30 / 36 + iPhone) and follow it |
| 17 – 19 | Cloud QA: status, stop, download the screenshots and logs into `qa-results/<run id>/` |
| 20 | Live test: build the Android app, send it to Appetize, print a link per device (Pixel 7, Pixel 9 Pro) |
| 23 | Live test: same for the iPhone app (iPhone 15 Pro, iPhone 16 Pro Max), only when needed |
| 21 | Live test: show the latest links again |
| 22 | Live test: stop it (deletes the builds on Appetize, so the links stop working) |

Shortcut: `./tester.sh 2` runs entry 2 directly.

Entries 16 – 19 call `scripts/qa-cloud.sh` (also usable on its own: `run`, `status`, `stop`, `results`). They need
no Docker and no emulator on the computer, only a GitHub token allowed to run Actions on this repository, kept
outside the project:

1. https://github.com/settings/personal-access-tokens/new → *Only select repositories*: ScanReceipt →
   *Permissions*: **Actions: Read and write**.
2. Save it once:
   ```bash
   mkdir -p ~/.config/scanreceipt && chmod 700 ~/.config/scanreceipt
   printf '%s' 'github_pat_…' > ~/.config/scanreceipt/github-token
   chmod 600 ~/.config/scanreceipt/github-token
   ```

*Status* works without a token because the repository is public.

### Live test in the browser (Appetize)

Workflow **6 · Live test · Appetize** (or entry 20) builds the Android APK and the iPhone simulator app and uploads
them to [Appetize](https://appetize.io). The run summary, and entry 21, list one link per device: open it and use the
app in real time, with nothing to install. Anyone with a link can open it.

- **Cost**: the free plan streams **30 minutes a month**. Minutes count only while a link is open; a session stops
  when its tab is closed or after **2 minutes without a tap**. Building and uploading cost no minutes. Close the tab
  as soon as the check is done.
- **One-time setup**: create an Appetize account, then *Organization → API Tokens* (role *Developer*), and add the
  token in GitHub: *Settings → Secrets and variables → Actions → New repository secret* `APPETIZE_API_KEY`.
- **Stop**: close the tab. To make sure nobody uses an old link, run entry 22 (or the workflow with
  *action = stop*): it deletes the builds on Appetize. Appetize has no API call to end a session that is open.
- The camera scanner does not exist there (like in the emulators): use *Import from photos*.

## Suggested test data

Keep photos of varied receipts at hand:
- a clean supermarket receipt (Walmart, Costco…);
- a coffee shop or restaurant receipt;
- a gas station receipt;
- a crumpled or poorly lit receipt;
- a receipt without a "TOTAL" line;
- one receipt with a European date (31/12) and one with a US date (12/31);
- one receipt with tax (Sales tax / VAT) and one without.

## Test plan

Status to fill in: ✅ pass · ❌ fail · ⏭ not tested.

### F1 Scan

| ID | Steps | Expected result |
| --- | --- | --- |
| SC-01 | List → Scan → photograph a receipt → accept | "Reading your receipt…", then "Review receipt" |
| SC-02 | Scan → cancel the scanner | Back to the list, no error |
| SC-03 | ⋮ menu (Android) or image button (iOS) → Import from photos | The photo is processed like a scan |
| SC-04 | Settings → Image quality = Standard → scan | Smaller file (Backup & restore → storage used) |
| SC-05 | Browser → Scan → pick a file that is not an image (or an empty file) | "This file cannot be opened as a photo", nothing saved |
| SC-06 | Browser → Scan → pick a PNG, WebP, GIF or a photo over 20 MP | Saved as a JPEG; photos over 8 MP are reduced |

### F2 OCR

| ID | Steps | Expected result |
| --- | --- | --- |
| OC-01 | Scan a clean receipt with "TOTAL" | Store, date and total filled in; total not highlighted |
| OC-02 | Receipt without a readable date | Today's date, field highlighted "No date was found, today is used" |
| OC-03 | Receipt dated 03/04 with format MM/DD/YYYY | Date highlighted "Day and month could be swapped" |
| OC-04 | Starbucks / Walmart / Shell / CVS receipt | Dining / Groceries / Transportation / Health |
| OC-05 | Airplane mode on → scan | Everything works (offline OCR) |
| OC-06 | Browser → Scan → image of a clean receipt | "Text read automatically", store and total filled in |
| OC-07 | Browser → Scan → receipt photo turned sideways | Total read (the photo is turned before reading) |
| OC-08 | German "SUMME" / Polish "SUMA PLN" / Indonesian "Total Belanja 13,000" receipt | Total read from that line, not the cash paid |

### F3 Review

| ID | Steps | Expected result |
| --- | --- | --- |
| RV-01 | Clear the store → Save | "Enter the store name." |
| RV-02 | Tax greater than total → Save | "The tax cannot be more than the total." |
| RV-03 | Future date → Save | "The date cannot be in the future." |
| RV-04 | Type `1,234.56`, then `12,50` | Amounts read correctly |
| RV-05 | Save → Undo in the message | The receipt disappears from the list |
| RV-06 | Check "Always use for X" + category Y → Save → scan X again | Category Y suggested |
| RV-07 | Retake | The scanner opens again, new photo |
| RV-08 | Raw OCR text | The raw text is shown |

### F4 List search and filters

| ID | Steps | Expected result |
| --- | --- | --- |
| LI-01 | Empty list | "No receipts yet" + scan button |
| LI-02 | Search by store, by a word on the receipt, by exact amount | Receipt found |
| LI-03 | Filter: period, category, min/max, Needs review, sort | Consistent results; dot on the filter icon |
| LI-04 | Filter → Reset | All receipts |
| LI-05 | More than 40 receipts → scroll | The next ones load |
| LI-06 | "N receipts need review" banner → Review now | Only receipts to check |
| LI-07 | Pull down | Refresh |
| LI-08 | "30 days" button on the "Today" line | Chart of the last 30 days; today's amount shown; tap a bar → its day and amount |
| LI-09 | Scan a receipt with the chart open | Today's bar and amount update |

### F5 Details and editing

| ID | Steps | Expected result |
| --- | --- | --- |
| DT-01 | Doubtful receipt → "This is correct" on each field | The Needs review badge disappears |
| DT-02 | Mark as reviewed → Undo | Previous state back |
| DT-03 | Edit → change the total → save | New total shown, month totals updated |
| DT-04 | Edit → Re-run OCR | Fields read again from the photo |
| DT-05 | Edit → replace the photo | New photo, other data kept |
| DT-06 | Delete → confirm | Receipt gone, list and totals updated |
| DT-07 | Share → JPG / PDF / CSV / Copy text | Share sheet with the right file; text can be pasted |

### F6 Categories

| ID | Steps | Expected result |
| --- | --- | --- |
| CA-01 | Create a category (name, color, icon) | Shown in the list and in the quick filters |
| CA-02 | Create "groceries" (already exists) | "\"groceries\" already exists." |
| CA-03 | Rename, reorder with the handle | Order kept after restarting the app |
| CA-04 | Delete a category in use | Its receipts move to "Other" |
| CA-05 | Try to delete "Other" | Not possible |
| CA-06 | Name longer than 30 characters | Length error |

### F7 Totals

| ID | Steps | Expected result |
| --- | --- | --- |
| TO-01 | Month banner → Day / Week / Month / Year | Correct totals and counts |
| TO-02 | Previous / next / Pick a date | Correct navigation |
| TO-03 | Settings → Week starts on = Monday | Weeks start on Monday |
| TO-04 | Empty period | "Nothing was scanned on these dates." |
| TO-05 | Scan 2 receipts in USD → Settings currency EUR → scan 1 receipt | Totals show only the EUR receipt, plus "2 in other currencies"; nothing is added across currencies |

### F8 Multi-select

| ID | Steps | Expected result |
| --- | --- | --- |
| SE-01 | Long press a receipt | Selection mode |
| SE-02 | Select all → Export CSV | File with every receipt |
| SE-03 | Select 3 receipts → Share | PDF with photos |
| SE-04 | Select 2 receipts → Delete | "Delete 2 receipts?", then deleted |

### F9 Export

| ID | Steps | Expected result |
| --- | --- | --- |
| EX-01 | Export all → CSV → open in Excel / Google Sheets | Correct columns, accents and symbols |
| EX-02 | Note = `=1+1` → CSV export → open in Excel | Shown as text, **never calculated** |
| EX-03 | CSV export with "Include receipt photos" | ZIP: CSV + `photos/` folder |
| EX-04 | PDF export with and without photos | Readable PDF; bigger with photos |
| EX-05 | Export a period without receipts | "There are no receipts to export." |
| EX-06 | PDF report with USD and EUR receipts | One total per currency ("$… + €…"), each receipt in its own currency |
| EX-07 | PDF with photos, one photo unreadable (restored from an old backup) | PDF created; "Photo could not be added." for that receipt |

### F10 Backup and restore

| ID | Steps | Expected result |
| --- | --- | --- |
| BK-01 | Back up now | `scanreceipt-backup-YYYY-MM-DD.zip` shared |
| BK-02 | Restore it on another phone, or after reinstalling | Same receipts, photos, categories, rules and settings |
| BK-03 | Restore a ZIP that is not a backup | "This file is not a ScanReceipt backup.", nothing changed |
| BK-04 | Turn the reminder on → allow notifications | Toggle on |
| BK-05 | Turn the reminder on → deny notifications | Toggle stays off |
| BK-06 | Scan 2 receipts after a backup | "2 new receipts since your last backup" |

### F11 Settings and general

| ID | Steps | Expected result |
| --- | --- | --- |
| RG-01 | Set currency to EUR → scan | New receipt in € |
| RG-02 | Format DD/MM/YYYY | Dates shown and read in the European order |
| RG-03 | Turn off "Warn on low confidence" | No highlighted fields when saving |
| TR-01 | Close and reopen the app | All data still there |
| TR-02 | Android back button on every screen | Consistent navigation, no unexpected exit |
| TR-03 | System dark mode | Screens readable |
| TR-06 | Settings → Appearance = Light, system in dark mode | App stays light, also after a restart |
| TR-07 | Settings → Appearance = Dark, system in light mode | App and status bar dark |
| TR-08 | Appearance = Same as device → switch the system between light and dark | The app follows right away |
| TR-04 | Larger system font size | No blocking truncated text |
| TR-05 | First launch | Splash, then empty list with no error |

## Device matrix

| Platform | Minimum | Middle | Latest |
| --- | --- | --- | --- |
| Android | 7.0 (API 24) | 11 (API 30) | 16 (API 36) |
| iOS | 15.5 | 17 | 26 |

Android emulators for API 24, 30 and 36 are covered by the **2 · QA** workflow. Add one real phone per OS.

## Reporting a bug

Open an issue with the **Bug report** template: https://github.com/LouziAmine/ScanReceipt/issues/new/choose.
It asks for the device, the app version, the test case ID, the steps, and the expected and actual results.

| Severity | Definition |
| --- | --- |
| **Blocker** | Data loss, crash, cannot scan or save |
| **Major** | Feature unusable, but there is a workaround |
| **Minor** | Annoyance, wrong display |
| **Cosmetic** | Wording, alignment, color |

> For an OCR bug, attach **a photo of the receipt** (hide personal data) and the **Raw OCR text**: that is what turns it into a new test case.
