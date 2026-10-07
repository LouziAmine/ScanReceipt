# Features

Every chapter follows the same structure:
- **Goal**: what the feature is for.
- **User flow**: what the person does, screen by screen.
- **Business rules**: what the app guarantees.
- **Limits**: what it does not do.
- **Acceptance criteria**: what to check during acceptance testing.
- **Code**: where the feature lives.

Code paths are relative to `src/app/`.

## F1: Scan a receipt

**Goal**: get a sharp, cropped photo of the receipt in one gesture.

**User flow**
1. From "My receipts", tap **Scan**: the floating button on Android, or "Scan a receipt" at the bottom of the screen on iOS.
2. The native scanner opens. It detects the edges, corrects the perspective and lets you adjust the crop.
3. To use an existing photo, choose **Import from photos**: in the "⋮" menu on Android, or with the image button on iOS.
4. Once the photo is accepted, the app opens the processing screen (F2).

**Business rules**
- One page per receipt.
- Image quality is set in Settings: *High* (JPEG 95%) or *Standard* (JPEG 80%, smaller files).
- Cancelling the scanner does nothing: no file is created.

**Limits**
- In a **browser**, "Scan" opens a file picker: there is no camera.
- The ML Kit document scanner **does not run in the Android emulator**. Use "Import from photos" there.

**Acceptance criteria**
- [ ] On a phone, "Scan" opens the scanner with edge detection.
- [ ] Cancelling the scanner returns to the list without an error.
- [ ] "Import from photos" accepts a photo from the library.

**Code**: `presentation/receipts/scan-launcher.service.ts`, `application/receipts/scan-receipt.use-case.ts` (`capture`),
`infrastructure/native/capacitor-document-scanner.ts`

## F2: Automatic reading OCR

**Goal**: fill in the store, date, total and tax so nothing has to be typed.

**User flow**
1. The "Reading your receipt…" screen shows 4 steps: *Enhancing image*, *Detecting text*, *Extracting store, date, total* and *Preparing review*.
2. If reading fails, "We couldn't read this receipt" offers **Try again** or **Enter details myself**.
3. The review screen opens (F3).

**Reading rules** (`domain/receipts/reading/receipt-reader.ts`, tested on 12 real receipts)

| Field  | How it is found                                                                                           | When it is doubtful                                                    |
| ------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Store  | First lines of the receipt, skipping address, phone, website, "Welcome", "Receipt"…                      | Unsure name: "Please check the store name"                             |
| Date   | ISO dates, month names ("Oct 7, 2026") or numeric dates in the order chosen in Settings                  | Day and month could be swapped (03/04): "Day and month could be swapped"; none found: today's date is used |
| Total  | *Grand total*, *Amount due*, *Balance due*, *Total TTC*, *Net à payer* first, then *Total*; skips *Subtotal*, *Total tax*, *You saved*… | Repaired digits (O→0, l→1, S→5…), or no Total line (the largest amount is used) |
| Tax    | *Sales tax*, *Tax*, *VAT*, *TVA*, *GST*, *HST*, *PST* lines; skips *Tax ID*, *Tax exempt*…              | Amount inconsistent with the total: "Low confidence, please check the tax" |

- Every field has a confidence: `high`, `low` or `missing`. Any field that is not `high` becomes a **doubtful field**. The tax is the exception: it is only doubtful when it was read with low confidence, because many receipts have no tax.
- **The category is suggested** in this order:
  1. a store rule (F6);
  2. keywords (*walmart* → Groceries, *starbucks* → Dining, *shell* → Transportation, *cvs* → Health, *staples* → Office supplies);
  3. the default category from Settings.

**Limits**
- OCR (ML Kit) **only runs on a phone**. In a browser, the review screen says "Enter the details" and the fields are empty.
- Line items are not read.

**Acceptance criteria**
- [ ] A clean receipt with a "TOTAL" line: total read and not highlighted.
- [ ] A receipt without a readable date: today's date, date field highlighted.
- [ ] A Starbucks receipt: Dining is suggested.

**Code**: `domain/receipts/reading/`, `domain/categories/category-suggester.ts`, `infrastructure/native/mlkit-text-recognizer.ts`,
`presentation/scan/processing/`

## F3: Review and save

**Goal**: fix what the OCR got wrong, then save.

**User flow**
1. The "Review receipt" screen shows the photo (with **View full image**) and the form: *Store*, *Date*, *Total*, *Sales tax*, *Category* and *Note (optional)*.
2. Doubtful fields are highlighted with the reason. **This is correct** confirms a field without changing it.
3. **Always use for "store"** creates a store rule (F6): the next receipts from this store get the same category.
4. **Raw OCR text** shows the raw text the OCR read, which helps to understand a mistake.
5. **Retake** opens the scanner again. **Save receipt** saves.
6. After saving, the "Receipt saved" message offers **Undo**, which deletes the receipt and its photo.

**Business rules** (`Receipt` aggregate, `domain/receipts/receipt.ts`)

| Rule                                          | Message shown                                    |
| --------------------------------------------- | ------------------------------------------------ |
| Store required, 80 characters max             | *Enter the store name.*                          |
| Total ≥ 0                                     | *The total cannot be negative.*                  |
| 0 ≤ tax ≤ total                               | *The tax cannot be more than the total.*         |
| Date not in the future (24 h tolerance)       | *The date cannot be in the future.*              |
| Date after January 1, 2000                    | *Please check the date.*                         |
| Note: 500 characters max                      | *The note is limited to 500 characters.*         |

- Amounts are stored as **integer cents**, so there are no rounding errors. Input accepts `12.50`, `12,50` and `$ 1,234.56`.
- A receipt that keeps doubtful fields is flagged **Needs review**. When "Warn on low confidence" is off in Settings, no field is flagged.

**Acceptance criteria**
- [ ] Saving is refused without a store name, with a tax above the total, or with a future date.
- [ ] "Undo" right after saving removes the receipt from the list.
- [ ] With "Always use for X" checked, the next receipt from the same store gets the same category.

**Code**: `presentation/scan/review/`, `presentation/scan/receipt-form/`, `application/receipts/save-receipt.use-case.ts` (`recordScan`)

## F4: List search and filters

**Goal**: find any receipt in seconds.

**User flow** ("My receipts" screen)
- **Month banner**: total and number of receipts this month. Tapping it opens Totals (F7).
- **Search**: "Search store, amount, text…" looks in the store name, the OCR text, the note, and the exact amount (type `12.50`).
- **Quick filters**: *All*, *This month* and the categories.
- **"N receipts need review" banner** with **Review now**: shows only the receipts to check.
- **Full filter** (funnel icon):
  - period: *Any time*, *This week*, *This month*, *Last 3 months* or *Custom range*;
  - categories;
  - minimum and maximum amount;
  - "Needs review" only;
  - sort: *Newest first*, *Oldest first*, *Highest amount*, *Lowest amount* or *Store name (A–Z)*.

  A dot on the icon shows that a filter is on.
- The list is grouped by date. Pull down to refresh. Infinite scroll loads 40 receipts at a time.
- **Long press** on a receipt starts multi-select (F8).
- **"⋮" menu**: *Select receipts*, *Import from photos*, *Export all*, *Manage categories*, *Backup & restore*, *Settings*.

**Empty states**: "No receipts yet" with a scan button when there is nothing, and "No matching receipts" with **Show all receipts** when a search or filter finds nothing.

**Acceptance criteria**
- [ ] Typing an exact amount finds the matching receipt.
- [ ] An active filter shows the dot on the icon, and "Reset" removes it.
- [ ] With more than 40 receipts, scrolling loads the next ones.

**Code**: `presentation/receipts/list/`, `presentation/receipts/filter/`, `application/receipts/receipts.store.ts`,
`domain/receipts/receipt-criteria.ts`, `infrastructure/persistence/sqlite-receipt.repository.ts`

## F5: Receipt details and editing

**Goal**: view, verify, fix or delete a receipt.

**User flow**
- **Details**: full-screen photo, store, date, total, tax, category, note, scan date (*Scanned on*) and OCR text.
  - Doubtful fields show **This is correct** or **This amount is correct** to confirm them one by one.
  - **Mark as reviewed** confirms everything at once, with **Undo**.
  - **Change category** changes the category right from the details.
- **Share receipt**: JPG photo, PDF document, CSV spreadsheet, or **Copy text** to copy the OCR text.
- **Edit receipt**: the same form as the review, plus two actions:
  - **replace the photo**: a new scan, and the old photo is deleted;
  - **Re-run OCR**: reads the saved photo again.
- **Delete receipt**: "Delete this receipt?" confirmation, then the photo and its data are removed from the phone.

**Acceptance criteria**
- [ ] Confirming the last doubtful field removes the "Needs review" badge.
- [ ] After deletion, a link to the old receipt shows "This receipt no longer exists.".
- [ ] Replacing the photo keeps all other data.

**Code**: `presentation/receipts/detail/`, `presentation/receipts/edit/`, `application/receipts/save-receipt.use-case.ts`

## F6: Categories and store rules

**Goal**: file expenses automatically.

**Default categories**: Groceries, Dining, Transportation, Health, Office supplies, Other.

**User flow** (*Manage categories*)
- Tap a category to edit its name, color (9 choices) and icon (12 choices).
- Drag the handle to reorder. Swipe left to delete.
- **New category** creates one. You can also create one from a receipt's category picker, with "Search or type a new category".

**Business rules**
- The name is required, limited to 30 characters, and **unique** regardless of case and accents. Otherwise: *"X" already exists.*
- **"Other" cannot be deleted**: it is the fallback category.
- Deleting a category **moves its receipts to "Other"**. No receipt is ever orphaned.
- **Store rules**: "SUNRISE BAKERY" and "Sunrise Bakery!" count as the same store. A rule wins over keywords.

**Acceptance criteria**
- [ ] Creating "groceries" when "Groceries" exists is refused.
- [ ] Deleting a category in use moves its receipts to Other.
- [ ] "Other" has no delete action.

**Code**: `domain/categories/`, `application/categories/categories.store.ts`, `presentation/categories/`

## F7: Totals per period

**Goal**: know how much was spent, and on what.

**User flow** ("Totals" screen, from the month banner)
- Choose the unit: **Day**, **Week**, **Month** or **Year**. The *Previous period* and *Next period* arrows move in time, and **Pick a date** jumps to a date.
- The screen shows:
  - the total and the number of receipts;
  - the **By category** breakdown;
  - the per-day breakdown;
  - the receipts of the period, up to 200.
- Export the period directly: **Spreadsheet (CSV)**, **PDF report** or **Photos only (ZIP)**.
- An empty period shows "Nothing was scanned on these dates.".

**Business rules**
- The first day of the week (Sunday or Monday) is set in Settings. Days use local time.
- **Amounts in different currencies are never added together.** Totals use the currency from Settings. Receipts saved in another currency are counted separately and flagged: "N in other currencies, not in this total". The PDF report shows one total per currency ("$12.00 + €5.00").

**Code**: `presentation/receipts/summary/`, `application/reporting/period-summary.query.ts`, `domain/shared-kernel/date-range.ts`

## F8: Multi-select

**Goal**: handle several receipts at once, for example for an expense report.

**User flow**: long press a receipt, or choose *Select receipts* in the menu. Then:
- check receipts, or use the button to select or deselect all;
- **Export**: CSV, PDF report or Photos only (ZIP);
- **Share**: a PDF with the photos;
- **Delete**: "Delete N receipts?" confirmation.

**Code**: `presentation/receipts/select/select-receipts.page.ts`

## F9: Export and share

**Goal**: send receipts to an accountant, an employer or a spreadsheet.

| Format                 | Content                                                                                   | Where                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| **CSV**                | Date, Store, Category, Total, Sales tax, Currency, Needs review, Note                      | Export, Totals, multi-select, details   |
| **CSV with photos**    | ZIP: the CSV and a `photos/` folder ("Include receipt photos" option)                     | Export                                  |
| **PDF report**         | Report with or without photos (*"Bigger file, but ready for an audit"*)                   | Export, Totals, multi-select, details   |
| **Photos only (ZIP)**  | Photos named `YYYY-MM-DD-store.jpg`                                                        | Export, Totals, multi-select            |
| **JPG**                | One receipt's photo                                                                        | Details                                 |
| **Text**               | OCR text copied to the clipboard                                                           | Details                                 |

**Business rules**
- The CSV opens cleanly in Excel and Google Sheets: UTF-8 with a BOM, RFC 4180.
- **Formula injection protection**: a cell starting with `=`, `+`, `-` or `@` is neutralized. This is a security rule, and it is tested.
- The Export screen first shows the number of receipts and the total for the chosen period.
- No receipts: *There are no receipts to export.*
- Files go through the system share sheet (mail, Drive, messaging apps…).

**Code**: `application/reporting/export-receipts.use-case.ts`, `application/reporting/receipt-csv.ts`,
`infrastructure/documents/jspdf-fflate-renderer.ts`, `presentation/reporting/export.page.ts`

## F10: Backup restore and reminder

**Goal**: never lose receipts, since they only live on the phone.

**User flow** (*Backup & restore*)
- The screen shows the number of receipts, the storage used and the new receipts since the last backup.
- **Back up now** creates `scanreceipt-backup-YYYY-MM-DD.zip`. It contains `data.json` (settings, categories, store rules, receipts) and every photo. The file goes through the share sheet.
- **Restore from a backup file**: pick a ZIP, confirm "Restore a backup?", and **everything on the phone is replaced** by the backup.
- **Monthly reminder**: a local notification on the 1st of each month at 10 am, "Time to back up your receipts". It asks for notification permission.

**Business rules**
- The backup is **fully checked before anything changes**: format, fields and every photo.
  - Not a backup: *This file is not a ScanReceipt backup.*
  - Missing photo: *The backup is incomplete: the photo of "X" is missing.*
  - Made by a newer version of the app: *Please update the app first.*
- Categories, store rules and receipts are replaced in **a single transaction**: an interrupted restore changes nothing.
- The reminder uses no server: it is a local notification.

**Acceptance criteria**
- [ ] Back up on phone A, restore on phone B: same receipts, photos, categories and settings.
- [ ] Restoring a random ZIP shows an error, and the existing data is untouched.
- [ ] Refusing the notification permission keeps the reminder off.

**Code**: `application/backup/`, `infrastructure/persistence/sqlite-data-replacer.ts`,
`infrastructure/native/local-notification-reminders.ts`, `presentation/backup/backup.page.ts`

## F11: Settings

| Setting                   | Values                                              | Default       | Effect                                           |
| ------------------------- | --------------------------------------------------- | ------------- | ------------------------------------------------ |
| Currency                  | USD, EUR, GBP, CAD, AUD, CHF, MAD                   | USD           | Currency of new receipts and of the totals       |
| Date format               | MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD                  | MM/DD/YYYY    | Display, and day/month order used by the OCR     |
| Week starts on            | Sunday, Monday                                      | Sunday        | Week ranges (Totals, filter)                     |
| Default category          | Any existing category                               | Other         | Category when nothing better is suggested        |
| Image quality             | High, Standard (smaller files)                      | High          | JPEG quality of scans                            |
| Warn on low confidence    | On / Off                                            | On            | Highlights doubtful fields                       |

The Settings screen also links to *Backup & restore*, *Manage categories*, the *Version* and the *Privacy policy*.
Settings are stored in Capacitor Preferences, on the phone.

**Code**: `domain/settings/user-settings.ts`, `application/settings/settings.store.ts`, `presentation/settings/settings.page.ts`
