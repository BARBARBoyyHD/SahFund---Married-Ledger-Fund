## ADDED Requirements

### Requirement: Free tier allows one import with a visible, clear lock
A workspace that has never paid SHALL complete its first import successfully with the dashboard fully visible. A second import and any export attempt SHALL be refused server-side with a structured response whose message clearly explains that a one-time purchase unlocks unlimited imports and export for this workspace — never a silent failure or unexplained error. Data already imported SHALL remain fully visible and intact in the free state.

#### Scenario: First import succeeds free
- **WHEN** a never-paid workspace imports its first statement
- **THEN** the import succeeds and the dashboard is fully visible

#### Scenario: Second import and export are clearly locked
- **WHEN** a free workspace attempts a second import or an export
- **THEN** each is refused with a clear message that a one-time purchase unlocks unlimited imports and export for this workspace — not a silent failure

#### Scenario: Existing data stays visible
- **WHEN** a free workspace is in the locked state
- **THEN** all previously imported data remains fully visible and intact

### Requirement: Pricing page states the one-time price with the privacy position
A pricing page SHALL state the one-time price — Rp 49.000 introductory / Rp 99.000 list — charged once per wedding, with no recurring or subscription language, and SHALL state the privacy position alongside the price (the statement never leaves the device; nothing is stored).

#### Scenario: One-time price stated correctly
- **WHEN** the pricing page loads
- **THEN** it states Rp 49.000 introductory / Rp 99.000 list, charged once per wedding, with no recurring or subscription language

#### Scenario: Privacy position accompanies the price
- **WHEN** the pricing page is read
- **THEN** it states that the statement never leaves the user's device and nothing is stored

### Requirement: One-time purchase unlocks idempotently per order
When a purchase completes (Rp 49.000 or Rp 99.000), the entitlement SHALL be granted for that workspace — unlimited imports and export, no further charge ever requested. The grant SHALL be processed at most once per order id: retried webhooks or duplicate grants for the same order SHALL be no-ops. An in-flight or failed payment SHALL leave the workspace in its previous state — no partial unlock — and SHALL show the error rather than swallow it.

#### Scenario: Completed purchase unlocks the workspace
- **WHEN** a completed one-time purchase is granted
- **THEN** unlimited imports and export unlock for that workspace and no further charge is ever requested

#### Scenario: Duplicate order grant is a no-op
- **WHEN** the same order id arrives more than once
- **THEN** the grant is processed at most once — entitlement stays idempotent per order

#### Scenario: Failed payment changes nothing
- **WHEN** a payment is in-flight or fails with an uncertain outcome
- **THEN** the workspace stays in its previous state, no partial unlock occurs, and the error is shown

### Requirement: Paid workspaces export their rows
A paid workspace owner SHALL be able to export the workspace's transaction rows as a machine-readable file with amounts and dates correctly formatted (integer minor units and ISO dates). Export SHALL contain only that workspace's data and SHALL run only after server-side session and membership verification. A free workspace SHALL see the same clear lock message as a second import.

#### Scenario: Paid export contains only own data
- **WHEN** a paid workspace triggers an export
- **THEN** the file contains only that workspace's rows, with amounts and dates correctly formatted, after server-side membership verification

#### Scenario: Free export is locked with the unlock message
- **WHEN** a free workspace attempts export
- **THEN** it is locked with the same clear unlock message as a second import
