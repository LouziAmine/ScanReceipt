# Database

## SQLite and not PostgreSQL

The app uses **SQLite**, embedded in the phone, and **not PostgreSQL**. This is on purpose.

| Criterion | SQLite (chosen) | PostgreSQL |
| --- | --- | --- |
| Where the database runs | In the app, on the phone | On a remote server |
| Works offline | ✅ Yes | ❌ No, it needs the internet |
| Privacy ("nothing leaves the phone") | ✅ Kept | ❌ Receipts would go to a server |
| Running cost | $0 | Server, backups, security, compliance |
| User accounts | Not needed | Required (authentication) |
| Expected volume | A few thousand receipts per person | Built for millions of rows and many users |

**PostgreSQL only becomes useful if a backend is added**, for example for sync between devices, a web version, or a
team or accountant space. SQLite would then stay on the phone as the offline cache, and PostgreSQL would be the server
database. The schema below maps almost directly (see [If a backend is ever needed](#if-a-backend-is-ever-needed)).

## Current schema

Source: `src/app/infrastructure/persistence/schema.ts` (migration 1).

```
┌──────────────────────────┐         ┌───────────────────────────────┐
│ categories               │         │ receipts                      │
├──────────────────────────┤         ├───────────────────────────────┤
│ id          TEXT  PK     │◄────────│ category_id     TEXT          │
│ name        TEXT         │  1    n │ id              TEXT  PK      │
│ color       TEXT         │         │ store           TEXT          │
│ icon        TEXT         │         │ purchased_at    INTEGER (ms)  │
│ is_custom   INTEGER 0/1  │         │ day             TEXT YYYY-MM-DD│
│ sort_order  INTEGER      │         │ total_cents     INTEGER       │
└──────────────────────────┘         │ tax_cents       INTEGER NULL  │
            ▲                        │ currency        TEXT (USD…)   │
            │ 1                      │ note            TEXT          │
            │                        │ image_path      TEXT          │
            │ n                      │ ocr_text        TEXT          │
┌──────────────────────────┐         │ doubtful_fields TEXT "a,b"    │
│ store_rules              │         │ created_at      INTEGER (ms)  │
├──────────────────────────┤         │ updated_at      INTEGER (ms)  │
│ store_key    TEXT PK     │         └───────────────────────────────┘
│ category_id  TEXT        │          Indexes: purchased_at DESC, day, category_id
└──────────────────────────┘
```

The arrows are **logical relations**: the code enforces them, not SQL foreign keys (see [Improvements](#improvements)).

| Table | Purpose | Typical size |
| --- | --- | --- |
| `receipts` | One receipt: read or corrected data, photo path, OCR text, doubtful fields | 100 to 5,000 rows |
| `categories` | Default and custom categories, display order | 6 to 30 rows |
| `store_rules` | Normalized store name → category | 0 to 200 rows |

Outside the database:
- **Photos**: JPEG files in the app's private storage. The database keeps the path.
- **Settings**: Capacitor Preferences.

## What is done well

| Point | Why it matters |
| --- | --- |
| **Amounts in integer cents** (`INTEGER`) | No rounding errors, unlike `REAL` |
| **Dates in milliseconds** plus a local `day` column | Fast sorting and period filters; grouping by day without time-zone math in SQL |
| **Indexes** on `purchased_at DESC`, `day`, `category_id` | Cover the list (sorted by date), daily totals and category filters |
| **Versioned migrations** (`user_version`) | Safe schema upgrades; rule: a shipped migration is never edited |
| **Transactions** for every multi-statement write | No half-written state (category deletion, restore) |
| **Serialized writes** | Two writes never interleave |
| **Parameterized queries** (`?`) and escaped `LIKE` | No SQL injection |
| **SQL pagination** (`LIMIT/OFFSET`, 40 per page) | The list stays smooth with thousands of receipts |
| **Per-currency totals** | `SUM` only adds the currency from Settings; other currencies are counted apart |
| **Photos outside the database** | The database stays small and fast |
| **Text ids (UUID)** | No collisions when a backup is restored |
| **Business rules in the domain** (`Receipt`, `Category`) | Validated before any write, and unit-tested |

**Verdict: the schema is sound for an offline mobile app.** It is simple, indexed for the existing screens and safe on
writes. The points below are the remaining improvements, by priority.

## Improvements

| Priority | Finding | Risk | Recommendation |
| --- | --- | --- | --- |
| ✅ **Fixed** | Totals (`SUM(total_cents)`) added every currency together | Wrong total after switching from USD to EUR | Totals now only add the Settings currency; receipts in other currencies are counted in `otherCurrencyCount` and shown as "N in other currencies". The PDF adds per currency (`sumByCurrency`) |
| ✅ **Fixed** | Restore replaced categories and receipts in 2 transactions | Half-restored data if interrupted | One transaction through the `DataReplacer` port (`SqliteDataReplacer`): all or nothing |
| Medium | **No foreign keys** (`receipts.category_id`, `store_rules.category_id`) | A code bug could link a receipt to a missing category. Today the code moves receipts to "Other" before deleting a category | Migration 2: `FOREIGN KEY … REFERENCES categories(id)` and `PRAGMA foreign_keys = ON` (SQLite needs a table rebuild) |
| Low | **No `CHECK` constraints** (`total_cents >= 0`, `tax_cents <= total_cents`, known currency) | None today, the domain validates everything; this is defense in depth | Add `CHECK`s in the rebuild migration |
| Low | `LIKE '%text%'` search on `store`, `ocr_text` and `note` **cannot use an index** | Slower search beyond ~10,000 receipts | **FTS5** full-text index on these columns, if the plugin supports it |
| Low | `doubtful_fields` stored as text `"store,date"` | None in practice: 4 fixed values, read only by the mapper | Keep as is |
| Low | `day` computed when writing, in the phone's time zone | When travelling, a receipt may land on the previous or next day | Acceptable; documented |
| Low | No composite index for "category + period" | Negligible with a few thousand rows | `CREATE INDEX … ON receipts (category_id, purchased_at)` if needed |

## Migration example

Migrations are appended to `MIGRATIONS`. A shipped migration is never edited.

```sql
-- Migration 2: referential integrity and constraints (table rebuild, the SQLite way)
PRAGMA foreign_keys = OFF;

CREATE TABLE receipts_new (
  id               TEXT PRIMARY KEY NOT NULL,
  store            TEXT NOT NULL CHECK (length(store) BETWEEN 1 AND 80),
  purchased_at     INTEGER NOT NULL,
  day              TEXT NOT NULL,
  total_cents      INTEGER NOT NULL CHECK (total_cents >= 0),
  tax_cents        INTEGER CHECK (tax_cents IS NULL OR tax_cents BETWEEN 0 AND total_cents),
  currency         TEXT NOT NULL CHECK (currency IN ('USD','EUR','GBP','CAD','AUD','CHF','MAD')),
  category_id      TEXT NOT NULL REFERENCES categories(id),
  note             TEXT NOT NULL DEFAULT '',
  image_path       TEXT NOT NULL,
  ocr_text         TEXT NOT NULL DEFAULT '',
  doubtful_fields  TEXT NOT NULL DEFAULT '',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
INSERT INTO receipts_new SELECT * FROM receipts;
DROP TABLE receipts;
ALTER TABLE receipts_new RENAME TO receipts;

CREATE INDEX idx_receipts_purchased_at ON receipts (purchased_at DESC);
CREATE INDEX idx_receipts_day ON receipts (day);
CREATE INDEX idx_receipts_category ON receipts (category_id, purchased_at);

PRAGMA foreign_keys = ON;
```

To apply it, you also need to:
- enable `PRAGMA foreign_keys = ON` each time the database opens (`sqlite-database.ts`);
- test the migration on a filled v1 database, and check that a v1 backup still restores.

## If a backend is ever needed

Direct mapping of the model, for a future sync or web version:

| SQLite (phone) | PostgreSQL (server) |
| --- | --- |
| `id TEXT` | `id UUID PRIMARY KEY` |
| `purchased_at INTEGER` (ms) | `purchased_at TIMESTAMPTZ` |
| `day TEXT` | `purchase_day DATE` (computed in the user's time zone) |
| `total_cents INTEGER` | `total_cents BIGINT CHECK (total_cents >= 0)` |
| `currency TEXT` | `currency CHAR(3)` or an `ENUM` |
| `doubtful_fields TEXT "a,b"` | `doubtful_fields TEXT[]` |
| `ocr_text TEXT` + `LIKE` | `ocr_text TEXT` + a `GIN` index (`tsvector`) for full-text search |
| photos in the Filesystem | object storage (S3); the database keeps the URL |
| — | `user_id UUID NOT NULL` on every table + Row Level Security |
| — | `deleted_at TIMESTAMPTZ` (soft delete, needed for sync) |

A backend would change the product promise ("nothing leaves the phone"). That is a **product decision**, to be made
before any technical one.
