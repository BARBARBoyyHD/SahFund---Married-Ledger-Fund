## ADDED Requirements

### Requirement: Chronological ledger browse
The ledger SHALL list workspace transactions newest-first with date, description, signed amount in IDR format, category, member, and direction. It SHALL paginate or virtualize — never render thousands of rows into the DOM at once — and an empty workspace SHALL show an empty state explaining what to do next (import or add manually).

#### Scenario: Newest-first with full columns
- **WHEN** a workspace with transactions opens the ledger
- **THEN** rows are listed newest-first with date, description, signed IDR-formatted amount, category, member, and direction

#### Scenario: Large workspace stays fast
- **WHEN** the ledger loads for a workspace with thousands of rows
- **THEN** the list is paginated or virtualized — not all rows are rendered into the DOM

#### Scenario: Empty state guides the user
- **WHEN** a workspace with no transactions opens the ledger
- **THEN** an empty state explains how to add data (import or manual entry)

### Requirement: Filter and search via URL state
Users SHALL filter the ledger by date range, category, member, and direction and search by keyword; filtering and pagination SHALL happen in the database query (not fetch-all-then-slice). Filter state SHALL live in URL search params so copied URLs and the back button preserve it. Matching descriptions SHALL render with money and dates formatted via the shared money module.

#### Scenario: Query-side filtering
- **WHEN** filters are active
- **THEN** only matching rows are returned, filtered and paginated in the query

#### Scenario: Filters survive copy and back navigation
- **WHEN** the filtered URL is copied or the back button pressed
- **THEN** the same filter state is restored

#### Scenario: Search formatting stays shared
- **WHEN** a search term matches descriptions
- **THEN** results show money and dates formatted via the shared money module

### Requirement: Re-categorise and reassign a transaction
A member SHALL be able to change a transaction's category and attributed member; the row SHALL update immediately and per-member/category totals SHALL reflect the change after refresh. Transactions default to `categoryId = null` (uncategorised). Offering the correction as a payee rule (US-23) SHALL be an explicit user choice — never automatic.

#### Scenario: Category correction applies immediately
- **WHEN** a user picks a category for an uncategorised transaction
- **THEN** the row updates immediately and totals reflect the change after refresh

#### Scenario: Member reassignment recomputes contributions
- **WHEN** a transaction's `memberId` is changed
- **THEN** per-member totals recompute

#### Scenario: Rule offer is explicit
- **WHEN** a correction is offered as a payee rule
- **THEN** accepting or declining is the user's explicit choice

### Requirement: Manual transaction entry with dedupe conflict handling
Users SHALL be able to record cash and outside-statement payments: date, description, and signed amount (positive = money in) with optional category and member, validated by the same shared Zod schema client and server. A manual row identical to an already-stored row SHALL surface the dedupe conflict instead of creating a duplicate. Invalid submissions SHALL show inline Bahasa Indonesia field errors and write nothing. Rows SHALL be stored with `source = manual`.

#### Scenario: Valid manual entry stored
- **WHEN** a user submits a valid date, description, and signed amount
- **THEN** the row is stored with `source = manual` and the chosen optional category/member

#### Scenario: Duplicate manual row is blocked
- **WHEN** a manual row identical to an already-imported row is submitted
- **THEN** the dedupe conflict is surfaced and no duplicate row is created

#### Scenario: Invalid input writes nothing
- **WHEN** a submission is missing date or amount
- **THEN** inline Bahasa Indonesia field errors appear and nothing is written
