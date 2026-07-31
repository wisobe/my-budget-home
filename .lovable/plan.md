# CSV Import for transactions

Import transactions from a bank CSV file into any account, with column mapping, duplicate detection, and a preview step before anything is written.

## User flow

1. Transactions page → new **Import CSV** button (next to Sync / Add transaction).
2. Dialog step 1 — **Upload**: pick a `.csv` file, choose the target account, pick a delimiter (auto-detected, overridable).
3. Dialog step 2 — **Map columns**: the app shows detected headers and a preview of the first 5 rows. You map:
   - Date (required) + date format (auto-guessed: `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`)
   - Description / name (required)
   - Amount (required) — either a single amount column, or separate Debit / Credit columns
   - Optional: merchant name, notes, currency
   - Amount sign convention toggle: "positive = expense" (Plaid style) or "positive = income" (most bank exports), so imported data matches the rest of the app.
4. Dialog step 3 — **Preview & confirm**: server-side dry run returns counts of rows that will be imported, skipped as duplicates, and rejected as invalid (with row numbers and reasons). Nothing is written yet.
5. Confirm → import runs, transactions are created, auto-categorization and auto-exclusion rules are applied, and the list refreshes.

## Duplicate detection

A row is considered a duplicate if a transaction already exists for the same account with the same date, the same amount, and a normalized name match. Duplicates are skipped by default, with a checkbox to import them anyway.

## Manual accounts

CSV import is most useful for accounts Plaid cannot sync. The Accounts page gets an **Add manual account** action (name, type, currency, starting balance). Manual accounts have no Plaid connection, are never touched by sync, and are valid import targets. They already fit the existing `accounts` table (`plaid_connection_id` is nullable).

## Technical details

**Backend (PHP)**
- `public/api/transactions/import-preview.php` — accepts parsed rows + mapping, validates, flags duplicates, returns a per-row report. No writes.
- `public/api/transactions/import.php` — same validation, then inserts inside a transaction (all-or-nothing), applying `AutoCategorizer` and `AutoExcluder` per row exactly like `create.php` does. Returns imported/skipped counts.
- `public/api/accounts/create.php` — creates a manual account owned by the current user.
- Shared helper `public/api/includes/CsvImport.php` for row normalization, date parsing, amount parsing (handles `1 234,56`, `$1,234.56`, parentheses negatives), and duplicate lookup — used by both endpoints so preview and import can never disagree.
- Rows are parsed in the browser and sent as JSON, so no file upload handling or temp files are needed on the server. Batch size capped (e.g. 2000 rows per import) with a clear message if exceeded.
- Imported transactions get `plaid_transaction_id = NULL`, `pending = 0`, and a marker in `notes` is **not** added; instead a new nullable `source` column (`plaid` | `manual` | `csv`) is added to `transactions` so imports are identifiable and could be bulk-reverted later.

**Frontend (React)**
- New `src/components/transactions/ImportCsvDialog.tsx` — three-step wizard using existing shadcn dialog/select/table primitives, slate + emerald styling.
- New `src/lib/csv.ts` — small dependency-free CSV parser (handles quoted fields, embedded commas/newlines, `,` `;` `\t` delimiters, BOM stripping).
- New `src/components/accounts/AddManualAccountDialog.tsx`.
- API client methods and React Query hooks added to `src/lib/api.ts` and `src/hooks/use-transactions.ts` / `use-accounts.ts`, invalidating transaction, account, and report queries on success.
- All numeric fields cast with `Number()`, booleans coerced with `!!`, currency shown with `en-CA`.

**Schema change** (added to `public/api/schema.sql` with a migration comment, matching the existing convention):
```sql
ALTER TABLE transactions ADD COLUMN source VARCHAR(20) DEFAULT 'plaid' AFTER notes;
```

**i18n** — new keys for the whole wizard in `src/i18n/en.json` and `fr.json`.

## Out of scope for this pass
- Saving reusable mapping templates per bank (easy follow-up once you know your CSV layouts)
- OFX/QFX formats
- Undo/bulk-revert of an import batch (the `source` column lays the groundwork)