## ADDED Requirements

### Requirement: Owner creates an expiring read-only share link
The workspace owner SHALL be able to create a share link that returns a token, URL, and expiry; viewing through the link SHALL require no authentication. The shared view SHALL expose only aggregates — totals, category breakdown, and forecast — with NO transaction-level descriptions and NO mutation capability through the link. The token SHALL be generated app-side as a random value stored in the database (no dialect-side UUID generation).

#### Scenario: Link creation returns token and expiry
- **WHEN** an owner with a session creates a share link
- **THEN** a token, URL, and expiry are returned and the link can be opened without authentication

#### Scenario: Shared view is aggregates-only
- **WHEN** the shared report is opened
- **THEN** it shows totals, category breakdown, and forecast only — no transaction descriptions, and no action can mutate data through the link

### Requirement: Shared viewer reads the report without an account
Given a valid, unexpired token, opening `/r/:token` while signed out SHALL render the read-only report (totals, category breakdown, forecast). Transaction-level descriptions SHALL be excluded by default — only aggregated figures appear. An invalid or expired token SHALL render a clear "link no longer available" page, never an error dump.

#### Scenario: Valid token renders read-only report
- **WHEN** a valid, unexpired token is opened signed out
- **THEN** the report renders with totals, category breakdown, and forecast

#### Scenario: No transaction detail leaks
- **WHEN** the shared report renders
- **THEN** transaction-level descriptions are excluded — only aggregates appear

#### Scenario: Invalid or expired token fails clearly
- **WHEN** an invalid or expired token is opened
- **THEN** a clear "link no longer available" page renders — not an error dump

### Requirement: Owner revokes a share link immediately
The owner SHALL be able to revoke an active share link such that the token stops resolving immediately for any holder of the URL. A revoked link SHALL show the same clear unavailable message as an expired token.

#### Scenario: Revoke takes effect immediately
- **WHEN** an owner revokes an active share link
- **THEN** the token immediately stops resolving for anyone holding the URL

#### Scenario: Revoked link matches expired message
- **WHEN** someone opens a revoked link
- **THEN** they see the same clear unavailable message as for an expired token
