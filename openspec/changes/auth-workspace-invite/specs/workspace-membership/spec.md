# workspace-membership — delta spec for change `auth-workspace-invite`

## ADDED Requirements

### Requirement: Workspace creation
**Source**: BRD §4 FR-02, BRD §5 NFR-03; USER-STORIES US-05
The system SHALL create a workspace from a name plus an optional wedding date and budget target in one atomic write that also inserts the creator as the sole owner member, SHALL return a 10-character pocket code (4 digits + 3 letters + 3 alphanumeric, e.g. `4821kPz7xQ`), and SHALL store the budget target as an integer minor-unit amount.

#### Scenario: Successful creation
- **WHEN** a signed-in user who belongs to no workspace submits a name plus optional weddingDate and budgetTarget
- **THEN** the workspace is created, the user becomes its only membership row with role `owner`, a pocket code matching the 10-character format is returned, and the budget target is stored as integer minor units with no floating point involved

#### Scenario: Second workspace is refused by the database
- **WHEN** a user who already belongs to a workspace as owner or member submits the create-workspace form
- **THEN** the attempt is refused with a clear Bahasa Indonesia message and afterwards no second workspace row and no second membership row exist, the rule being enforced by `UNIQUE (members.userId)` / `UNIQUE (workspaces.ownerId)` and not by a handler count

#### Scenario: Creation is atomic under partial failure
- **WHEN** any statement of the creation write fails
- **THEN** neither the workspace row nor the membership row is persisted

#### Scenario: Missing wedding date prompts on the dashboard
- **WHEN** a workspace is created without a wedding date
- **THEN** the dashboard prompts the user to set it instead of showing a broken forecast

### Requirement: Join by pocket code
**Source**: BRD §4 FR-02; ITA §5; USER-STORIES US-06
The system SHALL let a signed-in user join exactly one workspace by submitting a structurally valid pocket code, SHALL create the membership row through a single insert, and SHALL rely on database constraints — never member counting or check-then-act logic — to enforce the two-member cap and the one-workspace-per-user rule, mapping each violated constraint to a clear Bahasa Indonesia message.

#### Scenario: Valid code joins the workspace
- **WHEN** a signed-in user with no membership submits a valid 10-character code for a workspace with a free member slot
- **THEN** a membership row with role `member` is created and the shared dashboard is shown

#### Scenario: Malformed code is rejected before any lookup or write
- **WHEN** a code with the wrong length or wrong structure (letters where digits belong) is submitted
- **THEN** an inline Bahasa Indonesia error rejects the format before any database lookup or write occurs

#### Scenario: Third join is refused even under concurrency
- **WHEN** a join is attempted for a workspace that already holds its owner and member rows, including when two joins race each other
- **THEN** the join is refused with a clear full-workspace message and at most two membership rows can ever exist for that workspace (`UNIQUE (members.workspaceId, role)`)

#### Scenario: User is already a member of this workspace
- **WHEN** a member submits their own workspace's code again
- **THEN** they are told they are already a member of this workspace and no second membership row is created

#### Scenario: User already belongs to a different workspace
- **WHEN** a user who is a member elsewhere submits another workspace's code
- **THEN** they are told they already belong to a workspace and no second membership row is created (`UNIQUE (members.userId)`)

#### Scenario: Unknown or rotated code
- **WHEN** a code that matches no workspace — never issued or rotated away — is submitted
- **THEN** a clear "code not valid" message in Bahasa Indonesia is shown, never an error dump

### Requirement: Invite code rotation
**Source**: BRD §4 FR-02 ("rotatable by the owner"); owner-only per Appendix B-6; USER-STORIES US-07
The system SHALL allow only the workspace owner to rotate the pocket code, SHALL issue a new code in the same 10-character format, SHALL make the previous code immediately invalid for joins and join links, and SHALL leave all existing membership rows unchanged.

#### Scenario: Owner rotates the code
- **WHEN** the owner rotates the code
- **THEN** a new 10-character pocket code is issued, the previous code no longer joins — including join links opened from older invite emails — and membership rows are unchanged

#### Scenario: Non-owner attempts rotation
- **WHEN** a member whose role is `member` attempts rotation
- **THEN** the action is refused with a clear Bahasa Indonesia message and the code is unchanged

### Requirement: Wedding date and budget target
**Source**: BRD §4 FR-02 (fields and dashboard prompt); edit path per Appendix B-6; BRD §5 NFR-03; USER-STORIES US-08
The system SHALL allow any member to set or update the wedding date and the budget target after creation, SHALL store the budget target as an integer minor-unit amount, and SHALL change no other workspace data when either value is updated.

#### Scenario: Setting a missing wedding date
- **WHEN** a member sets the wedding date on a workspace that has none
- **THEN** the value is stored, the dashboard prompt disappears, and forecasts become available using that date

#### Scenario: Changing the wedding date
- **WHEN** a member changes an existing wedding date
- **THEN** subsequent forecasts compute against the new date and no other data changes

#### Scenario: Updating the budget target
- **WHEN** a member updates the budget target
- **THEN** the new integer minor-unit value is stored and report "of target" figures render it in IDR form such as `Rp 1.234.567`
