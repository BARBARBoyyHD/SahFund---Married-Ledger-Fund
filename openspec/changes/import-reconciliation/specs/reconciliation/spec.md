## ADDED Requirements

### Requirement: Green "Cocok dengan saldo bank" state
The import preview SHALL prove rows against the bank's printed balance: when opening balance + money in − money out equals the printed closing balance within Rp 1, and totals reconcile within Rp 0.05, it SHALL show the green "Cocok dengan saldo bank" state with Saldo awal, Masuk, Keluar, and Saldo akhir. A tampered amount MUST make `ok` false with the balance-chain or totals issue reported — a false green state is never acceptable.

#### Scenario: Reconciled statement shows green
- **WHEN** a statement's balance chain matches within Rp 1 and totals within Rp 0.05
- **THEN** the green "Cocok dengan saldo bank" state is shown with Saldo awal, Masuk, Keluar, and Saldo akhir

#### Scenario: Tampered amount never gets green
- **WHEN** a row amount is tampered so the chain or totals no longer match
- **THEN** `ok` is false and the corresponding issue is reported — no green state

### Requirement: Reconciliation failure is explained and resolvable
On mismatch, the preview SHALL list issues by kind (`balance_chain`, `totals`, `opening`, `duplicate`, `empty`) with human-readable Bahasa Indonesia messages including the offending line where applicable. Choosing "Batal" SHALL persist nothing. Choosing to continue SHALL record the import with `reconciled = false` and its issues, and the import SHALL never be silently included in trusted reports.

#### Scenario: Issues listed by kind with the offending line
- **WHEN** reconciliation fails
- **THEN** issues are listed by kind with human-readable messages, including the offending line where applicable (e.g. "13 Apr 2026 11:55 saldo seharusnya Rp 210, tertulis Rp 226")

#### Scenario: Cancel persists nothing
- **WHEN** the user chooses "Batal" after reviewing issues
- **THEN** nothing is persisted

#### Scenario: Continue stores the failure
- **WHEN** the user chooses to continue with listed issues
- **THEN** the import is stored with `reconciled = false` and its issues, and is excluded from trusted reports until confirmed

### Requirement: Server independently re-verifies reconciliation
The server SHALL re-run reconciliation on every posted payload using the same single implementation as the client preview and SHALL store the server's result as authoritative. Where the client-computed `reconciliation` field disagrees with the server's recomputation, the server's verdict SHALL govern the green state and trusted totals.

#### Scenario: Server recomputes and its verdict wins
- **WHEN** an import payload with a client-computed `reconciliation` field is posted
- **THEN** the server recomputes reconciliation with the same implementation and stores the server result as authoritative

#### Scenario: Manipulated client cannot fake green
- **WHEN** a client posts a forged `ok: true` over rows that do not reconcile
- **THEN** the stored verdict reflects the server's recomputation and the green state does not appear

### Requirement: Flagged import requires explicit confirmation before entering trusted totals
An import stored with `reconciled = false` SHALL be excluded from trusted totals and visibly flagged in the UI until the user explicitly confirms it. After confirmation it SHALL be treated as final for totals while remaining visibly marked "belum cocok" with its issues. Every report computation SHALL follow this inclusion/exclusion rule — a failed import is never silently mixed into trusted numbers.

#### Scenario: Unconfirmed flagged import is excluded
- **WHEN** an import with `reconciled = false` has not been confirmed
- **THEN** it is excluded from trusted totals and visibly flagged in the UI

#### Scenario: Explicit confirmation makes it final but still marked
- **WHEN** the user explicitly confirms a flagged import
- **THEN** it is included in totals while remaining visibly marked "belum cocok" with its issues

#### Scenario: Reports always respect the gate
- **WHEN** any report aggregates totals
- **THEN** flagged imports are included only if explicitly confirmed — never silently mixed in
