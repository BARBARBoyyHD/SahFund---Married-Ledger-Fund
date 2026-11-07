## ADDED Requirements

### Requirement: Owner deletes a workspace with full cascade
The workspace owner SHALL be able to delete the workspace; all rows (transactions, imports, commitments, categories, memberships, entitlements, share tokens) SHALL be removed immediately in one atomic batch — no orphan row SHALL remain queryable. Non-owners SHALL be refused. Backup purge SHALL complete within 30 days per NFR-06 (operational procedure).

#### Scenario: Owner cascade delete is atomic
- **WHEN** the owner deletes the workspace
- **THEN** all dependent rows are removed immediately in one batch and no orphan rows remain queryable

#### Scenario: Non-owner refused
- **WHEN** a non-owner attempts workspace deletion
- **THEN** the action is refused

#### Scenario: Backups age out within 30 days
- **WHEN** a workspace is deleted
- **THEN** the data is purged from backups within the 30-day window stated by NFR-06

### Requirement: User deletes their account with an explicit workspace path
A registered user SHALL be able to delete their account: the user record and sessions SHALL be removed and sign-in SHALL no longer work. When the account owns a workspace with another member, deletion SHALL follow an explicit, stated path shown to the user before confirmation (deleted with it, or clearly handed over) — never left silently broken for the other member. The purge SHALL complete within the 30-day backup window.

#### Scenario: Account and sessions removed
- **WHEN** a user deletes their account
- **THEN** the user record and sessions are removed and they can no longer sign in

#### Scenario: Owned workspace path is explicit
- **WHEN** an account that owns a workspace with a second member requests deletion
- **THEN** the user sees and confirms an explicit path for that workspace (deleted with it or handed over) before deletion — never a silent break for the other member

#### Scenario: 30-day purge window respected
- **WHEN** an account deletion is processed
- **THEN** the purge completes within the 30-day backup window stated by NFR-06

### Requirement: No document, image, or avatar storage exists
The system SHALL hold only normalised rows: zero file bytes of any statement SHALL persist anywhere. No endpoint SHALL accept uploads of documents, images, or avatars, no object storage SHALL be configured, and no document content or file SHALL be forwarded to logs or third-party services when an import runs.

#### Scenario: Imports persist rows only
- **WHEN** any import completes
- **THEN** only derived rows exist — zero file bytes persist anywhere

#### Scenario: No upload endpoints exist
- **WHEN** application routes are inventoried
- **THEN** no endpoint accepts uploads of documents, images, or avatars and no object storage is configured

#### Scenario: Nothing forwarded externally
- **WHEN** an import runs
- **THEN** no document content or file is forwarded to logs or any third-party service

### Requirement: Financial details stay out of system logs
Logs from any request that touches transactions SHALL carry only route, status, and workspace id — never amounts, descriptions, or row contents. Errors during import SHALL follow the same restriction while the user-facing message stays generic.

#### Scenario: Log lines carry no financial data
- **WHEN** a request touching transactions is logged
- **THEN** only route, status, and workspace id are written — no amounts, descriptions, or row contents

#### Scenario: Import errors log redacted details
- **WHEN** an import errors and details are logged
- **THEN** the same restriction holds and the user-facing message stays generic
