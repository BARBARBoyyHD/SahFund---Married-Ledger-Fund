## ADDED Requirements

### Requirement: Exact money arithmetic everywhere
Every transaction, budget, and commitment amount SHALL be stored as an integer in minor units (1/100 rupiah) with no floating point in storage or arithmetic anywhere. Aggregated sums SHALL be exact in integer minor units with zero rounding defects in the reconciliation suite. Reconciliation tolerances SHALL be exactly Rp 1 (balance chain) and Rp 0.05 (totals) — no epsilon drift from float math.

#### Scenario: Integer minor units in storage
- **WHEN** any transaction, budget, or commitment is stored
- **THEN** the amount is an integer in minor units — no floating point in storage or arithmetic

#### Scenario: Exact aggregation
- **WHEN** totals are aggregated over a set of transactions
- **THEN** the sum is exact in integer minor units with zero rounding defects

#### Scenario: Exact reconciliation tolerances
- **WHEN** reconciliation runs on whole-rupee printed amounts
- **THEN** tolerances are exactly Rp 1 (chain) and Rp 0.05 (totals) — no epsilon drift

### Requirement: Bahasa Indonesia first with IDR and id-ID formatting
All user-facing copy SHALL be Bahasa Indonesia, consistent with BRD wording (e.g. "Cocok dengan saldo bank", "Impor mutasi"). Every rendered money value SHALL use `Rp 1.234.567` grouping via the single shared money module — never `$`, never `en-US` grouping, never raw `toString()`. Every rendered date SHALL use `id-ID` format.

#### Scenario: Shared money format everywhere
- **WHEN** any money value renders
- **THEN** it uses `Rp 1.234.567` grouping via the shared money module — never `$`, `en-US`, or raw `toString()`

#### Scenario: id-ID dates
- **WHEN** any date renders
- **THEN** it uses `id-ID` format

#### Scenario: Bahasa Indonesia copy
- **WHEN** any button, error, or state renders
- **THEN** the copy is Bahasa Indonesia consistent with BRD wording

### Requirement: WCAG 2.2 AA across every interactive screen
Every input SHALL have an associated `<label>`; icon-only buttons SHALL carry `aria-label`; validation errors SHALL be announced via `aria-describedby`/`aria-live`. Forms, dialogs, and the ledger SHALL be fully keyboard-reachable with visible focus rings, dialogs trapping focus and closing on Escape. Text and status colour (including the green "Cocok" badge) SHALL meet ≥ 4.5:1 contrast, and semantic elements (`button`, `table`, correct heading order) SHALL be used instead of div-click handlers.

#### Scenario: Labels and announcements
- **WHEN** any input or icon-only button renders
- **THEN** it has an associated label (or `aria-label`) and validation errors are announced via `aria-describedby`/`aria-live`

#### Scenario: Keyboard-only operation
- **WHEN** a user navigates forms, dialogs, and the ledger by keyboard only
- **THEN** the full path is reachable with visible focus rings, dialogs trap focus and close on Escape

#### Scenario: Contrast and semantics
- **WHEN** text/status colour is measured (green badge included)
- **THEN** contrast is ≥ 4.5:1 and semantic elements (`button`, `table`, heading order) are used — no div-click handlers

### Requirement: Every screen has loading, empty, error, and success states
Every data screen SHALL show a skeleton loading state (not a spinner over blank space), an empty state explaining what to do next, and — on any failed request including DB-down (US-43) — an error message with a retry button; the screen SHALL never render nothing. Successful mutations SHALL show a success state and revalidate server state (no stale hand-rolled cache).

#### Scenario: Skeleton while loading
- **WHEN** a page is fetching data
- **THEN** a skeleton loading state is shown — not a spinner over blank space

#### Scenario: Empty state explains next steps
- **WHEN** a page has no data
- **THEN** an empty state explains what to do next

#### Scenario: Error with retry, never blank
- **WHEN** a request fails (including DB-down per US-43)
- **THEN** an error message with a retry button renders — the screen never renders nothing

#### Scenario: Success revalidates server state
- **WHEN** a mutation completes successfully
- **THEN** the success state is visible and server state is revalidated — no stale hand-rolled cache

### Requirement: Fast on a 4G phone
A one-month import flow SHALL complete within 5 s p95 (parsing on-device; server validates and writes in one batch). The dashboard SHALL render within 1.5 s p95 on a 4G connection. pdf.js SHALL load only on the import page via dynamic import — never in the root bundle — and the ledger SHALL never render 5,000 rows at once.

#### Scenario: Import within budget
- **WHEN** a one-month statement import completes on 4G-class conditions
- **THEN** the flow completes within 5 s p95

#### Scenario: Dashboard within budget
- **WHEN** the dashboard loads on a 4G connection
- **THEN** it renders within 1.5 s p95

#### Scenario: Bundle and rendering discipline
- **WHEN** the app bundle and ledger are inspected
- **THEN** pdf.js is dynamic-imported only on the import page and the ledger never renders 5,000 rows at once
