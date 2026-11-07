## ADDED Requirements

### Requirement: Jago PDF statement is parsed on the user's device
The system SHALL extract Bank Jago PDF statement rows in the browser using the PDF text layer only. Only normalised rows and reconciliation JSON may be sent to the server; no file bytes SHALL be uploaded, stored, or logged anywhere. A PDF without a text layer SHALL fail parsing with a clear Bahasa Indonesia message and persist nothing; the system SHALL never attempt OCR.

#### Scenario: Successful on-device extraction
- **WHEN** a user selects a Jago PDF with a text layer
- **THEN** extraction runs in the browser, a preview of normalised rows is produced, and only derived rows plus reconciliation JSON are sent to the server

#### Scenario: No file bytes persist anywhere
- **WHEN** any import completes
- **THEN** no statement file bytes are uploaded, stored, or logged in the system

#### Scenario: Scanned PDF (no text layer) fails cleanly
- **WHEN** a user selects a PDF with no text layer
- **THEN** parsing fails with a clear message, nothing is persisted, and OCR is never attempted

### Requirement: CSV/XLSX statements import via column mapping
The system SHALL accept `.csv` and `.xlsx` exports whose columns the user maps to the canonical fields (date, description, amount, balance, optional ref/time) and SHALL parse them into the same canonical statement shape as a Jago import. Preview, reconciliation gate, and dedupe SHALL behave identically regardless of source bank. An unmappable or malformed file SHALL produce a clear error naming the offending input and persist nothing.

#### Scenario: Mapped columns parse to the canonical shape
- **WHEN** a user maps the date, description, amount, and balance columns of a `.csv` or `.xlsx` export
- **THEN** rows are parsed into the same canonical statement shape used for Jago imports

#### Scenario: Downstream is bank-agnostic
- **WHEN** a mapped file passes parsing
- **THEN** preview, reconciliation, and dedupe behave exactly as for a Jago import — nothing downstream knows which bank produced the file

#### Scenario: Malformed file errors clearly
- **WHEN** a file cannot be mapped or parsed
- **THEN** a clear error names the offending input and nothing is persisted

### Requirement: User chooses the pocket and confirms the period
The import preview SHALL let the user select which pocket to import from a multi-pocket statement, with totals shown for the selected pocket only, and SHALL pre-fill the detectable period (e.g. "April 2026"), overridable by the user.

#### Scenario: Pocket selection scopes totals
- **WHEN** a statement containing several pockets is previewed
- **THEN** the user can select the pocket to import and the displayed totals belong to the selected pocket

#### Scenario: Period pre-filled and overridable
- **WHEN** a preview loads for a statement whose period is detectable
- **THEN** the period is pre-filled and the user can override it

### Requirement: Preview shows counts and commit is atomic
The import preview SHALL show the reconciliation result, the count of new transactions, and the count of duplicates before commit. On confirm, the import row and ALL its transaction rows SHALL be persisted in a single atomic batch — a partial import must be impossible. Files exceeding 5,000 rows SHALL be rejected with a clear message stating the limit; the server SHALL validate every payload against the shared Zod schema regardless.

#### Scenario: Preview counts before commit
- **WHEN** a parsed statement preview renders
- **THEN** it shows the reconciliation result, new-transaction count, and duplicate count (e.g. "34 transaksi baru · 0 duplikat")

#### Scenario: Atomic commit
- **WHEN** the user confirms a preview
- **THEN** the import and all its rows are written atomically — no import row can exist without its transactions

#### Scenario: Row limit enforced
- **WHEN** a file with more than 5,000 rows is imported
- **THEN** it is rejected with a clear message stating the 5,000-row limit and nothing is persisted

### Requirement: Re-import is idempotent and concurrency-safe
Posting rows already stored for the workspace SHALL drop duplicates by dedupe hash, succeed as a no-op for those rows, and leave totals unchanged — enforced by a database unique index, not application checks. Two partners importing the same overlapping month simultaneously SHALL both succeed, with the unique index removing the overlap (no locks, no errors, no doubled balance). Duplicate-filtered rows SHALL be reported in the preview counts, not silently swallowed.

#### Scenario: Re-posted rows are a no-op
- **WHEN** the same or overlapping rows are posted again for a workspace
- **THEN** duplicates are dropped by dedupe hash, the import succeeds for the new rows only, and totals are unchanged

#### Scenario: Concurrent overlapping imports
- **WHEN** two partners import the same overlapping month simultaneously
- **THEN** both requests succeed and the unique index removes the overlap — no locks, no errors, no doubled balance

#### Scenario: Duplicates are visible
- **WHEN** a duplicate-filtered import preview is shown
- **THEN** duplicate rows are counted and reported to the user

### Requirement: Parse failure reports the offending line and persists nothing
When a file fails parsing (including a no-text-layer PDF), the system SHALL show the offending line or input in the browser with the reason in Bahasa Indonesia, SHALL persist nothing (no import row, no transactions), and SHALL allow a fixed file to be retried through the normal preview flow.

#### Scenario: Offending line surfaced
- **WHEN** a file fails parsing
- **THEN** the offending line/input is shown in the browser with the reason explained in Bahasa Indonesia

#### Scenario: Nothing half-saved
- **WHEN** a parse failure occurs
- **THEN** no import row and no transactions are persisted

#### Scenario: Fixed file retries normally
- **WHEN** the user fixes the file and retries
- **THEN** the import proceeds through the full preview flow
