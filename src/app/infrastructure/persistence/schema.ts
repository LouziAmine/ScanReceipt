/**
 * Ordered migrations. Each entry moves the schema up by one `user_version`.
 * Never edit a shipped migration: append a new one.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL,
    icon        TEXT NOT NULL,
    is_custom   INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS receipts (
    id               TEXT PRIMARY KEY NOT NULL,
    store            TEXT NOT NULL,
    purchased_at     INTEGER NOT NULL,
    day              TEXT NOT NULL,
    total_cents      INTEGER NOT NULL,
    tax_cents        INTEGER,
    currency         TEXT NOT NULL,
    category_id      TEXT NOT NULL,
    note             TEXT NOT NULL DEFAULT '',
    image_path       TEXT NOT NULL,
    ocr_text         TEXT NOT NULL DEFAULT '',
    doubtful_fields  TEXT NOT NULL DEFAULT '',
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_receipts_purchased_at ON receipts (purchased_at DESC);
  CREATE INDEX IF NOT EXISTS idx_receipts_day ON receipts (day);
  CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts (category_id);

  CREATE TABLE IF NOT EXISTS store_rules (
    store_key    TEXT PRIMARY KEY NOT NULL,
    category_id  TEXT NOT NULL
  );
  `,
];
