## ADDED Requirements

### Requirement: Bulk-attribute transactions to a partner
Users SHALL assign a member to a selection of transactions in one action, with per-member totals recomputing after. Every selected row SHALL get an explicit outcome — rows that did not update (unknown id, not in this workspace) SHALL be reported by row; a silent partial success is never acceptable.

#### Scenario: Selection updates in one action
- **WHEN** a member is applied to a selection of transactions
- **THEN** all selected rows update in one action and per-member totals recompute

#### Scenario: No silent partial success
- **WHEN** some selected rows cannot be updated
- **THEN** the result states exactly which rows did and did not update

### Requirement: Per-member contribution report
The contribution report SHALL show money in, money out, and net position per member, summed exactly in integer minor units. Unattributed rows SHALL appear as a separate "unattributed" line — never silently folded into a member's total.

#### Scenario: In/out/net per member
- **WHEN** the contribution report renders with attributed transactions
- **THEN** it shows money in, money out, and net position per member, exact in integer minor units

#### Scenario: Unattributed rows visible separately
- **WHEN** unattributed transactions exist
- **THEN** they are shown as unattributed rather than folded into a member's total

### Requirement: Per-category budgets
Users SHALL set a budget per category; budgets SHALL be stored in integer minor units and drive the budget-vs-actual report. The whole-wedding target (US-08) SHALL remain a separate figure with no conflicting source of truth.

#### Scenario: Budget stored in minor units
- **WHEN** a user sets a category budget in IDR
- **THEN** it is stored in integer minor units and used by the budget-vs-actual report

#### Scenario: Category budgets and wedding target coexist
- **WHEN** per-category budgets are set alongside the overall wedding target
- **THEN** the report shows both without conflicting sources of truth

### Requirement: Budget-vs-actual report
For each category the report SHALL show budget, committed (signed contracts), paid, and remaining, plus a totals row with the same four figures for the whole wedding. Categories over budget SHALL be marked (e.g. "+500.000") — never hidden or clamped to zero. Zeros SHALL render only where the underlying query succeeded; a database failure SHALL show the error state (US-43), not zeros.

#### Scenario: Four figures plus totals row
- **WHEN** budgets and commitments exist and the report renders
- **THEN** each category shows budget, committed, paid, remaining, and a totals row with the same four numbers

#### Scenario: Over-budget is visible
- **WHEN** a category exceeds its budget
- **THEN** the report marks the overage — never hidden or clamped to zero

#### Scenario: DB failure shows error, not zeros
- **WHEN** the underlying query fails
- **THEN** the report renders the error state (US-43) instead of zero figures

### Requirement: Vendor commitments with DP and pelunasan
Users SHALL record a vendor commitment with vendor name, optional category, total, paid, and optional due date, stored independently of ledger transactions. Recording a DP and later a pelunasan SHALL update `paid` against `total`, both as integer minor units.

#### Scenario: Commitment stored independently
- **WHEN** a user submits the commitments form
- **THEN** the commitment is stored without requiring any ledger transaction

#### Scenario: Paid tracks settlements against total
- **WHEN** a DP and later a pelunasan are recorded
- **THEN** `paid` reflects settlements against `total` in integer minor units

### Requirement: Payments counted twice are surfaced visibly
When a commitment's `paid` amount corresponds to a ledger transaction already in the ledger, reports SHALL visibly surface the duplication to the user — it SHALL never be silently counted twice and never silently dropped. The report SHALL make clear which figure is included in totals.

#### Scenario: Duplication surfaced
- **WHEN** a commitment paid amount matches an existing ledger transaction
- **THEN** the duplication is visibly surfaced in the report

#### Scenario: User sees which figure counts
- **WHEN** a surfaced duplication is reviewed
- **THEN** the report state makes clear which figure is included in totals
